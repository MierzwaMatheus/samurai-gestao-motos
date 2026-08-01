import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useOrcamentos } from "./useOrcamentos";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { OrcamentoCompleto } from "@shared/types";

/**
 * Constrói um repositório mock de orçamentos expondo `buscarPagina` (api
 * nova) e `buscarCompletosPorStatus` (api legada). Mantemos a legada
 * apenas para afirmar que NÃO é chamada pelo hook.
 */
const buildOrcamentoRepo = () => ({
  buscarPagina: vi.fn(),
  buscarCompletosPorStatus: vi.fn(),
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorEntradaId: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
});

/**
 * Repositório mock de tipos de serviço. O hook NÃO deve chamar
 * `buscarPorEntradaId` porque o `buscarPagina` do repo já resolve os
 * `tiposServico` (eliminação do N+1 duplicado).
 */
const buildTipoServicoRepo = () => ({
  buscarPorEntradaId: vi.fn(),
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorNome: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
  vincularTiposServicoAEntrada: vi.fn(),
});

const buildServicoPersonalizadoRepo = () => ({
  buscarPorEntradaId: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
  deletarPorEntradaId: vi.fn(),
});

const makeOrcamento = (id: string, entradaId: string): OrcamentoCompleto => ({
  id,
  entradaId,
  valor: 100,
  dataExpiracao: new Date("2099-01-01T00:00:00Z"),
  status: "ativo",
  criadoEm: new Date("2025-01-01T00:00:00Z"),
  atualizadoEm: new Date("2025-01-01T00:00:00Z"),
  cliente: "Cliente Teste",
  moto: "Modelo X",
  frete: null,
  tiposServico: [],
  servicosPersonalizados: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useOrcamentos — ciclo 5 (paginado + remoção N+1 duplicado)", () => {
  it("NÃO chama tipoServicoRepo.buscarPorEntradaId (bug do N+1 duplicado removido)", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    const tipoServicoRepo =
      buildTipoServicoRepo() as unknown as TipoServicoRepository;
    const servicoPersonalizadoRepo =
      buildServicoPersonalizadoRepo() as unknown as ServicoPersonalizadoRepository;

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [makeOrcamento("orc-1", "entrada-1")],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    const { result } = renderHook(() =>
      useOrcamentos(
        orcamentoRepo,
        "ativo",
        tipoServicoRepo,
        servicoPersonalizadoRepo,
        { page: 1, pageSize: 10 }
      )
    );

    await act(async () => {
      await result.current.recarregar();
    });

    expect(tipoServicoRepo.buscarPorEntradaId).not.toHaveBeenCalled();
    expect(servicoPersonalizadoRepo.buscarPorEntradaId).not.toHaveBeenCalled();
  });

  it("ignora erros de respostas antigas para que o estado reflita a request mais recente", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    let resolveOld!: (value: unknown) => void;
    let resolveNew!: (value: unknown) => void;
    const oldRequest = new Promise(resolve => {
      resolveOld = resolve;
    });
    const newRequest = new Promise(resolve => {
      resolveNew = resolve;
    });

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(oldRequest)
      .mockReturnValueOnce(newRequest);

    const { result } = renderHook(() => useOrcamentos(orcamentoRepo, "ativo"));

    act(() => {
      void result.current.recarregar();
      void result.current.recarregar();
    });

    resolveNew({
      items: [makeOrcamento("orc-atual")],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    await act(async () => {
      await newRequest;
    });

    resolveOld(Promise.reject(new Error("Falha de conexão")));
    await act(async () => {
      await oldRequest.catch(() => undefined);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.total).toBe(1);
  });

  it("carregarMais incrementa page e concatena os itens retornados", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    const firstRequest = new Promise(resolve => {
      resolveFirst = resolve;
    });
    const secondRequest = new Promise(resolve => {
      resolveSecond = resolve;
    });

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest);

    const { result } = renderHook(() => useOrcamentos(orcamentoRepo, "ativo"));

    act(() => {
      void result.current.recarregar();
      void result.current.recarregar();
    });

    resolveSecond({
      items: [makeOrcamento("orc-atual")],
      total: 42,
      page: 1,
      pageSize: 10,
    });
    await act(async () => {
      await secondRequest;
    });

    resolveFirst({
      items: Array.from({ length: 10 }, (_, index) =>
        makeOrcamento(`orc-antigo-${index}`)
      ),
      total: 10,
      page: 1,
      pageSize: 10,
    });
    await act(async () => {
      await firstRequest;
    });

    expect(result.current.total).toBe(42);
    expect(result.current.orcamentos).toHaveLength(1);
  });

  it("carregarMais incrementa page e concatena os itens retornados", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    const tipoServicoRepo =
      buildTipoServicoRepo() as unknown as TipoServicoRepository;

    const pagina1 = {
      items: [
        makeOrcamento("orc-1", "entrada-1"),
        makeOrcamento("orc-2", "entrada-2"),
      ],
      total: 4,
      page: 1,
      pageSize: 2,
    };
    const pagina2 = {
      items: [
        makeOrcamento("orc-3", "entrada-3"),
        makeOrcamento("orc-4", "entrada-4"),
      ],
      total: 4,
      page: 2,
      pageSize: 2,
    };

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(pagina1)
      .mockResolvedValueOnce(pagina2);

    const { result } = renderHook(() =>
      useOrcamentos(orcamentoRepo, "ativo", tipoServicoRepo, undefined, {
        page: 1,
        pageSize: 2,
      })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    expect(result.current.orcamentos).toHaveLength(2);
    expect(orcamentoRepo.buscarPagina).toHaveBeenLastCalledWith({
      status: "ativo",
      page: 1,
      pageSize: 2,
    });

    await act(async () => {
      await result.current.carregarMais();
    });

    expect(result.current.orcamentos).toHaveLength(4);
    expect(result.current.orcamentos.map((o) => o.id)).toEqual([
      "orc-1",
      "orc-2",
      "orc-3",
      "orc-4",
    ]);
    expect(orcamentoRepo.buscarPagina).toHaveBeenLastCalledWith({
      status: "ativo",
      page: 2,
      pageSize: 2,
    });
  });

  it("hasMore reflete corretamente orcamentos.length < total em cada estado", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    const tipoServicoRepo =
      buildTipoServicoRepo() as unknown as TipoServicoRepository;

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        items: [makeOrcamento("orc-1", "entrada-1")],
        total: 3,
        page: 1,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeOrcamento("orc-2", "entrada-2")],
        total: 3,
        page: 2,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeOrcamento("orc-3", "entrada-3")],
        total: 3,
        page: 3,
        pageSize: 1,
      });

    const { result } = renderHook(() =>
      useOrcamentos(orcamentoRepo, "ativo", tipoServicoRepo, undefined, {
        page: 1,
        pageSize: 1,
      })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    // Após página 1: 1 item < 3 total → hasMore true
    expect(result.current.total).toBe(3);
    expect(result.current.orcamentos).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.carregarMais();
    });

    // Após página 2: 2 itens < 3 total → hasMore true
    expect(result.current.orcamentos).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.carregarMais();
    });

    // Após página 3: 3 itens === 3 total → hasMore false
    expect(result.current.orcamentos).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it("recarregar reseta a paginação (substitui, não concatena)", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    const tipoServicoRepo =
      buildTipoServicoRepo() as unknown as TipoServicoRepository;

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        items: [makeOrcamento("orc-1", "entrada-1")],
        total: 2,
        page: 1,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeOrcamento("orc-2", "entrada-2")],
        total: 2,
        page: 2,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeOrcamento("orc-novo", "entrada-novo")],
        total: 1,
        page: 1,
        pageSize: 1,
      });

    const { result } = renderHook(() =>
      useOrcamentos(orcamentoRepo, "ativo", tipoServicoRepo, undefined, {
        page: 1,
        pageSize: 1,
      })
    );

    await act(async () => {
      await result.current.recarregar();
    });
    await act(async () => {
      await result.current.carregarMais();
    });

    expect(result.current.orcamentos).toHaveLength(2);

    await act(async () => {
      await result.current.recarregar();
    });

    // Após recarregar: a lista deve voltar ao tamanho 1 (substitui).
    expect(result.current.orcamentos).toHaveLength(1);
    expect(result.current.orcamentos[0].id).toBe("orc-novo");
    expect(orcamentoRepo.buscarPagina).toHaveBeenLastCalledWith({
      status: "ativo",
      page: 1,
      pageSize: 1,
    });
  });

  it("atualizarOrcamento aplica atualização imutável sobre o array atual", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    const tipoServicoRepo =
      buildTipoServicoRepo() as unknown as TipoServicoRepository;

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        makeOrcamento("orc-1", "entrada-1"),
        makeOrcamento("orc-2", "entrada-2"),
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    });

    const { result } = renderHook(() =>
      useOrcamentos(orcamentoRepo, "ativo", tipoServicoRepo, undefined, {
        page: 1,
        pageSize: 10,
      })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    act(() => {
      result.current.atualizarOrcamento("orc-1", { status: "expirado" });
    });

    expect(result.current.orcamentos[0].status).toBe("expirado");
    expect(result.current.orcamentos[1].status).toBe("ativo");
  });

  it("removerOrcamento remove o item com id informado", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    const tipoServicoRepo =
      buildTipoServicoRepo() as unknown as TipoServicoRepository;

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        makeOrcamento("orc-1", "entrada-1"),
        makeOrcamento("orc-2", "entrada-2"),
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    });

    const { result } = renderHook(() =>
      useOrcamentos(orcamentoRepo, "ativo", tipoServicoRepo, undefined, {
        page: 1,
        pageSize: 10,
      })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    act(() => {
      result.current.removerOrcamento("orc-1");
    });

    expect(result.current.orcamentos).toHaveLength(1);
    expect(result.current.orcamentos[0].id).toBe("orc-2");
  });

  it("expõe error quando buscarPagina rejeita", async () => {
    const orcamentoRepo = buildOrcamentoRepo() as unknown as OrcamentoRepository;
    const tipoServicoRepo =
      buildTipoServicoRepo() as unknown as TipoServicoRepository;

    (orcamentoRepo.buscarPagina as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Falha de conexão")
    );

    const { result } = renderHook(() =>
      useOrcamentos(orcamentoRepo, "ativo", tipoServicoRepo, undefined, {
        page: 1,
        pageSize: 10,
      })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    expect(result.current.error).toBe("Falha de conexão");
    expect(result.current.loading).toBe(false);
  });
});
