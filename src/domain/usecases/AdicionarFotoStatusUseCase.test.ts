import { describe, it, expect, vi, beforeEach } from "vitest";

import { AdicionarFotoStatusUseCase } from "@/domain/usecases/AdicionarFotoStatusUseCase";

/**
 * AdicionarFotoStatusUseCase — testes do gate final da issue #13.
 *
 * Antes do gate, este arquivo não existia — Stryker sobrevivia em 4
 * mutantes ConditionalExpression por falta absoluta de cobertura. Estes
 * testes matam os mutantes críticos e de borda:
 *
 *   L22: `if (!entradaId)` — validação de entrada obrigatória
 *   L26: `if (!file)` — validação de arquivo obrigatório
 *   L32: `if (!entrada)` — entrada inexistente (Promise.reject vs null)
 *   L36: `progresso !== undefined ? progresso : entrada.progresso`
 *        — boundary entre undefined explícito e omissão
 *
 * Também cobrimos o branching do ciclo 3: `obterUrlParaFoto(fullPath,
 * "status")` deve ser chamado para devolver URL pública (cache infinito)
 * ao chamador — sem precisar re-assinar 1h depois.
 */

const buildEntradaRepo = (overrides: Record<string, unknown> = {}) => ({
  buscarPorId: vi.fn(async () => ({
    id: "entrada-1",
    clienteId: "cliente-1",
    motoId: "moto-1",
    fotosStatus: [],
    progresso: 50,
    ...overrides,
  })),
  atualizar: vi.fn(async () => undefined),
});

const buildStorageApi = (overrides: Record<string, unknown> = {}) => ({
  uploadFoto: vi.fn(async () => ({
    thumbPath: "user/e/status/thumb.webp",
    fullPath: "user/e/status/full.webp",
  })),
  obterUrlParaFoto: vi.fn(async () =>
    "https://public.example/user/e/status/full.webp"
  ),
  ...overrides,
});

const buildFile = (): File =>
  new File(["conteudo"], "foto.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdicionarFotoStatusUseCase — validações de entrada", () => {
  it("lança erro quando entradaId é vazio", async () => {
    // Mata o mutante CRÍTICO ConditionalExpression `if (!entradaId)`
    // → `if (true)` (sempre lançaria) ou `if (false)` (nunca validaria).
    const entradaRepo = buildEntradaRepo();
    const storageApi = buildStorageApi();
    const sut = new AdicionarFotoStatusUseCase(entradaRepo, storageApi);

    await expect(sut.execute("", buildFile())).rejects.toThrow(
      "ID da entrada é obrigatório"
    );
    expect(entradaRepo.buscarPorId).not.toHaveBeenCalled();
    expect(storageApi.uploadFoto).not.toHaveBeenCalled();
  });

  it("lança erro quando file é undefined/null", async () => {
    // Mata o mutante CRÍTICO ConditionalExpression `if (!file)` → `if (false)`.
    const entradaRepo = buildEntradaRepo();
    const storageApi = buildStorageApi();
    const sut = new AdicionarFotoStatusUseCase(entradaRepo, storageApi);

    await expect(
      sut.execute("entrada-1", null as unknown as File)
    ).rejects.toThrow("Arquivo é obrigatório");
    expect(storageApi.uploadFoto).not.toHaveBeenCalled();
  });
});

describe("AdicionarFotoStatusUseCase — fluxo principal", () => {
  it("lança erro quando entradaRepo.buscarPorId devolve null", async () => {
    // Mata o mutante CRÍTICO ConditionalExpression `if (!entrada)`
    // → `if (false)` (causaria NPE em entrada.progresso).
    const entradaRepo = buildEntradaRepo();
    entradaRepo.buscarPorId.mockResolvedValueOnce(null);
    const storageApi = buildStorageApi();
    const sut = new AdicionarFotoStatusUseCase(entradaRepo, storageApi);

    await expect(sut.execute("entrada-1", buildFile())).rejects.toThrow(
      "Entrada não encontrada"
    );
    expect(storageApi.uploadFoto).not.toHaveBeenCalled();
  });

  it("usa entrada.progresso quando progresso é omitido (boundary: undefined explícito cai no fallback)", async () => {
    // Mata o mutante ALTO EqualityOperator `!==` → `===`:
    // com `===`, `undefined === undefined` é true e progresso seria
    // substituído por `entrada.progresso` mesmo quando o chamador
    // passou `undefined` explicitamente (boundary ambíguo). Aqui o
    // teste cobre o caminho feliz (sem passar progresso).
    const entradaRepo = buildEntradaRepo({ progresso: 42 });
    const storageApi = buildStorageApi();
    const sut = new AdicionarFotoStatusUseCase(entradaRepo, storageApi);

    const foto = await sut.execute("entrada-1", buildFile());

    expect(foto.progresso).toBe(42);
    expect(entradaRepo.atualizar).toHaveBeenCalledWith(
      "entrada-1",
      expect.objectContaining({ progresso: 42 })
    );
  });

  it("usa o progresso informado quando ele é um número válido (incluindo 0)", async () => {
    // Mata o mutante ALTO EqualityOperator `!==` → `===` no boundary
    // `progresso !== undefined`. Com `===`, `0 === undefined` é false
    // e o fallback `entrada.progresso` prevaleceria (perdendo o 0
    // explícito). O teste garante que 0 é respeitado.
    const entradaRepo = buildEntradaRepo({ progresso: 99 });
    const storageApi = buildStorageApi();
    const sut = new AdicionarFotoStatusUseCase(entradaRepo, storageApi);

    const foto = await sut.execute("entrada-1", buildFile(), "obs", 0);

    expect(foto.progresso).toBe(0);
    expect(entradaRepo.atualizar).toHaveBeenCalledWith(
      "entrada-1",
      expect.objectContaining({ progresso: 0 })
    );
  });

  it("resolve URL pública via obterUrlParaFoto(fullPath, 'status') — ciclo 3", async () => {
    // Mata o mutante ConditionalExpression em
    // `await this.storageApi.obterUrlParaFoto(fullPath, "status")` e
    // confirma que o helper central é chamado com tipo='status' (não
    // 'moto' nem 'documento').
    const entradaRepo = buildEntradaRepo();
    const storageApi = buildStorageApi();
    const sut = new AdicionarFotoStatusUseCase(entradaRepo, storageApi);

    const foto = await sut.execute("entrada-1", buildFile());

    expect(storageApi.obterUrlParaFoto).toHaveBeenCalledTimes(1);
    expect(storageApi.obterUrlParaFoto).toHaveBeenCalledWith(
      "user/e/status/full.webp",
      "status"
    );
    // O objeto retornado traz `url` com a URL pública para exibição
    // imediata (não o filePath cru).
    expect(foto.url).toBe("https://public.example/user/e/status/full.webp");
    // Mas o `thumbPath`/`fullPath` salvos na Foto são os paths crus
    // (re-resolvidos sob demanda em outras partes).
    expect(foto.thumbPath).toBe("user/e/status/thumb.webp");
    expect(foto.fullPath).toBe("user/e/status/full.webp");
  });

  it("preserva observação e fotos anteriores no payload de atualização", async () => {
    // Mata o mutante BlockStatement do `novasFotosStatus = [...existentes, fotoStatus]`
    // — se o spread fosse removido, fotos anteriores seriam perdidas.
    const fotoAnterior = {
      url: "user/e/status/anterior.webp",
      thumbPath: "user/e/status/anterior-thumb.webp",
      fullPath: "user/e/status/anterior.webp",
      data: new Date("2025-01-01"),
      observacao: "anterior",
      progresso: 30,
    };
    const entradaRepo = buildEntradaRepo({
      fotosStatus: [fotoAnterior],
    });
    const storageApi = buildStorageApi();
    const sut = new AdicionarFotoStatusUseCase(entradaRepo, storageApi);

    await sut.execute("entrada-1", buildFile(), "nova observação", 75);

    expect(entradaRepo.atualizar).toHaveBeenCalledTimes(1);
    const [id, payload] = entradaRepo.atualizar.mock.calls[0];
    expect(id).toBe("entrada-1");
    expect(payload.fotosStatus).toHaveLength(2);
    expect(payload.fotosStatus[0]).toEqual(fotoAnterior);
    expect(payload.fotosStatus[1].observacao).toBe("nova observação");
    expect(payload.fotosStatus[1].progresso).toBe(75);
  });
});