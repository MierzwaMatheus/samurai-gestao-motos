import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useMotosOficina } from "./useMotosOficina";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { MotoCompleta } from "@shared/types";

/**
 * Repositório mock de entradas: o novo hook consome apenas `buscarPagina`,
 * que já devolve `MotoCompleta` completa (com cliente, moto, fotos e
 * serviços — eliminação do N+1 que existia na versão anterior).
 *
 * Mantemos os métodos legados no mock apenas para satisfazer a checagem
 * de tipo, mas o hook NÃO deve chamá-los.
 */
const buildEntradaRepo = () => ({
  buscarPagina: vi.fn(),
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorClienteId: vi.fn(),
  buscarPorMotoId: vi.fn(),
  buscarPorStatus: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn(),
  deletar: vi.fn(),
});

const makeMotoCompleta = (entradaId: string): MotoCompleta => ({
  id: entradaId,
  entradaId,
  motoId: `moto-${entradaId}`,
  clienteId: `cliente-${entradaId}`,
  modelo: "CG 160",
  marca: "Honda",
  ano: 2023,
  cilindrada: 160,
  placa: "ABC1D23",
  criadoEm: new Date("2025-01-01T00:00:00Z"),
  atualizadoEm: new Date("2025-01-01T00:00:00Z"),
  cliente: "Cliente Teste",
  telefone: "11999999999",
  status: "pendente",
  progresso: 0,
  dataConclusao: null,
  formaPagamento: null,
  statusPagamento: null,
  fotosStatus: [],
  fotos: [],
  tiposServico: [],
  servicosPersonalizados: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMotosOficina — ciclo 6 (paginado + busca server-side debounced 300ms)", () => {
  it("carregarMais incrementa page e concatena os itens retornados", async () => {
    const entradaRepo = buildEntradaRepo() as unknown as EntradaRepository;

    const pagina1 = {
      items: [
        makeMotoCompleta("entrada-1"),
        makeMotoCompleta("entrada-2"),
      ],
      total: 4,
      page: 1,
      pageSize: 2,
    };
    const pagina2 = {
      items: [
        makeMotoCompleta("entrada-3"),
        makeMotoCompleta("entrada-4"),
      ],
      total: 4,
      page: 2,
      pageSize: 2,
    };

    (entradaRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(pagina1)
      .mockResolvedValueOnce(pagina2);

    const { result } = renderHook(() =>
      useMotosOficina(entradaRepo, { page: 1, pageSize: 2 })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    expect(result.current.motos).toHaveLength(2);
    expect(entradaRepo.buscarPagina).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 2,
    });

    await act(async () => {
      await result.current.carregarMais();
    });

    expect(result.current.motos).toHaveLength(4);
    expect(result.current.motos.map((m) => m.entradaId)).toEqual([
      "entrada-1",
      "entrada-2",
      "entrada-3",
      "entrada-4",
    ]);
    expect(entradaRepo.buscarPagina).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 2,
    });
  });

  it("hasMore reflete corretamente motos.length < total em cada estado", async () => {
    const entradaRepo = buildEntradaRepo() as unknown as EntradaRepository;

    (entradaRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-1")],
        total: 3,
        page: 1,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-2")],
        total: 3,
        page: 2,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-3")],
        total: 3,
        page: 3,
        pageSize: 1,
      });

    const { result } = renderHook(() =>
      useMotosOficina(entradaRepo, { page: 1, pageSize: 1 })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    // Após página 1: 1 item < 3 total → hasMore true
    expect(result.current.total).toBe(3);
    expect(result.current.motos).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.carregarMais();
    });

    // Após página 2: 2 itens < 3 total → hasMore true
    expect(result.current.motos).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.carregarMais();
    });

    // Após página 3: 3 itens === 3 total → hasMore false
    expect(result.current.motos).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it("debounce de 300ms colapsa mudanças rápidas de busca em uma única request", async () => {
    vi.useFakeTimers();
    const entradaRepo = buildEntradaRepo() as unknown as EntradaRepository;

    (entradaRepo.buscarPagina as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [makeMotoCompleta("entrada-1")],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    const { result } = renderHook(() =>
      useMotosOficina(entradaRepo, { page: 1, pageSize: 10 })
    );

    // Carga inicial disparada explicitamente pelo caller
    await act(async () => {
      await result.current.recarregar();
    });
    expect(entradaRepo.buscarPagina).toHaveBeenCalledTimes(1);

    // Cinco mudanças rápidas de busca dentro da janela de 300ms
    act(() => result.current.setBusca("h"));
    act(() => result.current.setBusca("ho"));
    act(() => result.current.setBusca("hon"));
    act(() => result.current.setBusca("hond"));
    act(() => result.current.setBusca("honda"));

    // Antes de 300ms, nenhuma request extra deve ter sido disparada
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(entradaRepo.buscarPagina).toHaveBeenCalledTimes(1);

    // Ao completar 300ms, exatamente UMA request deve sair com o valor final
    await act(async () => {
      vi.advanceTimersByTime(1);
      await vi.runAllTimersAsync();
    });
    expect(entradaRepo.buscarPagina).toHaveBeenCalledTimes(2);
    expect(entradaRepo.buscarPagina).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      busca: "honda",
    });

    vi.useRealTimers();
  });

  it("mudar busca zera a paginação (page=1) na próxima request debounced", async () => {
    vi.useFakeTimers();
    const entradaRepo = buildEntradaRepo() as unknown as EntradaRepository;

    (entradaRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-1")],
        total: 10,
        page: 1,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-2")],
        total: 10,
        page: 2,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-3")],
        total: 10,
        page: 3,
        pageSize: 1,
      })
      .mockResolvedValue({
        items: [makeMotoCompleta("entrada-honda")],
        total: 1,
        page: 1,
        pageSize: 1,
      });

    const { result } = renderHook(() =>
      useMotosOficina(entradaRepo, { page: 1, pageSize: 1 })
    );

    // Carga inicial + dois carregarMais → estamos na página 3
    await act(async () => {
      await result.current.recarregar();
    });
    await act(async () => {
      await result.current.carregarMais();
    });
    await act(async () => {
      await result.current.carregarMais();
    });
    expect(entradaRepo.buscarPagina).toHaveBeenLastCalledWith({
      page: 3,
      pageSize: 1,
    });

    // Mudar busca → debounce 300ms → page deve voltar para 1
    act(() => result.current.setBusca("honda"));

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(entradaRepo.buscarPagina).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 1,
      busca: "honda",
    });

    vi.useRealTimers();
  });

  it("recarregar reseta a paginação e substitui os itens", async () => {
    const entradaRepo = buildEntradaRepo() as unknown as EntradaRepository;

    (entradaRepo.buscarPagina as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-1")],
        total: 2,
        page: 1,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-2")],
        total: 2,
        page: 2,
        pageSize: 1,
      })
      .mockResolvedValueOnce({
        items: [makeMotoCompleta("entrada-novo")],
        total: 1,
        page: 1,
        pageSize: 1,
      });

    const { result } = renderHook(() =>
      useMotosOficina(entradaRepo, { page: 1, pageSize: 1 })
    );

    await act(async () => {
      await result.current.recarregar();
    });
    await act(async () => {
      await result.current.carregarMais();
    });

    expect(result.current.motos).toHaveLength(2);

    await act(async () => {
      await result.current.recarregar();
    });

    // Após recarregar: a lista deve voltar ao tamanho 1 (substitui)
    expect(result.current.motos).toHaveLength(1);
    expect(result.current.motos[0].entradaId).toBe("entrada-novo");
    expect(entradaRepo.buscarPagina).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 1,
    });
  });

  it("atualizarMoto aplica atualização imutável sobre o array atual", async () => {
    const entradaRepo = buildEntradaRepo() as unknown as EntradaRepository;

    (entradaRepo.buscarPagina as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        makeMotoCompleta("entrada-1"),
        makeMotoCompleta("entrada-2"),
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    });

    const { result } = renderHook(() =>
      useMotosOficina(entradaRepo, { page: 1, pageSize: 10 })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    act(() => {
      result.current.atualizarMoto("entrada-1", { status: "concluido" });
    });

    expect(result.current.motos[0].status).toBe("concluido");
    expect(result.current.motos[1].status).toBe("pendente");
  });

  it("expõe error quando buscarPagina rejeita", async () => {
    const entradaRepo = buildEntradaRepo() as unknown as EntradaRepository;

    (entradaRepo.buscarPagina as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Falha de conexão")
    );

    const { result } = renderHook(() =>
      useMotosOficina(entradaRepo, { page: 1, pageSize: 10 })
    );

    await act(async () => {
      await result.current.recarregar();
    });

    expect(result.current.error).toBe("Falha de conexão");
    expect(result.current.loading).toBe(false);
  });
});