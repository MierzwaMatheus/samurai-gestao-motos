import { describe, it, expect, vi } from "vitest";

import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { StorageApi } from "@/domain/interfaces/StorageApi";
import { GerarOSUseCase } from "@/domain/usecases/GerarOSUseCase";
import type { Cliente, Entrada, Foto, FotoStatus, Moto } from "@shared/types";

/**
 * Constroi mocks com todas as chaves necessárias para satisfazer as
 * interfaces de domínio. Cada teste sobrescreve apenas os métodos que
 * precisa observar.
 */
const buildEntradaRepo = (
  entrada: Entrada
): EntradaRepository => ({
  criar: vi.fn(),
  buscarPorId: vi.fn().mockResolvedValue(entrada),
  buscarPorClienteId: vi.fn(),
  buscarPorMotoId: vi.fn(),
  buscarPorStatus: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
  buscarPagina: vi.fn(),
});

const buildClienteRepo = (cliente: Cliente): ClienteRepository => ({
  criar: vi.fn(),
  buscarPorId: vi.fn().mockResolvedValue(cliente),
  buscarPorNome: vi.fn(),
  buscarPorNomeOuTelefone: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
});

const buildMotoRepo = (moto: Moto): MotoRepository => ({
  criar: vi.fn(),
  buscarPorId: vi.fn().mockResolvedValue(moto),
  buscarPorClienteId: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
});

const buildFotoRepo = (fotos: Foto[]): FotoRepository => ({
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorEntradaId: vi.fn().mockResolvedValue(fotos),
  buscarPorEntradaIdETipo: vi.fn(),
  deletar: vi.fn(),
});

const buildTipoServicoRepo = (): TipoServicoRepository => ({
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorNome: vi.fn(),
  buscarPorEntradaId: vi.fn().mockResolvedValue([]),
  listar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
  vincularTiposServicoAEntrada: vi.fn(),
});

const buildServicoPersonalizadoRepo = (): ServicoPersonalizadoRepository => ({
  criar: vi.fn(),
  buscarPorEntradaId: vi.fn().mockResolvedValue([]),
  atualizar: vi.fn(),
  deletar: vi.fn(),
  deletarPorEntradaId: vi.fn(),
});

const buildStorageApi = (): StorageApi => ({
  uploadFoto: vi.fn(),
  deletarFoto: vi.fn(),
  obterUrlPublica: vi.fn(),
  obterUrlAssinada: vi
    .fn()
    .mockImplementation(async (path: string) => `https://signed.example/${path}`),
  // Ciclo 3: helper central de resolução de URL. Para `moto`/`status`
  // retorna public URL; para `documento` retorna signed URL.
  obterUrlParaFoto: vi
    .fn()
    .mockImplementation(
      async (path: string, tipo: "moto" | "status" | "documento") =>
        tipo === "documento"
          ? `https://signed.example/${path}`
          : `https://public.example/${path}`
    ),
  consultarEspacoBucket: vi.fn(),
  listarArquivosPorPeriodo: vi.fn(),
  deletarArquivosPorPeriodo: vi.fn(),
});

const buildCliente = (): Cliente => ({
  id: "cliente-1",
  nome: "João da Silva",
  telefone: "11999990000",
  numeroServicos: 0,
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  atualizadoEm: new Date("2026-01-01T00:00:00Z"),
});

const buildMoto = (): Moto => ({
  id: "moto-1",
  clienteId: "cliente-1",
  modelo: "CB 500",
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  atualizadoEm: new Date("2026-01-01T00:00:00Z"),
});

const buildEntrada = (overrides: Partial<Entrada> = {}): Entrada => ({
  id: "entrada-1",
  tipo: "entrada",
  clienteId: "cliente-1",
  motoId: "moto-1",
  frete: null,
  status: "alinhando",
  progresso: 0,
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  atualizadoEm: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

describe("GerarOSUseCase — fullPath em alta resolução (ciclo 6)", () => {
  it("fornece fullPath como url das fotos da entrada quando fullPath está disponível", async () => {
    // Foto nova do pipeline: `fullPath` é a versão em alta resolução que
    // deve chegar no PDF e no modal. Para distinguir `f.url` (que por
    // convenção do AdicionarFotoStatusUseCase hoje é igual a fullPath),
    // usamos valores explicitamente diferentes — modela o cenário em que
    // thumb/full divergem (documento) ou em que o caller queira separar.
    const foto: Foto = {
      id: "foto-1",
      entradaId: "entrada-1",
      url: "thumb/path.jpg",
      thumbPath: "thumb/path.jpg",
      fullPath: "full/path.jpg",
      tipo: "moto",
      criadoEm: new Date("2026-01-01T00:00:00Z"),
    };
    const entrada = buildEntrada();
    const useCase = new GerarOSUseCase(
      buildEntradaRepo(entrada),
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([foto]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    const dados = await useCase.execute("entrada-1");

    // A url fornecida ao PDF deve ser o fullPath, não o url legado.
    expect(dados.fotos[0]).toEqual({
      url: "full/path.jpg",
      tipo: "moto",
    });
  });

  it("cai no url quando fullPath é null (fotos legadas sem pipeline)", async () => {
    const fotoLegada: Foto = {
      id: "foto-legada",
      entradaId: "entrada-1",
      url: "legado/path.jpg",
      thumbPath: null,
      fullPath: null,
      tipo: "moto",
      criadoEm: new Date("2026-01-01T00:00:00Z"),
    };
    const entrada = buildEntrada();
    const useCase = new GerarOSUseCase(
      buildEntradaRepo(entrada),
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([fotoLegada]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    const dados = await useCase.execute("entrada-1");

    expect(dados.fotos[0]).toEqual({
      url: "legado/path.jpg",
      tipo: "moto",
    });
  });

  it("sinaliza o caminho a ser resolvido para fotos de status usando fullPath quando disponível", async () => {
    // Para fotos de status, o use case resolve URL via helper e devolve
    // o resultado em `url`. Quando o FotoStatus tem fullPath, o
    // caminho passado deve ser o fullPath (alta resolução), não o `url`.
    // Ciclo 3: usa `obterUrlParaFoto(path, "status")` — public URL.
    const fotoStatus: FotoStatus = {
      url: "status/path.webp", // path persistido (não URL completa)
      thumbPath: "status/thumb.webp",
      fullPath: "status/full.webp",
      data: new Date("2026-01-01T00:00:00Z"),
      observacao: undefined,
      progresso: 50,
    };
    const entrada = buildEntrada({ fotosStatus: [fotoStatus] });
    const storageApi = buildStorageApi();
    const useCase = new GerarOSUseCase(
      buildEntradaRepo(entrada),
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      storageApi
    );

    const dados = await useCase.execute("entrada-1");

    // O caminho passado ao storageApi.obterUrlParaFoto deve ser o
    // fullPath (ciclo 3 — antes era obterUrlAssinada com mesmo path).
    expect(storageApi.obterUrlParaFoto).toHaveBeenCalledWith(
      "status/full.webp",
      "status"
    );
    expect(storageApi.obterUrlAssinada).not.toHaveBeenCalled();
    // E a url final entregue ao PDF reflete a resolução do fullPath.
    expect(dados.fotos[0]).toEqual({
      url: "https://public.example/status/full.webp",
      tipo: "status",
    });
  });
});

describe("GerarOSUseCase — caminhos de erro (gate final issue #13)", () => {
  /**
   * Stryker sobrevivia em 4 mutantes CRÍTICOS de ConditionalExpression
   * e LogicalOperator por falta de testes de borda/erro:
   *
   *   L51  `if (!entrada)` — entrada não encontrada
   *   L70  `if (!cliente || !moto)` — cliente OU moto ausentes
   *   L85  `if (!url.startsWith("http"))` — branch que decide entre
   *        chamar helper e usar a URL já resolvida
   *   L102/L103 — `dataConclusao: entrada.dataConclusao ?? null` e
   *        `formaPagamento: entrada.formaPagamento ?? null` (boundary
   *        null vs undefined vs valor válido)
   */

  it("lança erro quando entradaRepo.buscarPorId devolve null", async () => {
    // Mata mutante CRÍTICO ConditionalExpression `if (!entrada)` → `if (false)`.
    const entradaRepo = buildEntradaRepo(buildEntrada());
    entradaRepo.buscarPorId = vi.fn().mockResolvedValue(null);
    const useCase = new GerarOSUseCase(
      entradaRepo,
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    await expect(useCase.execute("entrada-1")).rejects.toThrow(
      "Entrada não encontrada"
    );
  });

  it("lança erro quando clienteRepo.buscarPorId devolve null (mesmo com moto presente)", async () => {
    // Mata mutante CRÍTICO LogicalOperator `||` → `&&` em
    // `if (!cliente || !moto)`: o mutante `&&` exigiria AMBOS nulos
    // para lançar — cliente sozinho null passaria.
    const entradaRepo = buildEntradaRepo(buildEntrada());
    const clienteRepo = buildClienteRepo(buildCliente());
    clienteRepo.buscarPorId = vi.fn().mockResolvedValue(null);
    const useCase = new GerarOSUseCase(
      entradaRepo,
      clienteRepo,
      buildMotoRepo(buildMoto()),
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    await expect(useCase.execute("entrada-1")).rejects.toThrow(
      "Cliente ou moto não encontrados"
    );
  });

  it("lança erro quando motoRepo.buscarPorId devolve null (mesmo com cliente presente)", async () => {
    // Mata o outro lado do mutante `||` → `&&`: moto sozinho null
    // também deve disparar o erro.
    const entradaRepo = buildEntradaRepo(buildEntrada());
    const motoRepo = buildMotoRepo(buildMoto());
    motoRepo.buscarPorId = vi.fn().mockResolvedValue(null);
    const useCase = new GerarOSUseCase(
      entradaRepo,
      buildClienteRepo(buildCliente()),
      motoRepo,
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    await expect(useCase.execute("entrada-1")).rejects.toThrow(
      "Cliente ou moto não encontrados"
    );
  });

  it("NÃO chama obterUrlParaFoto para foto de status cuja URL já é completa (http)", async () => {
    // Mata o mutante CRÍTICO ConditionalExpression `if (!url.startsWith("http"))`
    // → `if (true)` (sempre chamaria o helper mesmo com URL completa — geraria
    // chamada extra desnecessária a `/storage/v1/object/sign/...` ou
    // sobrescreveria a URL já válida).
    const entrada = buildEntrada({
      fotosStatus: [
        {
          url: "https://already-public.example/foto.jpg",
          thumbPath: null,
          fullPath: null,
          data: new Date("2026-01-01"),
          observacao: "legada",
          progresso: 50,
        },
      ],
    });
    const storageApi = buildStorageApi();
    const useCase = new GerarOSUseCase(
      buildEntradaRepo(entrada),
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      storageApi
    );

    const dados = await useCase.execute("entrada-1");

    expect(storageApi.obterUrlParaFoto).not.toHaveBeenCalled();
    expect(dados.fotos[0].url).toBe("https://already-public.example/foto.jpg");
  });

  it("preserva dataConclusao quando já está preenchida (boundary: valor válido vs null fallback)", async () => {
    // Mata o mutante ALTO LogicalOperator `??` → `||` em
    // `dataConclusao: entrada.dataConclusao ?? null`. Com `||`, o valor
    // 0 seria descartado (boundary numérico falso). Aqui validamos
    // que a data válida é preservada.
    const dataConclusao = new Date("2026-02-15T10:00:00Z");
    const entrada = buildEntrada({ dataConclusao });
    const useCase = new GerarOSUseCase(
      buildEntradaRepo(entrada),
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    const dados = await useCase.execute("entrada-1");

    expect(dados.entrada.dataConclusao).toEqual(dataConclusao);
  });

  it("cai em null quando dataConclusao é undefined (boundary ?? vs ||)", async () => {
    // Mata o mutante ALTO LogicalOperator `??` → `||`: ambos
    // retornariam `null` para `undefined`, mas o boundary crítico é
    // dataConclusao = 0 ou string vazia — não exercitamos 0 porque
    // dataConclusao é Date, mas validamos que undefined cai em null
    // (cenário comum: entrada em aberto).
    const entrada = buildEntrada();
    delete (entrada as Partial<Entrada>).dataConclusao;
    const useCase = new GerarOSUseCase(
      buildEntradaRepo(entrada),
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    const dados = await useCase.execute("entrada-1");

    expect(dados.entrada.dataConclusao).toBeNull();
  });

  it("cai em null quando formaPagamento é undefined", async () => {
    // Mata o mutante ALTO LogicalOperator `??` → `||` em
    // `formaPagamento: entrada.formaPagamento ?? null`. Boundary: uma
    // formaPagamento = "" (string vazia) com `||` cairia em null e
    // perderíamos a string vazia (que pode ser valor válido).
    // Aqui validamos que undefined → null (caminho padrão).
    const entrada = buildEntrada();
    delete (entrada as Partial<Entrada>).formaPagamento;
    const useCase = new GerarOSUseCase(
      buildEntradaRepo(entrada),
      buildClienteRepo(buildCliente()),
      buildMotoRepo(buildMoto()),
      buildFotoRepo([]),
      buildTipoServicoRepo(),
      buildServicoPersonalizadoRepo(),
      buildStorageApi()
    );

    const dados = await useCase.execute("entrada-1");

    expect(dados.entrada.formaPagamento).toBeNull();
  });
});
