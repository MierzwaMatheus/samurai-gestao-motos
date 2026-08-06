import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { _clearUrlCache } from "@/infrastructure/storage/urlCache";
import { _clearEspacoBucketCache } from "@/infrastructure/storage/espacoBucketCache";

// Mock do cliente Supabase: precisamos controlar o retorno de
// `auth.getUser` (para passar pela checagem de autenticação) e do
// `storage.from("fotos")` (para observar os argumentos de `upload` e
// `createSignedUrl`).
vi.mock("@/infrastructure/supabase/client", () => {
  const from = vi.fn();
  const invoke = vi.fn();
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: "user-test" } },
    error: null,
  });
  return {
    supabase: {
      auth: { getUser },
      storage: { from },
      functions: { invoke },
    },
  };
});

// Mock do módulo `imageVariants`: `gerarVariantes` depende de
// Canvas/`createImageBitmap` (indisponíveis em jsdom). Substituímos por
// um dublê que devolve dois `File` distintos para thumb e full,
// permitindo observar separadamente cada upload.
vi.mock("@/infrastructure/storage/imageVariants", async () => {
  const actual = await vi.importActual<
    typeof import("@/infrastructure/storage/imageVariants")
  >("@/infrastructure/storage/imageVariants");
  const thumbStub = new File(["thumb-stub"], "thumb.webp", {
    type: "image/webp",
  });
  const fullStub = new File(["full-stub"], "full.webp", {
    type: "image/webp",
  });
  return {
    ...actual,
    gerarVariantes: vi.fn(async () => ({ thumb: thumbStub, full: fullStub })),
  };
});

// Importações após o mock para garantir que o módulo mockado seja usado.
import { supabase } from "@/infrastructure/supabase/client";
import { gerarVariantes } from "@/infrastructure/storage/imageVariants";

const mockedFrom = vi.mocked(supabase.storage.from);
const mockedInvoke = vi.mocked(supabase.functions.invoke);
const mockedGerarVariantes = vi.mocked(gerarVariantes);

const buildFile = (): File =>
  new File(["conteudo-de-teste"], "foto.jpg", { type: "image/jpeg" });

/** Arquivo acima do limite de 5 MB, usado para exercitar o sanity check. */
const buildFileGrande = (): File =>
  new File([new ArrayBuffer(6 * 1024 * 1024)], "grande.jpg", {
    type: "image/jpeg",
  });

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
  _clearUrlCache();
  _clearEspacoBucketCache();
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

  it('envia opts com cacheControl "2592000" (30 dias) e upsert true para documento', async () => {
    // Documento é o único caminho com 1 upload — observa o primeiro (e
    // único) call diretamente. Moto/Status são cobertos no bloco
    // `pipeline de 2 variantes`.
    const { api, upload } = buildBucket();

    await api.uploadFoto(buildFile(), "entrada-1", "documento");

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

  it("lança erro quando o Supabase devolve erro no upload (documento)", async () => {
    // Stryker muta `if (error)` para `if (false)` — sem esse teste o
    // mutante sobrevive (testes existentes não observam falha). Usamos
    // `documento` para isolar o caminho de 1 upload; moto/Status com 2
    // uploads é coberto no bloco do pipeline.
    mockedFrom.mockReturnValue({
      upload: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "quota excedida" } }),
      createSignedUrl: vi.fn(),
    } as never);

    const api = new SupabaseStorageApi();

    await expect(
      api.uploadFoto(buildFile(), "entrada-1", "documento")
    ).rejects.toThrow("Erro ao fazer upload: quota excedida");
  });
});

describe("SupabaseStorageApi.obterUrlParaFoto", () => {
  /**
   * Monta o duplo de teste do bucket com `getPublicUrl` e
   * `createSignedUrl` separáveis. Para o teste de `obterUrlParaFoto`
   * é essencial mockar as duas, porque o helper faz branch por tipo:
   * `moto`/`status` → `getPublicUrl` (cache infinito);
   * `documento` → `createSignedUrl` (TTL 1h).
   */
  const buildBucketComPublicUrl = (
    overrides: {
      publicUrl?: string;
      signedUrl?: string;
    } = {}
  ) => {
    const upload = vi.fn();
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: overrides.signedUrl ?? "https://signed.example/foto.jpg" },
      error: null,
    });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: overrides.publicUrl ?? "https://public.example/foto.jpg" },
    });
    mockedFrom.mockReturnValue({
      upload,
      createSignedUrl,
      getPublicUrl,
    } as never);

    return { upload, createSignedUrl, getPublicUrl, api: new SupabaseStorageApi() };
  };

  it("retorna public URL (via getPublicUrl) para tipo 'moto'", async () => {
    const { api, getPublicUrl, createSignedUrl } = buildBucketComPublicUrl();

    const url = await api.obterUrlParaFoto("user/entrada/moto/foto.jpg", "moto");

    expect(url).toBe("https://public.example/foto.jpg");
    expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/moto/foto.jpg");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("retorna public URL (via getPublicUrl) para tipo 'status'", async () => {
    const { api, getPublicUrl, createSignedUrl } = buildBucketComPublicUrl();

    const url = await api.obterUrlParaFoto(
      "user/entrada/status/foto.jpg",
      "status"
    );

    expect(url).toBe("https://public.example/foto.jpg");
    expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/status/foto.jpg");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("retorna signed URL (via createSignedUrl) para tipo 'documento'", async () => {
    const { api, getPublicUrl, createSignedUrl } = buildBucketComPublicUrl();

    const url = await api.obterUrlParaFoto(
      "user/entrada/documento/cnh.jpg",
      "documento"
    );

    expect(url).toBe("https://signed.example/foto.jpg");
    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/documento/cnh.jpg",
      3600
    );
    expect(getPublicUrl).not.toHaveBeenCalled();
  });

  it("retorna a mesma public URL em chamadas repetidas para o mesmo path (moto)", async () => {
    // Stryker muta o branch por tipo. Sem esse teste, um mutante que
    // sempre chama createSignedUrl sobrevive — moto passa a ser
    // assinada e o TTL de 1h vaza.
    const { api, getPublicUrl } = buildBucketComPublicUrl();

    const url1 = await api.obterUrlParaFoto("user/e/moto/f.jpg", "moto");
    const url2 = await api.obterUrlParaFoto("user/e/moto/f.jpg", "moto");

    expect(url2).toBe(url1);
    // Public URL é chamada **uma única vez** mesmo entre N chamadas
    // (cache em memória até `_clearCache`).
    expect(getPublicUrl).toHaveBeenCalledTimes(1);
  });

  it("retorna a mesma public URL em chamadas repetidas para o mesmo path (status)", async () => {
    const { api, getPublicUrl } = buildBucketComPublicUrl();

    const url1 = await api.obterUrlParaFoto("user/e/status/f.jpg", "status");
    const url2 = await api.obterUrlParaFoto("user/e/status/f.jpg", "status");

    expect(url2).toBe(url1);
    expect(getPublicUrl).toHaveBeenCalledTimes(1);
  });

  it("ramifica corretamente: mesmo path com tipos diferentes — moto é public, documento é signed", async () => {
    // Cobre o branch por tipo: o **mesmo path lógico** com tipo=moto
    // precisa virar public URL, e tipo=documento precisa virar signed.
    // Sem esse teste, o branching pode ser ignorado por um mutante.
    const { api, getPublicUrl, createSignedUrl } = buildBucketComPublicUrl();

    const urlMoto = await api.obterUrlParaFoto("user/e/path.jpg", "moto");
    const urlDoc = await api.obterUrlParaFoto("user/e/path.jpg", "documento");

    expect(urlMoto).toBe("https://public.example/foto.jpg");
    expect(urlDoc).toBe("https://signed.example/foto.jpg");
    expect(getPublicUrl).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("documento usa TTL de 1h (3600s) por padrão", async () => {
    const { api, createSignedUrl } = buildBucketComPublicUrl();

    await api.obterUrlParaFoto("user/e/documento/cnh.jpg", "documento");

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/e/documento/cnh.jpg",
      3600
    );
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

  it("reutiliza a URL em cache para chamadas repetidas do mesmo path", async () => {
    const { api, createSignedUrl } = buildBucket();

    const primeiraUrl = await api.obterUrlAssinada(
      "user/entrada/moto/foto.jpg"
    );
    const segundaUrl = await api.obterUrlAssinada(
      "user/entrada/moto/foto.jpg"
    );

    expect(segundaUrl).toBe(primeiraUrl);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
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

describe("SupabaseStorageApi.consultarEspacoBucket", () => {
  /**
   * Monta o duplo de teste da Edge Function `consultar-uso-storage`.
   * O Edge Function devolve `{ espacoUsadoBytes, totalArquivos }` e o
   * cliente recompor `espacoDisponivelBytes`/`percentualUsado` com a
   * constante `LIMITE_BYTES = 1 GB`.
   */
  const buildEspacoInvoke = (
    overrides: {
      invokeData?: { espacoUsadoBytes: number; totalArquivos: number };
      invokeError?: { message: string } | null;
    } = {}
  ) => {
    mockedInvoke.mockResolvedValue({
      data: overrides.invokeData ?? { espacoUsadoBytes: 0, totalArquivos: 0 },
      error: overrides.invokeError ?? null,
    } as never);

    return { api: new SupabaseStorageApi() };
  };

  beforeEach(() => {
    // `invoke` precisa voltar ao default antes de cada teste — caso
    // contrário, mocks com `.mockResolvedValueOnce` de um teste vazariam
    // para o seguinte.
    mockedInvoke.mockReset();
    // Garante que `storage.from().list` não é chamado por padrão: cada
    // teste que quiser observar listagens monta o próprio stub.
    mockedFrom.mockReset();
  });

  it('chama functions.invoke("consultar-uso-storage") exatamente 1 vez', async () => {
    const { api } = buildEspacoInvoke({
      invokeData: { espacoUsadoBytes: 1234, totalArquivos: 2 },
    });

    await api.consultarEspacoBucket();

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
    expect(mockedInvoke).toHaveBeenCalledWith("consultar-uso-storage");
  });

  it("não chama supabase.storage.from(...).list em momento algum", async () => {
    // A recursão antiga fazia centenas de chamadas `list` em loop; o
    // contrato novo é 1 invoke apenas. Stryker muta o corpo recursivo
    // para manter loops aninhados — esse teste mata o mutante.
    const { api } = buildEspacoInvoke({
      invokeData: { espacoUsadoBytes: 0, totalArquivos: 0 },
    });

    await api.consultarEspacoBucket();

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it("retorna EspacoBucketInfo com shape derivado do invoke", async () => {
    // 512 MB (= 1/2 do GB binário) usados de 1 GB → percentualUsado = 50.
    const METADE_GB = 512 * 1024 * 1024;
    const UM_GB = 1024 * 1024 * 1024;
    const { api } = buildEspacoInvoke({
      invokeData: { espacoUsadoBytes: METADE_GB, totalArquivos: 7 },
    });

    const info = await api.consultarEspacoBucket();

    expect(info).toEqual({
      espacoUsadoBytes: METADE_GB,
      espacoTotalBytes: UM_GB,
      espacoDisponivelBytes: UM_GB - METADE_GB,
      percentualUsado: 50,
      totalArquivos: 7,
    });
  });

  it("limita percentualUsado em 100 quando uso excede o limite", async () => {
    // Edge case do `Math.min(100, ...)`: garante que o cálculo não estoura.
    const UM_GB_MAIS_UM = 1024 * 1024 * 1024 + 1;
    const { api } = buildEspacoInvoke({
      invokeData: { espacoUsadoBytes: UM_GB_MAIS_UM, totalArquivos: 1 },
    });

    const info = await api.consultarEspacoBucket();

    expect(info.percentualUsado).toBe(100);
    expect(info.espacoDisponivelBytes).toBe(0);
  });

  it("propaga erro do invoke com mensagem amigável", async () => {
    const { api } = buildEspacoInvoke({
      invokeError: { message: "timeout no banco" },
    });

    await expect(api.consultarEspacoBucket()).rejects.toThrow(
      "Erro ao consultar espaço do bucket: timeout no banco"
    );
  });

  it("usa fallback (zero) quando invoke devolve data null sem erro", async () => {
    // Stryker muta `data?.espacoUsadoBytes` para `data.espacoUsadoBytes`
    // — sem `?.`, acessar `.foo` em `null` joga TypeError. O fallback
    // `?? 0` só funciona se o optional chaining for preservado.
    mockedInvoke.mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const api = new SupabaseStorageApi();

    const info = await api.consultarEspacoBucket();

    expect(info).toEqual({
      espacoUsadoBytes: 0,
      espacoTotalBytes: 1024 * 1024 * 1024,
      espacoDisponivelBytes: 1024 * 1024 * 1024,
      percentualUsado: 0,
      totalArquivos: 0,
    });
  });
});

describe("SupabaseStorageApi.consultarEspacoBucket — cache de 5 min", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("faz 1 invoke em 2 chamadas dentro da janela de 5 min", async () => {
    mockedInvoke.mockResolvedValue({
      data: { espacoUsadoBytes: 100, totalArquivos: 1 },
      error: null,
    } as never);

    const api = new SupabaseStorageApi();

    await api.consultarEspacoBucket();
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 min dentro da janela
    await api.consultarEspacoBucket();

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
  });

  it("faz 2 invokes em 2 chamadas após o TTL expirar", async () => {
    mockedInvoke.mockResolvedValue({
      data: { espacoUsadoBytes: 100, totalArquivos: 1 },
      error: null,
    } as never);

    const api = new SupabaseStorageApi();

    await api.consultarEspacoBucket();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1); // além do TTL
    await api.consultarEspacoBucket();

    expect(mockedInvoke).toHaveBeenCalledTimes(2);
  });
});

describe("SupabaseStorageApi.uploadFoto — pipeline de 2 variantes (moto/status)", () => {
  // O ciclo 1 introduz `gerarVariantes(file)` em `imageVariants.ts`. Para
  // manter os testes determinísticos (jsdom não tem Canvas/WebP
  // completos), mockamos o módulo e devolvemos dois `File` distintos —
  // um para thumb e outro para full — controlando o que `uploadFoto`
  // envia ao bucket.
  const buildVariantesMock = () => {
    const thumb = new File(["thumb-bytes"], "thumb.webp", {
      type: "image/webp",
    });
    const full = new File(["full-bytes"], "full.webp", {
      type: "image/webp",
    });
    return {
      thumb,
      full,
      gerarVariantes: vi.fn().mockResolvedValue({ thumb, full }),
    };
  };

  const buildBucketParaVariantes = (variantes: ReturnType<
    typeof buildVariantesMock
  >) => {
    const upload = vi
      .fn()
      .mockResolvedValue({ data: { path: "stub" }, error: null });
    const createSignedUrl = vi.fn();
    mockedFrom.mockReturnValue({ upload, createSignedUrl } as never);
    return { upload, variantes, api: new SupabaseStorageApi() };
  };

  it("retorna `{ thumbPath, fullPath }` com paths distintos para moto", async () => {
    // Stryker muta o shape de retorno. Sem esse teste, um mutante que
    // continua devolvendo `string` sobrevive.
    const variantes = buildVariantesMock();
    const { api, upload } = buildBucketParaVariantes(variantes);

    // Injeta o mock em runtime via prototype injection — evita ter que
    // tocar no caminho de import do módulo.
    const mod = await import("@/infrastructure/storage/imageVariants");
    const spy = vi
      .spyOn(mod, "gerarVariantes")
      .mockImplementation(variantes.gerarVariantes);
    spy.mockResolvedValue({ thumb: variantes.thumb, full: variantes.full });

    const resultado = await api.uploadFoto(buildFile(), "entrada-1", "moto");

    expect(resultado).toMatchObject({
      thumbPath: expect.stringMatching(/thumb\.webp$/),
      fullPath: expect.stringMatching(/full\.webp$/),
    });

    // Sanidade: os dois caminhos são diferentes.
    expect(resultado.thumbPath).not.toBe(resultado.fullPath);
    // Os dois caminhos foram efetivamente enviados ao bucket.
    const enviados = (upload.mock.calls as Array<[string, File]>).map(
      ([path]) => path
    );
    expect(enviados).toContain(resultado.thumbPath);
    expect(enviados).toContain(resultado.fullPath);
  });

  it("faz 2 uploads em paralelo (Promise.all) para moto", async () => {
    // Stryker muta `Promise.all([...])` por chamadas sequenciais em série.
    // O teste abaixo mata o mutante observando que ambas as chamadas
    // acontecem antes do retorno de `uploadFoto`.
    const variantes = buildVariantesMock();
    const { api, upload } = buildBucketParaVariantes(variantes);

    const mod = await import("@/infrastructure/storage/imageVariants");
    vi.spyOn(mod, "gerarVariantes").mockResolvedValue({
      thumb: variantes.thumb,
      full: variantes.full,
    });

    await api.uploadFoto(buildFile(), "entrada-1", "moto");

    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("envia as duas variantes com cacheControl 30d e upsert true", async () => {
    const variantes = buildVariantesMock();
    const { api, upload } = buildBucketParaVariantes(variantes);

    const mod = await import("@/infrastructure/storage/imageVariants");
    vi.spyOn(mod, "gerarVariantes").mockResolvedValue({
      thumb: variantes.thumb,
      full: variantes.full,
    });

    await api.uploadFoto(buildFile(), "entrada-1", "moto");

    // Stryker muta `cacheControl: "2592000"` ou remove `upsert: true`:
    // sem essa asserção em ambos os uploads, um mutante sobrevive.
    for (const [, , opts] of upload.mock.calls as Array<
      [string, File, { cacheControl?: string; upsert?: boolean }]
    >) {
      expect(opts.cacheControl).toBe("2592000");
      expect(opts.upsert).toBe(true);
    }
  });

  it("faz upload único para documento (sem gerar variantes)", async () => {
    // Stryker muta o branch `tipo === "documento"` — sem essa asserção,
    // um mutante que faz 2 uploads para documento sobrevive.
    const variantes = buildVariantesMock();
    const { api, upload } = buildBucketParaVariantes(variantes);

    const mod = await import("@/infrastructure/storage/imageVariants");
    const spy = vi.spyOn(mod, "gerarVariantes");

    const resultado = await api.uploadFoto(
      buildFile(),
      "entrada-1",
      "documento"
    );

    expect(spy).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(resultado.thumbPath).toBeNull();
    expect(resultado.fullPath).toMatch(/documento\/.*\.jpg$/);
  });

  it("envia o arquivo original (sem compressão) para documento", async () => {
    const { api, upload } = buildBucket();
    const original = buildFile();

    const resultado = await api.uploadFoto(original, "entrada-1", "documento");

    const [, enviado] = upload.mock.calls[0] as [string, File];
    expect(enviado).toBe(original);
    expect(resultado.fullPath).toContain("documento");
  });

  it("lança erro de MIME antes de gerar variantes ou fazer upload", async () => {
    const { api, upload } = buildBucket();
    const arquivoTexto = new File(["oi"], "nota.txt", { type: "text/plain" });

    const mod = await import("@/infrastructure/storage/imageVariants");
    const spy = vi.spyOn(mod, "gerarVariantes");

    await expect(
      api.uploadFoto(arquivoTexto, "entrada-1", "moto")
    ).rejects.toThrow(
      "Tipo de arquivo não permitido. Use JPEG, PNG, WEBP ou GIF."
    );

    expect(spy).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("lança erro de 5 MB antes de gerar variantes ou fazer upload", async () => {
    const { api, upload } = buildBucket();

    const mod = await import("@/infrastructure/storage/imageVariants");
    const spy = vi.spyOn(mod, "gerarVariantes");

    await expect(
      api.uploadFoto(buildFileGrande(), "entrada-1", "moto")
    ).rejects.toThrow("Arquivo muito grande. Tamanho máximo: 5MB.");

    expect(spy).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("lança erro de autenticação antes de gerar variantes ou fazer upload", async () => {
    const { api, upload } = buildBucket();
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);

    const mod = await import("@/infrastructure/storage/imageVariants");
    const spy = vi.spyOn(mod, "gerarVariantes");

    await expect(
      api.uploadFoto(buildFile(), "entrada-1", "moto")
    ).rejects.toThrow("Usuário não autenticado");

    expect(spy).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("lança erro quando thumbUpload falha no pipeline de 2 variantes", async () => {
    // Mata o mutante em SupabaseStorageApi.ts:95 (`if (thumbUpload.error)` →
    // `if (false)`). Sem essa asserção, o mutante sobrevive porque o teste
    // existente só observa o caminho de 1 upload (documento).
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const variantes = buildVariantesMock();
    const upload = vi
      .fn()
      // 1ª chamada (thumb) falha; 2ª (full) sucede.
      .mockResolvedValueOnce({
        data: null,
        error: { message: "erro no thumb" },
      })
      .mockResolvedValueOnce({ data: { path: "stub" }, error: null });
    mockedFrom.mockReturnValue({ upload, createSignedUrl: vi.fn() } as never);

    const mod = await import("@/infrastructure/storage/imageVariants");
    vi.spyOn(mod, "gerarVariantes").mockResolvedValue({
      thumb: variantes.thumb,
      full: variantes.full,
    });

    const api = new SupabaseStorageApi();

    await expect(
      api.uploadFoto(buildFile(), "entrada-1", "moto")
    ).rejects.toThrow("Erro ao fazer upload (thumb): erro no thumb");

    // O console.error foi chamado com o path e o error object do
    // Supabase (mata o mutante BlockStatement do `console.error(...)`).
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("thumb upload failed"),
      expect.objectContaining({ path: expect.stringContaining("-thumb.webp") })
    );

    consoleErrorSpy.mockRestore();
  });

  it("lança erro quando fullUpload falha no pipeline de 2 variantes", async () => {
    // Mata o mutante em SupabaseStorageApi.ts:98 (`if (fullUpload.error)` →
    // `if (false)`).
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const variantes = buildVariantesMock();
    const upload = vi
      .fn()
      // 1ª chamada (thumb) sucede; 2ª (full) falha.
      .mockResolvedValueOnce({ data: { path: "stub" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "erro no full" },
      });
    mockedFrom.mockReturnValue({ upload, createSignedUrl: vi.fn() } as never);

    const mod = await import("@/infrastructure/storage/imageVariants");
    vi.spyOn(mod, "gerarVariantes").mockResolvedValue({
      thumb: variantes.thumb,
      full: variantes.full,
    });

    const api = new SupabaseStorageApi();

    await expect(
      api.uploadFoto(buildFile(), "entrada-1", "status")
    ).rejects.toThrow("Erro ao fazer upload (full): erro no full");

    // Mata o mutante BlockStatement do `console.error(...)` do full.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("full upload failed"),
      expect.objectContaining({ path: expect.stringContaining("-full.webp") })
    );

    consoleErrorSpy.mockRestore();
  });

  it("renomeia corretamente o arquivo com extensão de múltiplos caracteres (regex boundary)", async () => {
    // Mata os mutantes de Regex em SupabaseStorageApi.ts:81-82
    // (`(\.[^.]+)?$` → `(\.[.]+)?$` / `(\.[^.])?$`). Esses mutantes
    // exigem 2+ dots ou capturam apenas 1 char após o ponto — produzem
    // paths com a extensão original `.jpg` ainda anexada (ex:
    // "...-foto.jpg-thumb.webp") em vez de "...-foto-thumb.webp".
    // Usar `not.toMatch(/\.jpg/)` no path enviado ao bucket é a
    // asserção mínima que mata os mutantes (e passa no original).
    const { api, upload } = buildBucket();

    const fileComExtensao = new File(["x"], "foto.jpg", {
      type: "image/jpeg",
    });

    const resultado = await api.uploadFoto(
      fileComExtensao,
      "entrada-1",
      "moto"
    );

    // Sufixo presente.
    expect(resultado.thumbPath).toMatch(/-thumb\.webp$/);
    expect(resultado.fullPath).toMatch(/-full\.webp$/);
    // A extensão original `.jpg` foi removida do path.
    expect(resultado.thumbPath).not.toMatch(/\.jpg/);
    expect(resultado.fullPath).not.toMatch(/\.jpg/);
    // E o bucket recebeu paths sem a extensão original.
    const pathsEnviados = (upload.mock.calls as Array<[string, File]>).map(
      ([path]) => path
    );
    expect(pathsEnviados).toHaveLength(2);
    expect(pathsEnviados[0]).not.toMatch(/\.jpg/);
    expect(pathsEnviados[1]).not.toMatch(/\.jpg/);
  });

  it("renomeia corretamente o arquivo sem extensão (regex `?` opcional)", async () => {
    // Mata os mutantes de Regex em SupabaseStorageApi.ts:81-82
    // (`(\.[^.]+)?$` → `(\.[^.]+)$`). Sem o `?`, o grupo deixa de
    // ser opcional e o replace só atua quando o path JÁ termina com
    // um dot + extensão. Para um arquivo sem extensão, o mutante
    // não faz replacement nenhum e o basePath fica sem o sufixo
    // `-thumb.webp` / `-full.webp` no retorno.
    const { api, upload } = buildBucket();

    const fileSemExtensao = new File(["x"], "foto", { type: "image/jpeg" });

    const resultado = await api.uploadFoto(
      fileSemExtensao,
      "entrada-1",
      "moto"
    );

    // O `?` é o que permite o match vazio no fim do path — sem ele o
    // replace não acontece e os paths retornados ficam sem o sufixo.
    expect(resultado.thumbPath).toMatch(/-thumb\.webp$/);
    expect(resultado.fullPath).toMatch(/-full\.webp$/);
    // E o bucket recebeu os paths com sufixo.
    const pathsEnviados = (upload.mock.calls as Array<[string, File]>).map(
      ([path]) => path
    );
    expect(pathsEnviados).toHaveLength(2);
    expect(pathsEnviados[0]).toMatch(/-thumb\.webp$/);
    expect(pathsEnviados[1]).toMatch(/-full\.webp$/);
  });

  it("sanitiza caracteres especiais do filename no path (~ espaços acentos)", async () => {
    // Cenário: arquivo "aizusu.cardozo-20250701-0002~2.jpg" (backup
    // do Windows) — o `~` e qualquer caractere fora de [a-zA-Z0-9._-]
    // vira `_` antes de entrar no path do bucket. Sem isso, o
    // Supabase Storage local retorna 400 Bad Request sem corpo
    // descritivo.
    const { api, upload } = buildBucket();

    const fileComTilde = new File(["x"], "aizusu-20250701-0002~2.jpg", {
      type: "image/jpeg",
    });

    await api.uploadFoto(fileComTilde, "entrada-1", "moto");

    const pathsEnviados = (upload.mock.calls as Array<[string, File]>).map(
      ([path]) => path
    );
    // Nenhum path enviado deve conter `~` ou espaços.
    for (const path of pathsEnviados) {
      expect(path).not.toMatch(/[~ ]/);
    }
    // E o `_` (substituto) deve aparecer onde o `~` estava.
    expect(pathsEnviados[0]).toMatch(/0002_2-thumb\.webp$/);
    expect(pathsEnviados[1]).toMatch(/0002_2-full\.webp$/);
  });
});

describe("SupabaseStorageApi.listarArquivosPorPeriodo", () => {
  /**
   * Monta o duplo da Edge Function `listar-arquivos-storage`. Devolve
   * `data.arquivos` com campos `caminho`, `nome`, `tamanhoBytes`,
   * `dataCriacao` (ISO string) e `tipo` — espelhando o contrato que o
   * ciclo 4 vai expor via SQL.
   */
  const buildListarInvoke = (
    overrides: {
      arquivos?: Array<{
        caminho: string;
        nome: string;
        tamanhoBytes: number;
        dataCriacao: string;
        tipo: string;
      }>;
      invokeError?: { message: string } | null;
    } = {}
  ) => {
    mockedInvoke.mockResolvedValue({
      data: { arquivos: overrides.arquivos ?? [] },
      error: overrides.invokeError ?? null,
    } as never);

    return { api: new SupabaseStorageApi() };
  };

  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedFrom.mockReset();
  });

  it('chama functions.invoke("listar-arquivos-storage") exatamente 1 vez', async () => {
    const { api } = buildListarInvoke({
      arquivos: [
        {
          caminho: "user/entrada-1/moto/foto.jpg",
          nome: "foto.jpg",
          tamanhoBytes: 1024,
          dataCriacao: "2026-08-01T10:00:00.000Z",
          tipo: "image/jpeg",
        },
      ],
    });

    const inicio = new Date("2026-08-01T00:00:00.000Z");
    const fim = new Date("2026-08-01T23:59:59.999Z");
    await api.listarArquivosPorPeriodo(inicio, fim);

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
    expect(mockedInvoke).toHaveBeenCalledWith("listar-arquivos-storage", {
      body: {
        dataInicio: "2026-08-01T00:00:00.000Z",
        dataFim: "2026-08-01T23:59:59.999Z",
      },
    });
  });

  it("não chama supabase.storage.from(...).list em momento algum", async () => {
    // A recursão antiga fazia centenas de chamadas `list` em loop; o
    // contrato novo é 1 invoke apenas.
    const { api } = buildListarInvoke();

    await api.listarArquivosPorPeriodo(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-01T23:59:59.999Z")
    );

    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it("mapeia dataCriacao ISO string para Date e propaga os demais campos", async () => {
    const { api } = buildListarInvoke({
      arquivos: [
        {
          caminho: "user/entrada-1/moto/foto.jpg",
          nome: "foto.jpg",
          tamanhoBytes: 2048,
          dataCriacao: "2026-08-01T10:00:00.000Z",
          tipo: "image/jpeg",
        },
      ],
    });

    const resultado = await api.listarArquivosPorPeriodo(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-01T23:59:59.999Z")
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toEqual({
      caminho: "user/entrada-1/moto/foto.jpg",
      nome: "foto.jpg",
      tamanhoBytes: 2048,
      dataCriacao: new Date("2026-08-01T10:00:00.000Z"),
      tipo: "image/jpeg",
    });
    // Stryker muta `new Date(item.dataCriacao)` para `new Date(item.dataCriacao)` removido
    // ou `new Date(item.caminho)` — sem o cast explícito o tipo vira string.
    expect(resultado[0].dataCriacao).toBeInstanceOf(Date);
  });

  it("retorna lista vazia quando invoke devolve { arquivos: [] }", async () => {
    const { api } = buildListarInvoke({ arquivos: [] });

    const resultado = await api.listarArquivosPorPeriodo(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-01T23:59:59.999Z")
    );

    expect(resultado).toEqual([]);
  });

  it("propaga erro do invoke com mensagem amigável", async () => {
    const { api } = buildListarInvoke({
      invokeError: { message: "Edge Function fora do ar" },
    });

    await expect(
      api.listarArquivosPorPeriodo(
        new Date("2026-08-01T00:00:00.000Z"),
        new Date("2026-08-01T23:59:59.999Z")
      )
    ).rejects.toThrow(
      "Erro ao listar arquivos por período: Edge Function fora do ar"
    );
  });

  it("retorna [] quando invoke devolve data null sem erro", async () => {
    // Stryker muta `data?.arquivos` para `data.arquivos` — sem `?.`,
    // acessar `.arquivos` em `null` joga TypeError.
    mockedInvoke.mockResolvedValue({
      data: null,
      error: null,
    } as never);

    const api = new SupabaseStorageApi();

    const resultado = await api.listarArquivosPorPeriodo(
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-01T23:59:59.999Z")
    );

    expect(resultado).toEqual([]);
  });
});
