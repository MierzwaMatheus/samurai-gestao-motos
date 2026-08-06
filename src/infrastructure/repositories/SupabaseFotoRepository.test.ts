import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { _clearUrlCache } from "@/infrastructure/storage/urlCache";

// Mock do cliente Supabase: precisamos controlar o retorno de
// `from("fotos")` (queries no DB) e de `storage.from("fotos")` (signed URLs).
// Como `supabase.from` e `supabase.storage.from` são expostos separadamente,
// mantemos dois `vi.fn` independentes para evitar acoplamento entre as
// cadeias.
vi.mock("@/infrastructure/supabase/client", () => {
  const dbFrom = vi.fn();
  const storageFrom = vi.fn();
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: dbFrom,
      storage: { from: storageFrom },
    },
  };
});

import { supabase } from "@/infrastructure/supabase/client";

const mockedDbFrom = vi.mocked(supabase.from);
const mockedStorageFrom = vi.mocked(supabase.storage.from);

/**
 * Monta o mock do bucket de storage, expondo os spies de
 * `createSignedUrl` e `getPublicUrl`. Por padrão devolve URLs fixas
 * independentes do path; pode-se sobrescrever via `signedUrlFor` /
 * `publicUrlFor` para devolver URLs distintas por path (usado nos
 * testes do ciclo 3 para verificar que cada path gera sua própria
 * URL e que o branching por tipo (moto/status → public,
 * documento → signed) funciona corretamente).
 */
const buildBucket = (
  signedUrlFor?: (path: string) => string,
  publicUrlFor?: (path: string) => string
) => {
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: {
      signedUrl: signedUrlFor ? signedUrlFor(path) : "https://signed.example/foto.jpg",
    },
    error: null,
  }));
  const getPublicUrl = vi.fn((path: string) => ({
    data: {
      publicUrl: publicUrlFor ? publicUrlFor(path) : "https://public.example/foto.jpg",
    },
  }));
  mockedStorageFrom.mockReturnValue({ createSignedUrl, getPublicUrl } as never);
  return { createSignedUrl, getPublicUrl };
};

/**
 * Constrói o shape cru que o Supabase devolve nas queries de `fotos`.
 * Importante: mantém o formato snake_case do banco para que o mapper
 * interno do repositório seja exercitado de verdade.
 */
const buildFotoRow = (overrides: Record<string, unknown> = {}) => ({
  id: "foto-1",
  entrada_id: "entrada-1",
  url: "user/entrada/moto/foto.jpg",
  tipo: "moto",
  criado_em: "2025-01-01T00:00:00Z",
  ...overrides,
});

/**
 * Helper para montar o mock de um `insert(...).select().single()` do
 * Supabase. Devolve o `insert` spy para que o teste asserte o payload
 * enviado ao `from("fotos")`.
 */
const mockInsertSingle = (row: ReturnType<typeof buildFotoRow>) => {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  mockedDbFrom.mockReturnValueOnce({ insert } as never);
  return { insert, select, single };
};

beforeEach(() => {
  vi.clearAllMocks();
  _clearUrlCache();
});

describe("SupabaseFotoRepository — resolução de URLs (ciclo 3: obterUrlParaFoto)", () => {
  /**
   * Após ciclo 3: o repositório usa `obterUrlParaFoto(path, tipo)` em
   * vez de `obterUrlAssinada` direto. Para `moto`/`status` isso
   * desce até `getPublicUrl` (cache infinito, sem `/sign/...`); para
   * `documento` continua indo até `createSignedUrl` (TTL 1h).
   */

  describe("buscarPorId", () => {
    it("chama getPublicUrl para moto (não createSignedUrl) — bucket público", async () => {
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const row = buildFotoRow({ tipo: "moto", url: "user/entrada/moto/x.jpg" });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorId("foto-1");

      expect(getPublicUrl).toHaveBeenCalledTimes(1);
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/moto/x.jpg");
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("chama getPublicUrl para status (não createSignedUrl)", async () => {
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const row = buildFotoRow({
        tipo: "status",
        url: "user/entrada/status/x.jpg",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorId("foto-1");

      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/status/x.jpg");
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("chama createSignedUrl com (path, 3600) quando a foto é tipo 'documento'", async () => {
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const row = buildFotoRow({
        tipo: "documento",
        url: "user/entrada/documento/x.jpg",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorId("foto-1");

      // Documento mantém signed URL (TTL 1h) — bucket público
      // não se aplica a dados sensíveis (CNH/CRLV).
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/documento/x.jpg",
        3600
      );
      expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
      expect(getPublicUrl).not.toHaveBeenCalled();
    });

    it("não chama createSignedUrl/getPublicUrl quando a URL já é completa (http)", async () => {
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const row = buildFotoRow({
        tipo: "moto",
        url: "https://already-signed.example/foto.jpg",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorId("foto-1");

      expect(createSignedUrl).not.toHaveBeenCalled();
      expect(getPublicUrl).not.toHaveBeenCalled();
    });
  });

  describe("buscarPorEntradaId", () => {
    it("branching por tipo: moto/status → getPublicUrl, documento → createSignedUrl", async () => {
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const rows = [
        buildFotoRow({
          id: "f-1",
          tipo: "moto",
          url: "user/entrada/moto/x.jpg",
        }),
        buildFotoRow({
          id: "f-2",
          tipo: "status",
          url: "user/entrada/status/x.jpg",
          criado_em: "2025-01-02T00:00:00Z",
        }),
        buildFotoRow({
          id: "f-3",
          tipo: "documento",
          url: "user/entrada/documento/x.pdf",
          criado_em: "2025-01-03T00:00:00Z",
        }),
      ];

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorEntradaId("entrada-1");

      // 2 chamadas a getPublicUrl (moto + status) + 1 a createSignedUrl (documento).
      expect(getPublicUrl).toHaveBeenCalledTimes(2);
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/moto/x.jpg");
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/status/x.jpg");
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/documento/x.pdf",
        3600
      );
    });

    it("não chama nada para fotos cuja URL já é completa (http)", async () => {
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const rows = [
        buildFotoRow({
          id: "f-1",
          tipo: "moto",
          url: "user/entrada/moto/x.jpg",
        }),
        buildFotoRow({
          id: "f-2",
          tipo: "moto",
          url: "https://already-signed.example/foto.jpg",
          criado_em: "2025-01-02T00:00:00Z",
        }),
      ];

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorEntradaId("entrada-1");

      // Só a foto com path (moto/x.jpg) precisa resolver → 1 chamada public.
      expect(getPublicUrl).toHaveBeenCalledTimes(1);
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/moto/x.jpg");
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe("buscarPorEntradaIdETipo", () => {
    it("não chama createSignedUrl/getPublicUrl para fotos com URL já completa (http)", async () => {
      // Mata os mutantes em src/infrastructure/repositories/SupabaseFotoRepository.ts:99
      // (ConditionalExpression `if (!foto.url.startsWith("http"))` → `true` e
      // MethodExpression `startsWith("http")` → `endsWith("http")`).
      // Sem este teste, o Stryker considera os mutantes sobreviventes porque
      // o caminho `buscarPorEntradaIdETipo` não tinha cobertura com URL completa.
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const rows = [
        buildFotoRow({
          id: "f-1",
          tipo: "moto",
          url: "https://already-signed.example/foto.jpg",
        }),
      ];

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorEntradaIdETipo(
        "entrada-1",
        "moto"
      );

      // URL já começa com "http" → não deve assinar de novo.
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("chama getPublicUrl para cada foto retornada quando tipo é 'status'", async () => {
      const { createSignedUrl, getPublicUrl } = buildBucket();
      const rows = [
        buildFotoRow({
          id: "f-1",
          tipo: "status",
          url: "user/entrada/status/a.jpg",
        }),
        buildFotoRow({
          id: "f-2",
          tipo: "status",
          url: "user/entrada/status/b.jpg",
          criado_em: "2025-01-02T00:00:00Z",
        }),
      ];

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorEntradaIdETipo(
        "entrada-1",
        "status"
      );

      expect(getPublicUrl).toHaveBeenCalledTimes(2);
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/status/a.jpg");
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/status/b.jpg");
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe("cache de URLs (delegação urlCache via SupabaseStorageApi)", () => {
    /**
     * Verifica o encadeamento: SupabaseFotoRepository → SupabaseStorageApi.obterUrlParaFoto
     * (ciclo 3) → urlCache singleton (ciclo 1). Estes testes provam que o cache
     * cobre os 3 pontos de uso no repositório sem nenhuma duplicação
     * desnecessária.
     */

    /**
     * Helper para montar o mock da query de `buscarPorId` que retorna
     * a mesma row em chamadas consecutivas (cada mockOnce consome uma vez).
     */
    const mockBuscarPorId = (row: ReturnType<typeof buildFotoRow>) => {
      const eqChain = {
        single: vi.fn().mockResolvedValue({ data: row, error: null }),
      };
      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(eqChain),
        }),
      } as never);
    };

    it("chama getPublicUrl uma única vez quando o mesmo path é resolvido em duas buscas sequenciais", async () => {
      const { getPublicUrl } = buildBucket();
      const sharedPath = "user/entrada/moto/shared.jpg";
      mockBuscarPorId(buildFotoRow({ url: sharedPath }));
      mockBuscarPorId(buildFotoRow({ url: sharedPath }));

      const repo = new SupabaseFotoRepository();
      await repo.buscarPorId("foto-1");
      await repo.buscarPorId("foto-1");

      expect(getPublicUrl).toHaveBeenCalledTimes(1);
      expect(getPublicUrl).toHaveBeenCalledWith(sharedPath);
    });

    it("deduplica chamadas paralelas para o mesmo path em buscarPorEntradaId", async () => {
      const { getPublicUrl } = buildBucket();
      const sharedPath = "user/entrada/moto/dup.jpg";
      const rows = [
        buildFotoRow({ id: "f-1", url: sharedPath }),
        buildFotoRow({
          id: "f-2",
          url: sharedPath,
          criado_em: "2025-01-02T00:00:00Z",
        }),
      ];

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorEntradaId("entrada-1");

      // 2 rows com o mesmo path → cache deve deduplicar para 1 chamada
      expect(getPublicUrl).toHaveBeenCalledTimes(1);
    });

    it("chama getPublicUrl novamente para paths distintos (cache hit só para o mesmo path)", async () => {
      const { getPublicUrl } = buildBucket();
      mockBuscarPorId(buildFotoRow({ url: "user/entrada/moto/a.jpg" }));
      mockBuscarPorId(buildFotoRow({ url: "user/entrada/moto/b.jpg" }));

      const repo = new SupabaseFotoRepository();
      await repo.buscarPorId("foto-1");
      await repo.buscarPorId("foto-2");

      expect(getPublicUrl).toHaveBeenCalledTimes(2);
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/moto/a.jpg");
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/moto/b.jpg");
    });
  });
});

describe("SupabaseFotoRepository — persistência e mapeamento de thumbPath/fullPath", () => {
  /**
   * Ciclo 3 do plano .tdd/issue-8.md: o repositório precisa persistir
   * os 2 paths (thumbPath + fullPath) introduzidos pela pipeline de
   * variantes e devolvê-los tipados na Foto. Para fotos legadas
   * (criadas antes da migration 24_split_foto_paths) sem thumb_path/
   * full_path, ambos caem no `url` (já assinado) — preservando a
   * compatibilidade.
   */

  describe("criar", () => {
    it("persiste url, thumb_path e full_path no insert para fotos moto/status", async () => {
      const { insert } = mockInsertSingle(
        buildFotoRow({
          thumb_path: "user/.../thumb.webp",
          full_path: "user/.../full.webp",
        })
      );

      await new SupabaseFotoRepository().criar({
        entradaId: "entrada-1",
        url: "user/.../moto/x.jpg",
        thumbPath: "user/.../thumb.webp",
        fullPath: "user/.../full.webp",
        tipo: "moto",
      });

      expect(insert).toHaveBeenCalledWith({
        entrada_id: "entrada-1",
        url: "user/.../moto/x.jpg",
        thumb_path: "user/.../thumb.webp",
        full_path: "user/.../full.webp",
        tipo: "moto",
      });
    });

    it("persiste thumb_path: null e full_path com o path único para documentos", async () => {
      const { insert } = mockInsertSingle(
        buildFotoRow({
          tipo: "documento",
          url: "user/.../documento/x.pdf",
          thumb_path: null,
          full_path: "user/.../documento/x.pdf",
        })
      );

      await new SupabaseFotoRepository().criar({
        entradaId: "entrada-1",
        url: "user/.../documento/x.pdf",
        thumbPath: null,
        fullPath: "user/.../documento/x.pdf",
        tipo: "documento",
      });

      expect(insert).toHaveBeenCalledWith({
        entrada_id: "entrada-1",
        url: "user/.../documento/x.pdf",
        thumb_path: null,
        full_path: "user/.../documento/x.pdf",
        tipo: "documento",
      });
    });

    it("mapeia thumb_path/full_path do row retornado para Foto.thumbPath/fullPath", async () => {
      mockInsertSingle(
        buildFotoRow({
          thumb_path: "user/.../thumb.webp",
          full_path: "user/.../full.webp",
        })
      );

      const foto = await new SupabaseFotoRepository().criar({
        entradaId: "entrada-1",
        url: "user/.../moto/x.jpg",
        thumbPath: "user/.../thumb.webp",
        fullPath: "user/.../full.webp",
        tipo: "moto",
      });

      expect(foto.thumbPath).toBe("user/.../thumb.webp");
      expect(foto.fullPath).toBe("user/.../full.webp");
    });
  });

  describe("buscarPorId — mapeamento thumbPath/fullPath", () => {
    it("mapeia thumb_path e full_path para Foto.thumbPath e Foto.fullPath (com public URLs distintas) — moto", async () => {
      // Após ciclo 3: moto usa public URL (bucket público).
      buildBucket(
        undefined,
        path => `https://public.example/${path}`
      );
      const row = buildFotoRow({
        thumb_path: "user/.../thumb.webp",
        full_path: "user/.../full.webp",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      const foto = await new SupabaseFotoRepository().buscarPorId("foto-1");

      expect(foto).not.toBeNull();
      expect(foto!.thumbPath).toBe("https://public.example/user/.../thumb.webp");
      expect(foto!.fullPath).toBe("https://public.example/user/.../full.webp");
    });

    it("cai na public URL para thumbPath e fullPath em foto legada (thumb_path/full_path null)", async () => {
      const { getPublicUrl } = buildBucket();
      const row = buildFotoRow({
        url: "user/.../legacy.jpg",
        thumb_path: null,
        full_path: null,
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      const foto = await new SupabaseFotoRepository().buscarPorId("foto-1");

      // O thumb/full legado aponta para a MESMA public URL do url.
      expect(getPublicUrl).toHaveBeenCalledTimes(1);
      expect(foto!.thumbPath).toBe("https://public.example/foto.jpg");
      expect(foto!.fullPath).toBe("https://public.example/foto.jpg");
    });

    it("solicita public URL também para thumb_path e full_path quando são paths (não http)", async () => {
      const { getPublicUrl } = buildBucket();
      const row = buildFotoRow({
        thumb_path: "user/.../thumb.webp",
        full_path: "user/.../full.webp",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorId("foto-1");

      // 3 chamadas public: url + thumb_path + full_path.
      expect(getPublicUrl).toHaveBeenCalledTimes(3);
      expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/moto/foto.jpg");
      expect(getPublicUrl).toHaveBeenCalledWith("user/.../thumb.webp");
      expect(getPublicUrl).toHaveBeenCalledWith("user/.../full.webp");
    });
  });

  describe("buscarPorEntradaId — mapeamento thumbPath/fullPath", () => {
    it("mapeia thumb_path/full_path para cada foto retornada (moto → public URLs)", async () => {
      buildBucket(
        undefined,
        path => `https://public.example/${path}`
      );
      const rows = [
        buildFotoRow({
          id: "f-1",
          tipo: "moto",
          url: "user/entrada/moto/a.jpg",
          thumb_path: "user/.../t1.webp",
          full_path: "user/.../p1.webp",
        }),
        buildFotoRow({
          id: "f-2",
          tipo: "moto",
          url: "user/entrada/moto/legacy.jpg",
          thumb_path: null,
          full_path: null,
          criado_em: "2025-01-02T00:00:00Z",
        }),
      ];

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      } as never);

      const fotos = await new SupabaseFotoRepository().buscarPorEntradaId(
        "entrada-1"
      );

      expect(fotos).toHaveLength(2);
      expect(fotos[0].thumbPath).toBe("https://public.example/user/.../t1.webp");
      expect(fotos[0].fullPath).toBe("https://public.example/user/.../p1.webp");
      // Foto legada: thumb e full caem na public URL do url.
      expect(fotos[1].thumbPath).toBe("https://public.example/user/entrada/moto/legacy.jpg");
      expect(fotos[1].fullPath).toBe("https://public.example/user/entrada/moto/legacy.jpg");
    });
  });

  describe("buscarPorId — paths já completos (http) em thumbPath/fullPath", () => {
    it("não chama getPublicUrl para thumbPath que já é URL completa (http)", async () => {
      // Mata os mutantes em src/infrastructure/repositories/SupabaseFotoRepository.ts:139
      // (ConditionalExpression `if (path.startsWith("http"))` → `if (false)` e
      // MethodExpression `startsWith("http")` → `endsWith("http")`).
      // Sem este teste, ambos os mutantes sobrevivem porque o caminho com
      // URL completa só era exercitado para o `url` (não para
      // thumbPath/fullPath).
      const { getPublicUrl } = buildBucket();
      const row = buildFotoRow({
        url: "user/.../legacy.jpg",
        thumb_path: "https://already-public.example/thumb.jpg",
        full_path: "https://already-public.example/full.jpg",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      const foto = await new SupabaseFotoRepository().buscarPorId("foto-1");

      // Só o `url` (path cru) é resolvido via public URL; thumb_path/
      // full_path já são URLs completas e voltam intactas.
      expect(getPublicUrl).toHaveBeenCalledTimes(1);
      expect(getPublicUrl).toHaveBeenCalledWith("user/.../legacy.jpg");
      expect(foto).not.toBeNull();
      expect(foto!.thumbPath).toBe("https://already-public.example/thumb.jpg");
      expect(foto!.fullPath).toBe("https://already-public.example/full.jpg");
    });

    it("não chama getPublicUrl para thumbPath que termina com http (anti endsWith)", async () => {
      // Mata o mutante `startsWith("http")` → `endsWith("http")`:
      // um path cru como "user/.../xhttp" terminaria com "http" e o
      // mutante o devolveria intacto (skipando a resolução).
      // O original `startsWith("http")` exige que o path COMECE com
      // "http" — então resolve normalmente.
      const { getPublicUrl } = buildBucket();
      const row = buildFotoRow({
        url: "user/.../outro.jpg",
        thumb_path: "user/.../thumbxhttp", // termina com "http" mas não começa
        full_path: "user/.../fullxhttp",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      const foto = await new SupabaseFotoRepository().buscarPorId("foto-1");

      // O `url` + os 2 paths devem ser resolvidos (3 chamadas) — nenhum
      // começa com "http", então o original trata todos como paths crus.
      // Com o mutante `endsWith`, os dois paths terminam com "http" e
      // seriam devolvidos intactos (apenas 1 chamada para `url`).
      expect(getPublicUrl).toHaveBeenCalledTimes(3);
      expect(getPublicUrl).toHaveBeenCalledWith("user/.../thumbxhttp");
      expect(getPublicUrl).toHaveBeenCalledWith("user/.../fullxhttp");
      expect(foto).not.toBeNull();
    });
  });

  describe("buscarPorEntradaIdETipo — mapeamento thumbPath/fullPath", () => {
    it("mapeia thumb_path/full_path para cada foto retornada (status → public URLs)", async () => {
      buildBucket(
        undefined,
        path => `https://public.example/${path}`
      );
      const rows = [
        buildFotoRow({
          id: "f-1",
          tipo: "status",
          url: "user/entrada/status/a.jpg",
          thumb_path: "user/.../t1.webp",
          full_path: "user/.../p1.webp",
        }),
        buildFotoRow({
          id: "f-2",
          tipo: "status",
          url: "user/entrada/status/legacy.jpg",
          thumb_path: null,
          full_path: null,
          criado_em: "2025-01-02T00:00:00Z",
        }),
      ];

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      } as never);

      const fotos = await new SupabaseFotoRepository().buscarPorEntradaIdETipo(
        "entrada-1",
        "status"
      );

      expect(fotos).toHaveLength(2);
      expect(fotos[0].thumbPath).toBe("https://public.example/user/.../t1.webp");
      expect(fotos[0].fullPath).toBe("https://public.example/user/.../p1.webp");
      expect(fotos[1].thumbPath).toBe("https://public.example/user/entrada/status/legacy.jpg");
      expect(fotos[1].fullPath).toBe("https://public.example/user/entrada/status/legacy.jpg");
    });
  });
});
