import { supabase } from "@/infrastructure/supabase/client";
import type { TipoFoto } from "@/domain/interfaces/StorageApi";

/**
 * Margem de segurança subtraída do TTL antes de expirar entrada.
 * Evita usar URL cacheada muito perto da expiração real.
 */
const MARGEM_SEGURANCA_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry {
  url: string;
  expiraEm: number; // timestamp ms
}

/**
 * Cache em memória para URLs do Supabase Storage.
 *
 * Mantém dois caches distintos, um para cada categoria:
 *
 * - `signedCache` (TTL): URLs assinadas (`createSignedUrl`). Expiram
 *   após `expiresIn - MARGEM_SEGURANCA` ms. Deduplica chamadas
 *   simultâneas para o mesmo path via cache de promises.
 * - `publicCache` (infinito): URLs públicas (`getPublicUrl`). São
 *   estáveis enquanto o bucket é público — cachear indefinidamente
 *   reduz chamadas a `getPublicUrl` (que em algumas SDKs do Supabase
 *   ainda dispara um HEAD interno).
 *
 * Os dois caches são limpos juntos por `_clearCache`.
 */
class UrlCache {
  private signedCache = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<string>>();
  private publicCache = new Map<string, string>();

  /**
   * Obtém URL assinada, usando cache se disponível e válido.
   * @param path Caminho do arquivo no bucket
   * @param expiresIn Validade em segundos (default 3600)
   */
  async obterSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    const agora = Date.now();
    const expiraEm = agora + (expiresIn * 1000) - MARGEM_SEGURANCA_MS;

    // Cache hit?
    const entry = this.signedCache.get(path);
    if (entry && entry.expiraEm > agora) {
      return entry.url;
    }

    // Já existe requisição pendente para este path? Compartilha.
    const existing = this.pending.get(path);
    if (existing) {
      return existing;
    }

    // Cache miss — invoca Supabase
    const promise = (async () => {
      const { data, error } = await supabase.storage
        .from("fotos")
        .createSignedUrl(path, expiresIn);

      if (error) {
        this.pending.delete(path);
        throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
      }

      this.signedCache.set(path, { url: data.signedUrl, expiraEm });
      this.pending.delete(path);
      return data.signedUrl;
    })();

    this.pending.set(path, promise);
    return promise;
  }

  /**
   * Obtém URL pública, cacheando indefinidamente até `_clearCache`.
   *
   * Public URLs do Supabase Storage são estáveis enquanto o bucket
   * permanece público — não expiram. Cachear reduz o número de
   * chamadas a `getPublicUrl` ao longo da sessão.
   *
   * @param path Caminho do arquivo no bucket
   */
  obterPublicUrl(path: string): string {
    const cached = this.publicCache.get(path);
    if (cached) {
      return cached;
    }

    const { data } = supabase.storage.from("fotos").getPublicUrl(path);
    this.publicCache.set(path, data.publicUrl);
    return data.publicUrl;
  }

  /**
   * Força a expiração de todas as entradas do cache.
   * Usado apenas em testes.
   */
  _clearCache(): void {
    this.signedCache.clear();
    this.pending.clear();
    this.publicCache.clear();
  }
}

/** Singleton global. */
export const urlCache = new UrlCache();

/** Alias para compatibilidade com a interface esperada pelos consumidores. */
export const obterSignedUrl = (path: string, expiresIn: number = 3600) =>
  urlCache.obterSignedUrl(path, expiresIn);

/** Obtém URL pública cacheada indefinidamente. */
export const obterPublicUrl = (path: string) => urlCache.obterPublicUrl(path);

/**
 * Helper central para resolver URL de uma foto. Decide entre public URL
 * (`moto`/`status`) e signed URL (`documento`).
 *
 * Espelha o método `SupabaseStorageApi.obterUrlParaFoto` mas exposto como
 * função top-level para componentes que não têm injeção de dependência
 * do `StorageApi` (ex.: `GaleriaFotos`, `GaleriaFotosMoto`,
 * `ModalVisualizacaoFoto`). Esses componentes ainda precisam resolver
 * paths crus (recebidos de `Entrada.fotosStatus` ou de entradas
 * legadas) — o repository (`SupabaseEntradaRepository`) não assina
 * URLs por design (issue #13), então o resolver fica aqui.
 *
 * Componentes que recebem `Foto[]` resolvida pelo
 * `SupabaseFotoRepository` (e.g. `GaleriaFotosMoto`,
 * `ModalVisualizacaoFoto`) só precisam chamar este helper quando o
 * campo é path cru (ramo de fallback) — URL já resolvida é usada
 * direto.
 */
export const obterUrlParaFoto = async (
  path: string,
  tipo: TipoFoto
): Promise<string> => {
  if (tipo === "documento") {
    return obterSignedUrl(path);
  }
  // moto/status: public URL é síncrona (cache), mas retornamos como
  // Promise para unificar a interface com `obterSignedUrl`.
  return Promise.resolve(obterPublicUrl(path));
};

/** Limpa o cache entre testes. Usar apenas em testes. */
export const _clearUrlCache = () => urlCache._clearCache();
