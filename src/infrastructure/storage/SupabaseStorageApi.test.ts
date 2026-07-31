import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";

// Mock do cliente Supabase: precisamos controlar o retorno de
// `auth.getUser` (para passar pela checagem de autenticação) e do
// `storage.from("fotos")` (para observar os argumentos de `upload` e
// `createSignedUrl`).
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

// Importações após o mock para garantir que o módulo mockado seja usado.
import { supabase } from "@/infrastructure/supabase/client";

const mockedFrom = vi.mocked(supabase.storage.from);

const buildFile = (): File =>
  new File(["conteudo-de-teste"], "foto.jpg", { type: "image/jpeg" });

/**
 * Monta o duplo de teste do bucket. Retorna os spies para que cada teste
 * observe exatamente os argumentos recebidos, sem estado compartilhado.
 */
const buildBucket = (
  overrides: {
    signedUrlResult?: { data: unknown; error: unknown };
  } = {}
) => {
  const upload = vi
    .fn()
    .mockResolvedValue({ data: { path: "stub" }, error: null });
  const createSignedUrl = vi.fn().mockResolvedValue(
    overrides.signedUrlResult ?? {
      data: { signedUrl: "https://signed.example/foto.jpg" },
      error: null,
    }
  );

  mockedFrom.mockReturnValue({ upload, createSignedUrl } as never);

  return { upload, createSignedUrl, api: new SupabaseStorageApi() };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SupabaseStorageApi.uploadFoto", () => {
  it('faz upload apontando para o bucket "fotos"', async () => {
    const { api } = buildBucket();

    await api.uploadFoto(buildFile(), "entrada-1", "moto");

    expect(mockedFrom).toHaveBeenCalledWith("fotos");
  });

  it('envia opts com cacheControl "2592000" (30 dias) e upsert true', async () => {
    const { api, upload } = buildBucket();

    await api.uploadFoto(buildFile(), "entrada-1", "moto");

    expect(upload).toHaveBeenCalledTimes(1);
    const [, , opts] = upload.mock.calls[0] as [
      string,
      File,
      { cacheControl?: string; upsert?: boolean },
    ];

    expect(opts.cacheControl).toBe("2592000");
    expect(opts.upsert).toBe(true);
  });
});

describe("SupabaseStorageApi.obterUrlAssinada", () => {
  it('gera a URL assinada no bucket "fotos"', async () => {
    const { api } = buildBucket();

    await api.obterUrlAssinada("user/entrada/moto/foto.jpg");

    expect(mockedFrom).toHaveBeenCalledWith("fotos");
  });

  it("retorna a signedUrl devolvida pelo Supabase", async () => {
    const { api } = buildBucket();

    const url = await api.obterUrlAssinada("user/entrada/moto/foto.jpg");

    expect(url).toBe("https://signed.example/foto.jpg");
  });

  it("usa expiresIn padrão de 3600 segundos quando não informado", async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.obterUrlAssinada("user/entrada/moto/foto.jpg");

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/foto.jpg",
      3600
    );
  });

  it("repassa o expiresIn informado", async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.obterUrlAssinada("user/entrada/moto/foto.jpg", 7200);

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/foto.jpg",
      7200
    );
  });

  it("não envia o 3º argumento de opções quando transform não é informado", async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.obterUrlAssinada("user/entrada/moto/foto.jpg");

    // Comportamento atual preservado: sem transform, a chamada tem
    // exatamente 2 argumentos — nem mesmo `{ transform: undefined }`.
    expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
  });

  it("repassa o transform dentro de options quando informado", async () => {
    const { api, createSignedUrl } = buildBucket();

    // `format` é omitido de propósito: é assim que o Supabase serve WebP
    // automaticamente. Passar `format: "webp"` não existe na API.
    await api.obterUrlAssinada("user/entrada/moto/foto.jpg", 3600, {
      width: 400,
      height: 400,
      resize: "cover",
      quality: 70,
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/foto.jpg",
      3600,
      {
        transform: {
          width: 400,
          height: 400,
          resize: "cover",
          quality: 70,
        },
      }
    );
  });

  it('repassa format "origin" quando se quer desligar a otimização', async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.obterUrlAssinada("user/entrada/documento/doc.jpg", 3600, {
      format: "origin",
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/documento/doc.jpg",
      3600,
      { transform: { format: "origin" } }
    );
  });

  it("lança erro quando o Supabase falha ao gerar a URL", async () => {
    const { api } = buildBucket({
      signedUrlResult: { data: null, error: { message: "objeto não existe" } },
    });

    await expect(
      api.obterUrlAssinada("user/entrada/moto/inexistente.jpg")
    ).rejects.toThrow("Erro ao gerar URL assinada: objeto não existe");
  });
});

describe("SupabaseStorageApi.criarSignedUrlComTransform", () => {
  it("aplica transformPorTipo('moto') e expiresIn de 30 dias (2592000s)", async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.criarSignedUrlComTransform(
      "user/entrada/moto/foto.jpg",
      "moto"
    );

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/foto.jpg",
      2592000,
      {
        transform: {
          width: 400,
          height: 400,
          resize: "cover",
          quality: 70,
        },
      }
    );
  });

  it("aplica transformPorTipo('status') e expiresIn de 30 dias", async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.criarSignedUrlComTransform(
      "user/entrada/status/status.jpg",
      "status"
    );

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/status/status.jpg",
      2592000,
      {
        transform: {
          width: 400,
          quality: 70,
        },
      }
    );
  });

  it("omite o 3º argumento de opções para 'documento' (transform undefined)", async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.criarSignedUrlComTransform(
      "user/entrada/documento/doc.pdf",
      "documento"
    );

    // `transformPorTipo('documento')` devolve `undefined`, e o wrapper
    // propaga isso ao `obterUrlAssinada`, que por sua vez omite o 3º
    // argumento da chamada ao Supabase — sem `transform: undefined`.
    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/documento/doc.pdf",
      2592000
    );
    expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
  });

  it("retorna a signedUrl devolvida pelo Supabase", async () => {
    const { api } = buildBucket();

    const url = await api.criarSignedUrlComTransform(
      "user/entrada/moto/foto.jpg",
      "moto"
    );

    expect(url).toBe("https://signed.example/foto.jpg");
  });

  it("propaga erros do Supabase ao gerar a URL", async () => {
    const { api } = buildBucket({
      signedUrlResult: {
        data: null,
        error: { message: "objeto não existe" },
      },
    });

    await expect(
      api.criarSignedUrlComTransform("user/entrada/moto/x.jpg", "moto")
    ).rejects.toThrow("Erro ao gerar URL assinada: objeto não existe");
  });
});
