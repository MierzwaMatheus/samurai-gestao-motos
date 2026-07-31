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

// Mock da compressão no browser: `browser-image-compression` depende de
// Canvas/Web Worker, indisponíveis no ambiente de teste. Observamos apenas
// os argumentos recebidos e devolvemos um `File` distinto do original.
vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

// Importações após o mock para garantir que o módulo mockado seja usado.
import { supabase } from "@/infrastructure/supabase/client";
import imageCompression from "browser-image-compression";

const mockedFrom = vi.mocked(supabase.storage.from);
const mockedCompression = vi.mocked(imageCompression);

const buildFile = (): File =>
  new File(["conteudo-de-teste"], "foto.jpg", { type: "image/jpeg" });

/** Arquivo acima do limite de 5 MB, usado para exercitar o sanity check. */
const buildFileGrande = (): File =>
  new File([new ArrayBuffer(6 * 1024 * 1024)], "grande.jpg", {
    type: "image/jpeg",
  });

/** `File` devolvido pelo mock de compressão — identidade distinta do original. */
const buildFileComprimido = (): File =>
  new File(["comprimido"], "foto.webp", { type: "image/webp" });

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

  const comprimido = buildFileComprimido();
  mockedCompression.mockResolvedValue(comprimido);
  mockedFrom.mockReturnValue({ upload, createSignedUrl } as never);

  return { upload, createSignedUrl, comprimido, api: new SupabaseStorageApi() };
};

beforeEach(() => {
  vi.clearAllMocks();
});

/** Arquivo exatamente no limite (5 MB) — testa o boundary `>` vs `>=`. */
const buildFileExato = (): File =>
  new File([new ArrayBuffer(5 * 1024 * 1024)], "limite.jpg", {
    type: "image/jpeg",
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

  it("lança erro quando não há usuário autenticado", async () => {
    const { api } = buildBucket();
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);

    await expect(
      api.uploadFoto(buildFile(), "entrada-1", "moto")
    ).rejects.toThrow("Usuário não autenticado");
  });

  it("lança erro quando o tipo MIME não é permitido", async () => {
    const { api, upload } = buildBucket();
    const arquivoTexto = new File(["oi"], "nota.txt", { type: "text/plain" });

    await expect(
      api.uploadFoto(arquivoTexto, "entrada-1", "documento")
    ).rejects.toThrow(
      "Tipo de arquivo não permitido. Use JPEG, PNG, WEBP ou GIF."
    );

    expect(upload).not.toHaveBeenCalled();
  });

  it("aceita arquivo exatamente no limite de 5 MB (boundary `>`)", async () => {
    // Stryker muta `file.size > maxSize` para `file.size >= maxSize`.
    // Um arquivo de exatamente 5 MB passa no original (5 MB > 5 MB = false)
    // mas falharia no mutante (5 MB >= 5 MB = true → rejeita).
    const { api, upload } = buildBucket();

    await expect(
      api.uploadFoto(buildFileExato(), "entrada-1", "documento")
    ).resolves.toBeDefined();

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("lança erro quando o Supabase devolve erro no upload", async () => {
    // Stryker muta `if (error)` para `if (false)` — sem esse teste o
    // mutante sobrevive (testes existentes não observam falha).
    mockedFrom.mockReturnValue({
      upload: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "quota excedida" } }),
      createSignedUrl: vi.fn(),
    } as never);

    const api = new SupabaseStorageApi();

    await expect(
      api.uploadFoto(buildFile(), "entrada-1", "moto")
    ).rejects.toThrow("Erro ao fazer upload: quota excedida");
  });
});

describe("SupabaseStorageApi.uploadFoto — compressão no browser", () => {
  it('comprime a foto de tipo "moto" antes de enviar', async () => {
    const { api } = buildBucket();
    const original = buildFile();

    await api.uploadFoto(original, "entrada-1", "moto");

    expect(mockedCompression).toHaveBeenCalledTimes(1);
    expect(mockedCompression).toHaveBeenCalledWith(original, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/webp",
    });
  });

  it('comprime a foto de tipo "status" com as mesmas opções', async () => {
    const { api } = buildBucket();
    const original = buildFile();

    await api.uploadFoto(original, "entrada-1", "status");

    expect(mockedCompression).toHaveBeenCalledTimes(1);
    expect(mockedCompression).toHaveBeenCalledWith(original, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/webp",
    });
  });

  it('não comprime arquivos de tipo "documento"', async () => {
    const { api } = buildBucket();

    await api.uploadFoto(buildFile(), "entrada-1", "documento");

    expect(mockedCompression).not.toHaveBeenCalled();
  });

  it("envia ao Supabase o arquivo comprimido, não o original", async () => {
    const { api, upload, comprimido } = buildBucket();
    const original = buildFile();

    await api.uploadFoto(original, "entrada-1", "moto");

    const [, enviado] = upload.mock.calls[0] as [string, File];
    expect(enviado).toBe(comprimido);
    expect(enviado).not.toBe(original);
  });

  it('envia o arquivo original quando o tipo é "documento"', async () => {
    const { api, upload } = buildBucket();
    const original = buildFile();

    await api.uploadFoto(original, "entrada-1", "documento");

    const [, enviado] = upload.mock.calls[0] as [string, File];
    expect(enviado).toBe(original);
  });

  it("valida o tamanho de 5 MB antes de comprimir (sanity check)", async () => {
    const { api, upload } = buildBucket();

    await expect(
      api.uploadFoto(buildFileGrande(), "entrada-1", "moto")
    ).rejects.toThrow("Arquivo muito grande. Tamanho máximo: 5MB.");

    expect(mockedCompression).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
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

  it("não envia o 3º argumento de opções (Image Transformations é Pro-only)", async () => {
    const { api, createSignedUrl } = buildBucket();

    await api.obterUrlAssinada("user/entrada/moto/foto.jpg");

    // Após a reversão: nenhuma opção é enviada. O 3º arg não existe
    // mesmo na assinatura da interface.
    expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
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
