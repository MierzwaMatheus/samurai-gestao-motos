import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";

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
 */
const buildBucket = () => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.example/foto.jpg" },
    error: null,
  });
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

beforeEach(() => {
  vi.clearAllMocks();
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
});
