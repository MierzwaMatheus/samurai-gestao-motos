import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";

// Mock do cliente Supabase: precisamos controlar o retorno de
// `auth.getUser` (para passar pela checagem de autenticação) e do
// `storage.from("fotos").upload` (para observar os `opts` passados).
vi.mock("@/infrastructure/supabase/client", () => {
  const upload = vi.fn().mockResolvedValue({ data: { path: "stub" }, error: null });
  const from = vi.fn().mockReturnValue({ upload });
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

// Importações após o mock para garantir que o módulo mockado seja usado.
import { supabase } from "@/infrastructure/supabase/client";

const mockedFrom = vi.mocked(supabase.storage.from);
const mockedUpload = vi.fn().mockResolvedValue({ data: { path: "stub" }, error: null });

const buildFile = (): File =>
  new File(["conteudo-de-teste"], "foto.jpg", { type: "image/jpeg" });

describe("SupabaseStorageApi.uploadFoto", () => {
  let api: SupabaseStorageApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedFrom.mockReturnValue({ upload: mockedUpload } as never);
    api = new SupabaseStorageApi();
  });

  it('faz upload apontando para o bucket "fotos"', async () => {
    await api.uploadFoto(buildFile(), "entrada-1", "moto");

    expect(mockedFrom).toHaveBeenCalledWith("fotos");
  });

  it('envia opts com cacheControl "2592000" (30 dias) e upsert true', async () => {
    await api.uploadFoto(buildFile(), "entrada-1", "moto");

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [, , opts] = mockedUpload.mock.calls[0] as [
      string,
      File,
      { cacheControl?: string; upsert?: boolean },
    ];

    expect(opts.cacheControl).toBe("2592000");
    expect(opts.upsert).toBe(true);
  });
});