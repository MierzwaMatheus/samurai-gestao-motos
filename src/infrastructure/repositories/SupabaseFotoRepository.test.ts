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
 * Monta o mock do bucket de storage, expondo o spy de `createSignedUrl`.
 * Por padrão devolve uma URL fixa independente do path; pode-se
 * sobrescrever via `signedUrlFor` para devolver uma URL distinta por
 * path (usado nos testes do ciclo 3 para verificar que cada path
 * gera sua própria signed URL).
 */
const buildBucket = (signedUrlFor?: (path: string) => string) => {
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: {
      signedUrl: signedUrlFor ? signedUrlFor(path) : "https://signed.example/foto.jpg",
    },
    error: null,
  }));
  mockedStorageFrom.mockReturnValue({ createSignedUrl } as never);
  return { createSignedUrl };
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

describe("SupabaseFotoRepository — geração de signed URLs", () => {
  describe("buscarPorId", () => {
    it("chama createSignedUrl com (path, 3600) quando a foto é tipo 'moto'", async () => {
      const { createSignedUrl } = buildBucket();
      const row = buildFotoRow({ tipo: "moto", url: "user/entrada/moto/x.jpg" });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      await new SupabaseFotoRepository().buscarPorId("foto-1");

      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/x.jpg",
        3600
      );
    });

    it("chama createSignedUrl com (path, 3600) quando a foto é tipo 'status'", async () => {
      const { createSignedUrl } = buildBucket();
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

      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/status/x.jpg",
        3600
      );
    });

    it("chama createSignedUrl com (path, 3600) quando a foto é tipo 'documento'", async () => {
      const { createSignedUrl } = buildBucket();
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

      // Após a reversão: independentemente do tipo, a chamada ao Supabase
      // é sempre `(path, 3600)` — sem 3º argumento de opções.
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/documento/x.jpg",
        3600
      );
      expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
    });

    it("não chama createSignedUrl quando a URL já é completa (http)", async () => {
      const { createSignedUrl } = buildBucket();
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
    });
  });

  describe("buscarPorEntradaId", () => {
    it("chama createSignedUrl com (path, 3600) para cada foto, independente do tipo", async () => {
      const { createSignedUrl } = buildBucket();
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

      expect(createSignedUrl).toHaveBeenCalledTimes(3);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/x.jpg",
        3600
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/status/x.jpg",
        3600
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/documento/x.pdf",
        3600
      );
    });

    it("não chama createSignedUrl para fotos cuja URL já é completa (http)", async () => {
      const { createSignedUrl } = buildBucket();
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

      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/x.jpg",
        3600
      );
    });
  });

  describe("buscarPorEntradaIdETipo", () => {
    it("não chama createSignedUrl para fotos com URL já completa (http)", async () => {
      // Mata os mutantes em src/infrastructure/repositories/SupabaseFotoRepository.ts:99
      // (ConditionalExpression `if (!foto.url.startsWith("http"))` → `true` e
      // MethodExpression `startsWith("http")` → `endsWith("http")`).
      // Sem este teste, o Stryker considera os mutantes sobreviventes porque
      // o caminho `buscarPorEntradaIdETipo` não tinha cobertura com URL completa.
      const { createSignedUrl } = buildBucket();
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

    it("chama createSignedUrl com (path, 3600) para cada foto retornada", async () => {
      const { createSignedUrl } = buildBucket();
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

      expect(createSignedUrl).toHaveBeenCalledTimes(2);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/status/a.jpg",
        3600
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/status/b.jpg",
        3600
      );
    });
  });

  describe("cache de signed URLs (delegação urlCache via SupabaseStorageApi)", () => {
    /**
     * Verifica o encadeamento: SupabaseFotoRepository → SupabaseStorageApi.obterUrlAssinada
     * (ciclo 2) → urlCache singleton (ciclo 1). Estes testes provam que o cache
     * cobre os 3 pontos de uso no repositório (linhas 50, 73, 100) sem
     * nenhuma duplicação desnecessária.
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

    it("chama createSignedUrl uma única vez quando o mesmo path é resolvido em duas buscas sequenciais", async () => {
      const { createSignedUrl } = buildBucket();
      const sharedPath = "user/entrada/moto/shared.jpg";
      mockBuscarPorId(buildFotoRow({ url: sharedPath }));
      mockBuscarPorId(buildFotoRow({ url: sharedPath }));

      const repo = new SupabaseFotoRepository();
      await repo.buscarPorId("foto-1");
      await repo.buscarPorId("foto-1");

      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(createSignedUrl).toHaveBeenCalledWith(sharedPath, 3600);
    });

    it("deduplica chamadas paralelas para o mesmo path em buscarPorEntradaId", async () => {
      const { createSignedUrl } = buildBucket();
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
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    it("chama createSignedUrl novamente para paths distintos (cache hit só para o mesmo path)", async () => {
      const { createSignedUrl } = buildBucket();
      mockBuscarPorId(buildFotoRow({ url: "user/entrada/moto/a.jpg" }));
      mockBuscarPorId(buildFotoRow({ url: "user/entrada/moto/b.jpg" }));

      const repo = new SupabaseFotoRepository();
      await repo.buscarPorId("foto-1");
      await repo.buscarPorId("foto-2");

      expect(createSignedUrl).toHaveBeenCalledTimes(2);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/a.jpg",
        3600
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/b.jpg",
        3600
      );
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
    it("mapeia thumb_path e full_path para Foto.thumbPath e Foto.fullPath (com signed URLs distintas)", async () => {
      buildBucket(path => `https://signed.example/${path}`);
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
      expect(foto!.thumbPath).toBe("https://signed.example/user/.../thumb.webp");
      expect(foto!.fullPath).toBe("https://signed.example/user/.../full.webp");
    });

    it("cai no signed URL para thumbPath e fullPath em foto legada (thumb_path/full_path null)", async () => {
      const { createSignedUrl } = buildBucket();
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

      // O thumb/full legado aponta para o MESMO signed URL do url.
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(foto!.thumbPath).toBe("https://signed.example/foto.jpg");
      expect(foto!.fullPath).toBe("https://signed.example/foto.jpg");
    });

    it("solicita signed URL também para thumb_path e full_path quando são paths (não http)", async () => {
      const { createSignedUrl } = buildBucket();
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

      // Chamadas separadas para cada path distinto (url + thumb_path + full_path).
      expect(createSignedUrl).toHaveBeenCalledTimes(3);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/foto.jpg",
        3600
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/.../thumb.webp",
        3600
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/.../full.webp",
        3600
      );
    });
  });

  describe("buscarPorEntradaId — mapeamento thumbPath/fullPath", () => {
    it("mapeia thumb_path/full_path para cada foto retornada", async () => {
      buildBucket(path => `https://signed.example/${path}`);
      const rows = [
        buildFotoRow({
          id: "f-1",
          url: "user/entrada/moto/a.jpg",
          thumb_path: "user/.../t1.webp",
          full_path: "user/.../p1.webp",
        }),
        buildFotoRow({
          id: "f-2",
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
      expect(fotos[0].thumbPath).toBe("https://signed.example/user/.../t1.webp");
      expect(fotos[0].fullPath).toBe("https://signed.example/user/.../p1.webp");
      // Foto legada: thumb e full caem no signed URL do url.
      expect(fotos[1].thumbPath).toBe("https://signed.example/user/entrada/moto/legacy.jpg");
      expect(fotos[1].fullPath).toBe("https://signed.example/user/entrada/moto/legacy.jpg");
    });
  });

  describe("buscarPorId — paths já completos (http) em thumbPath/fullPath", () => {
    it("não chama createSignedUrl para thumbPath que já é URL completa (http)", async () => {
      // Mata os mutantes em src/infrastructure/repositories/SupabaseFotoRepository.ts:139
      // (ConditionalExpression `if (path.startsWith("http"))` → `if (false)` e
      // MethodExpression `startsWith("http")` → `endsWith("http")`).
      // Sem este teste, ambos os mutantes sobrevivem porque o caminho com
      // URL completa só era exercitado para o `url` (não para
      // thumbPath/fullPath).
      const { createSignedUrl } = buildBucket();
      const row = buildFotoRow({
        url: "user/.../legacy.jpg",
        thumb_path: "https://already-signed.example/thumb.jpg",
        full_path: "https://already-signed.example/full.jpg",
      });

      mockedDbFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
      } as never);

      const foto = await new SupabaseFotoRepository().buscarPorId("foto-1");

      // Só o `url` (path cru) é assinado; thumb_path/full_path já são
      // URLs completas e voltam intactas.
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(createSignedUrl).toHaveBeenCalledWith("user/.../legacy.jpg", 3600);
      expect(foto).not.toBeNull();
      expect(foto!.thumbPath).toBe("https://already-signed.example/thumb.jpg");
      expect(foto!.fullPath).toBe("https://already-signed.example/full.jpg");
    });

    it("não chama createSignedUrl para thumbPath que termina com http (anti endsWith)", async () => {
      // Mata o mutante `startsWith("http")` → `endsWith("http")`:
      // um path cru como "user/.../xhttp" terminaria com "http" e o
      // mutante o devolveria intacto (skipando a assinatura).
      // O original `startsWith("http")` exige que o path COMECE com
      // "http" — então assina normalmente.
      const { createSignedUrl } = buildBucket();
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

      // O `url` + os 2 paths devem ser assinados (3 chamadas) — nenhum
      // começa com "http", então o original trata todos como paths crus.
      // Com o mutante `endsWith`, os dois paths terminam com "http" e
      // seriam devolvidos intactos (apenas 1 chamada para `url`).
      expect(createSignedUrl).toHaveBeenCalledTimes(3);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/.../thumbxhttp",
        3600
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/.../fullxhttp",
        3600
      );
      expect(foto).not.toBeNull();
    });
  });

  describe("buscarPorEntradaIdETipo — mapeamento thumbPath/fullPath", () => {
    it("mapeia thumb_path/full_path para cada foto retornada", async () => {
      buildBucket(path => `https://signed.example/${path}`);
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
      expect(fotos[0].thumbPath).toBe("https://signed.example/user/.../t1.webp");
      expect(fotos[0].fullPath).toBe("https://signed.example/user/.../p1.webp");
      expect(fotos[1].thumbPath).toBe("https://signed.example/user/entrada/status/legacy.jpg");
      expect(fotos[1].fullPath).toBe("https://signed.example/user/entrada/status/legacy.jpg");
    });
  });
});
