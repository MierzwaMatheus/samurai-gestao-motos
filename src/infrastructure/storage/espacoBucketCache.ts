import type { EspacoBucketInfo } from "@/domain/interfaces/StorageApi";

/** Janela de cache: 5 minutos. */
const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: EspacoBucketInfo;
  timestamp: number;
}

/**
 * Cache em memória para `consultarEspacoBucket`.
 *
 * Singleton: cada chamada dentro da janela de 5 minutos reusa o valor
 * da primeira chamada, evitando uma invocação ao Edge Function por
 * cada abertura do `StorageManager` ou clique em "Atualizar".
 *
 * Não é invalidado em `deletarArquivosPorPeriodo` — a issue pede
 * explicitamente "atualizar 2× em 1 min não refaz".
 */
class EspacoBucketCache {
  private cache: CacheEntry | null = null;

  async consultarEspacoBucketCacheado(
    fetcher: () => Promise<EspacoBucketInfo>
  ): Promise<EspacoBucketInfo> {
    const now = Date.now();
    if (this.cache && now - this.cache.timestamp < TTL_MS) {
      return this.cache.data;
    }

    const data = await fetcher();
    this.cache = { data, timestamp: now };
    return data;
  }

  /** Força limpeza do cache. Usar apenas em testes. */
  _clearCache(): void {
    this.cache = null;
  }
}

export const espacoBucketCache = new EspacoBucketCache();

/** Alias para a interface esperada pelo `SupabaseStorageApi`. */
export const consultarEspacoBucketCacheado = (
  fetcher: () => Promise<EspacoBucketInfo>
) => espacoBucketCache.consultarEspacoBucketCacheado(fetcher);

/** Limpa o cache entre testes. Usar apenas em testes. */
export const _clearEspacoBucketCache = () => espacoBucketCache._clearCache();