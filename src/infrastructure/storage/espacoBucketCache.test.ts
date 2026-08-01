import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  consultarEspacoBucketCacheado,
  _clearEspacoBucketCache,
} from "@/infrastructure/storage/espacoBucketCache";
import type { EspacoBucketInfo } from "@/domain/interfaces/StorageApi";

const ZERO: EspacoBucketInfo = {
  espacoUsadoBytes: 0,
  espacoTotalBytes: 1024 * 1024 * 1024,
  espacoDisponivelBytes: 1024 * 1024 * 1024,
  percentualUsado: 0,
  totalArquivos: 0,
};

const UM_GB: EspacoBucketInfo = {
  espacoUsadoBytes: 1024 * 1024 * 1024,
  espacoTotalBytes: 1024 * 1024 * 1024,
  espacoDisponivelBytes: 0,
  percentualUsado: 100,
  totalArquivos: 100,
};

/** Helper para construir fetcher que devolve valores em sequência. */
const buildSequentialFetcher = (...valores: EspacoBucketInfo[]) => {
  const fetcher = vi.fn();
  valores.forEach(v => fetcher.mockResolvedValueOnce(v));
  fetcher.mockRejectedValue(new Error("fetcher chamado mais vezes que o esperado"));
  return fetcher;
};

describe("espacoBucketCache.consultarEspacoBucketCacheado", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Data inicial fixa: 2026-08-01T12:00:00Z
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
    _clearEspacoBucketCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invoca o fetcher na primeira chamada (cache miss)", async () => {
    const fetcher = buildSequentialFetcher(ZERO);

    const resultado = await consultarEspacoBucketCacheado(fetcher);

    expect(resultado).toBe(ZERO);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retorna o valor cacheado na 2ª chamada dentro da janela de 5 min", async () => {
    const fetcher = buildSequentialFetcher(ZERO);

    await consultarEspacoBucketCacheado(fetcher);
    // Avança 4 minutos (ainda dentro da janela de 5 min)
    vi.advanceTimersByTime(4 * 60 * 1000);
    const resultado = await consultarEspacoBucketCacheado(fetcher);

    expect(resultado).toBe(ZERO);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("invoca o fetcher novamente após 5 min01 (cache miss por expiração)", async () => {
    // Stryker muta `5 * 60 * 1000` para 0 ou Infinity; muta `<` para `>`.
    // Avançar 1ms além do TTL testa tanto a fronteira quanto a direção
    // do comparador.
    const fetcher = buildSequentialFetcher(ZERO, UM_GB);

    await consultarEspacoBucketCacheado(fetcher);
    // Avança 5 min + 1 ms
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const resultado = await consultarEspacoBucketCacheado(fetcher);

    expect(resultado).toBe(UM_GB);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("não retorna valor cacheado imediatamente após o TTL expirar (fronteira)", async () => {
    // Stryker muta `<` para `>` ou `<=`. Avançar exatamente o TTL testa
    // o boundary: 5 min passa → precisa revalidar.
    const fetcher = buildSequentialFetcher(ZERO, UM_GB);

    await consultarEspacoBucketCacheado(fetcher);
    vi.advanceTimersByTime(5 * 60 * 1000);
    const resultado = await consultarEspacoBucketCacheado(fetcher);

    expect(resultado).toBe(UM_GB);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("reseta o cache via _clearEspacoBucketCache", async () => {
    const fetcher = buildSequentialFetcher(ZERO, UM_GB);

    await consultarEspacoBucketCacheado(fetcher);
    _clearEspacoBucketCache();
    const resultado = await consultarEspacoBucketCacheado(fetcher);

    expect(resultado).toBe(UM_GB);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});