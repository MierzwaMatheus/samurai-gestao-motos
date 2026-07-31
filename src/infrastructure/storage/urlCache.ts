import { supabase } from "@/infrastructure/supabase/client";

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
 * Cache em memória para URLs assinadas do Supabase Storage.
 *
 * Deduplica chamadas simultâneas para o mesmo path usando um cache de
 * promises — múltiplas requisições simultâneas compartilham uma única
 * chamada ao Supabase.
 *
 * Cada entrada expira após `expiresIn - MARGEM_SEGURANCA` ms.
 */
class UrlCache {
  private cache = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<string>>();

  /**
   * Obtém URL assinada, usando cache se disponível e válido.
   * @param path Caminho do arquivo no bucket
   * @param expiresIn Validade em segundos (default 3600)
   */
  async obterSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    const agora = Date.now();
    const expiraEm = agora + (expiresIn * 1000) - MARGEM_SEGURANCA_MS;

    // Cache hit?
    const entry = this.cache.get(path);
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

      this.cache.set(path, { url: data.signedUrl, expiraEm });
      this.pending.delete(path);
      return data.signedUrl;
    })();

    this.pending.set(path, promise);
    return promise;
  }

  /**
   * Força a expiração de todas as entradas do cache.
   * Usado apenas em testes.
   */
  _clearCache(): void {
    this.cache.clear();
    this.pending.clear();
  }
}

/** Singleton global. */
export const urlCache = new UrlCache();

/** Alias para compatibilidade com a interface esperada pelos consumidores. */
export const obterSignedUrl = (path: string, expiresIn: number = 3600) =>
  urlCache.obterSignedUrl(path, expiresIn);

/** Limpa o cache entre testes. Usar apenas em testes. */
export const _clearUrlCache = () => urlCache._clearCache();
