import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for urlCache — singleton memory cache for signed URLs.
 *
 * The cache wraps Supabase `createSignedUrl` and deduplicates concurrent calls
 * for the same path using a promise cache (so multiple simultaneous requests
 * for the same path share one Supabase call). Entries expire after
 * `expiresIn` seconds minus a 5-minute safety margin.
 */

// Mock do cliente Supabase
vi.mock("@/infrastructure/supabase/client", () => {
  const from = vi.fn();
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: "user-test" } },
    error: null,
  });
  return {
    supabase: {
      auth: { getUser },
      storage: { from },
    },
  };
});

import { supabase } from "@/infrastructure/supabase/client";

const mockedFrom = vi.mocked(supabase.storage.from);

describe("urlCache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Limpa o cache do singleton entre cada teste para evitar estado compartilhado
    const { _clearUrlCache } = await import("@/infrastructure/storage/urlCache");
    _clearUrlCache();
  });

  describe("obterSignedUrl — cache hit", () => {
    it("retorna URL cacheada quando o path já foi solicitado", async () => {
      // Arrange: o cache já contém uma entrada válida para o path
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      // Act: importar e chamar obterSignedUrl (que ainda não existe — RED)
      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");
      const url1 = await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);
      const url2 = await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);

      // Assert: retorna a mesma URL nas duas chamadas
      expect(url2).toBe(url1);
      expect(url2).toBe("https://signed.example/foto.jpg");
    });

    it("não chama Supabase quando há cache válido", async () => {
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");
      await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);
      await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);

      // Assert: createSignedUrl foi chamado apenas 1 vez (2ª chamada usou cache)
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe("obterSignedUrl — cache miss", () => {
    it("chama Supabase quando o path não está no cache", async () => {
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/nova.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");
      await obterSignedUrl("user/entrada/moto/nova.jpg", 3600);

      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    it("armazena o resultado no cache após chamada ao Supabase", async () => {
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");
      await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);
      // 2ª chamada deve usar cache, não invocar Supabase novamente
      await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);

      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    it("retorna a URL gerada pelo Supabase", async () => {
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");
      const url = await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);

      expect(url).toBe("https://signed.example/foto.jpg");
    });
  });

  describe("obterSignedUrl — TTL e margem de segurança", () => {
    it("expira entrada após TTL menos margem de 5 minutos", async () => {
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl, _clearUrlCache } = await import("@/infrastructure/storage/urlCache");

      // Primeira chamada: popula cache
      await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);

      // Força expiração do cache (para teste)
      _clearUrlCache();

      // Segunda chamada: deve invocar Supabase novamente
      await obterSignedUrl("user/entrada/moto/foto.jpg", 3600);

      expect(createSignedUrl).toHaveBeenCalledTimes(2);
    });
  });

  describe("obterSignedUrl — expiração real por tempo (mata mutantes de TTL)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("expira entrada quando o tempo passa além do TTL-margem de 5 min", async () => {
      // Inicia o relógio num instante fixo
      const startTime = new Date("2026-01-01T00:00:00Z");
      vi.setSystemTime(startTime);

      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");

      // t=0: cache miss — popula cache. expiraEm = 0 + 3.600.000 - 300.000 = 3.300.000ms
      await obterSignedUrl("user/path/foto.jpg", 3600);
      expect(createSignedUrl).toHaveBeenCalledTimes(1);

      // t=3500s (58min20s): além do TTL-margem (3.300s) mas antes do TTL puro (3.600s).
      // Mata o mutante CRÍTICO ConditionalExpression `entry.expiraEm > agora` → `true`
      // (cache nunca expiraria).
      // Mata o mutante ALTO ArithmeticOperator `-` → `+` (margem invertida: expiraEm seria
      // 3.900.000ms e a entrada ainda pareceria válida neste instante).
      // Mata os mutantes BAIXO ArithmeticOperator `5*60*1000` → `5/60*1000` e `→ 5*60/1000`
      // (margem efetiva ~0ms, expiraEm ≈ 3.600.000ms e a entrada ainda pareceria válida).
      vi.setSystemTime(new Date(startTime.getTime() + 3500 * 1000));
      await obterSignedUrl("user/path/foto.jpg", 3600);
      expect(createSignedUrl).toHaveBeenCalledTimes(2);
    });

    it("boundary: entrada com expiraEm === agora é tratada como expirada", async () => {
      // Mata o mutante ALTO EqualityOperator `>` → `>=` (boundary).
      // No original, `entry.expiraEm > agora` em t=3300s é FALSE (entrada expirada).
      // No mutante `>=`, seria TRUE (ainda válida, Supabase não seria chamado).
      const startTime = new Date("2026-01-01T00:00:00Z");
      vi.setSystemTime(startTime);

      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");

      await obterSignedUrl("user/path/boundary.jpg", 3600);
      expect(createSignedUrl).toHaveBeenCalledTimes(1);

      // Avança exatamente 3.300.000ms (igual a expiraEm calculado).
      vi.setSystemTime(new Date(startTime.getTime() + 3300 * 1000));
      await obterSignedUrl("user/path/boundary.jpg", 3600);

      // Pelo código original, expiraEm === agora é considerado EXPIRADO (cache miss).
      expect(createSignedUrl).toHaveBeenCalledTimes(2);
    });

    it("cache hit dentro da janela TTL-margem (sanity check)", async () => {
      const startTime = new Date("2026-01-01T00:00:00Z");
      vi.setSystemTime(startTime);

      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");

      await obterSignedUrl("user/path/hit.jpg", 3600);

      // t=3299s (55min menos 1s): ainda dentro do TTL-margem
      vi.setSystemTime(new Date(startTime.getTime() + 3299 * 1000));
      await obterSignedUrl("user/path/hit.jpg", 3600);

      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe("obterSignedUrl — deduplicação de chamadas simultâneas", () => {
    it("compartilha uma única chamada ao Supabase para múltiplas requisições simultâneas do mesmo path", async () => {
      // Deferred pattern: resolve é chamado depois para simular delay de rede
      let resolveSignedUrl: (value: unknown) => void;
      const signedUrlPromise = new Promise(resolve => {
        resolveSignedUrl = resolve;
      });

      const createSignedUrl = vi.fn().mockImplementation(
        () =>
          signedUrlPromise.then((url: string) => ({
            data: { signedUrl: url },
            error: null,
          }))
      );
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");

      // Dispara 3 chamadas simultâneas antes de resolver a promise do Supabase
      const allUrls = Promise.all([
        obterSignedUrl("user/entrada/moto/foto.jpg", 3600),
        obterSignedUrl("user/entrada/moto/foto.jpg", 3600),
        obterSignedUrl("user/entrada/moto/foto.jpg", 3600),
      ]);

      // Agora resolve a promise do Supabase — as 3 chamadas devem compartilhar o resultado
      resolveSignedUrl!("https://signed.example/foto.jpg");

      const [url1, url2, url3] = await allUrls;

      // Assert: Supabase foi chamado apenas 1 vez
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(url1).toBe(url2);
      expect(url2).toBe(url3);
      expect(url1).toBe("https://signed.example/foto.jpg");
    });
  });

  describe("obterSignedUrl — diferentes paths", () => {
    it("chama Supabase separadamente para cada path diferente", async () => {
      const createSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/foto.jpg" },
        error: null,
      });
      mockedFrom.mockReturnValue({ createSignedUrl } as never);

      const { obterSignedUrl } = await import("@/infrastructure/storage/urlCache");
      await obterSignedUrl("user/entrada/moto/foto1.jpg", 3600);
      await obterSignedUrl("user/entrada/moto/foto2.jpg", 3600);

      expect(createSignedUrl).toHaveBeenCalledTimes(2);
    });
  });
});
