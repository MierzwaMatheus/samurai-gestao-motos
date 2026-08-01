import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// Mock do módulo supabase - vi.mock é hoisted, factory retorna o mock
vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { useRelatorioExcel } from "./useRelatorioExcel";
import { supabase } from "@/infrastructure/supabase/client";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

const SENTINEL_START = "1970-01-01";
const SENTINEL_END = "2099-12-31";

const rowFactory = (overrides: Partial<Record<string, string | number | null>> = {}) => ({
  "Data Entrada": "2024-06-01T10:00:00.000Z",
  "Data Saída": "2024-06-02T18:00:00.000Z",
  "Nome Cliente": "João Silva",
  Telefone: "11999999999",
  "Modelo Moto": "Honda CG 150",
  Placa: "ABC-1234",
  "Forma Pagamento": "pix",
  "Status Pagamento": "pago",
  "Valor Serviço": 150.0,
  Frete: 20.0,
  Total: 170.0,
  ...overrides,
});

describe("useRelatorioExcel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Happy path: datas definidas ---
  it("chama rpc com datas definidas quando dataInicio e dataFim sao fornecidos", async () => {
    const mockData = [rowFactory(), rowFactory({ "Nome Cliente": "Maria" })];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("fn_relatorio_por_periodo", {
      data_inicio: "2024-06-01",
      data_fim: "2024-06-30",
    });
  });

  // --- Happy path: retorno das 11 colunas ---
  it("retorna dados com todas as 11 colunas de RelatorioExcelRow", async () => {
    const mockData = [rowFactory()];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(result.current.data).toHaveLength(1);
    const row = result.current.data[0];
    expect(row).toHaveProperty("Data Entrada");
    expect(row).toHaveProperty("Data Saída");
    expect(row).toHaveProperty("Nome Cliente");
    expect(row).toHaveProperty("Telefone");
    expect(row).toHaveProperty("Modelo Moto");
    expect(row).toHaveProperty("Placa");
    expect(row).toHaveProperty("Forma Pagamento");
    expect(row).toHaveProperty("Status Pagamento");
    expect(row).toHaveProperty("Valor Serviço");
    expect(row).toHaveProperty("Frete");
    expect(row).toHaveProperty("Total");
  });

  // --- Edge case: dataInicio indefinida usa sentinela 1970-01-01 ---
  it("usa sentinela 1970-01-01 quando dataInicio é indefinida", async () => {
    const mockData = [rowFactory()];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (result.current.fetchRelatorio as any)(undefined, new Date("2024-06-30"));
    });

    expect(mockRpc).toHaveBeenCalledWith("fn_relatorio_por_periodo", {
      data_inicio: SENTINEL_START,
      data_fim: "2024-06-30",
    });
  });

  // --- Edge case: dataFim indefinida usa sentinela 2099-12-31 ---
  it("usa sentinela 2099-12-31 quando dataFim é indefinida", async () => {
    const mockData = [rowFactory()];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (result.current.fetchRelatorio as any)(new Date("2024-06-01"), undefined);
    });

    expect(mockRpc).toHaveBeenCalledWith("fn_relatorio_por_periodo", {
      data_inicio: "2024-06-01",
      data_fim: SENTINEL_END,
    });
  });

  // --- Edge case: ambas indefinidas usam ambas sentinelas ---
  it("usa ambas sentinelas quando ambas as datas sao indefinidas", async () => {
    const mockData = [rowFactory()];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (result.current.fetchRelatorio as any)(undefined, undefined);
    });

    expect(mockRpc).toHaveBeenCalledWith("fn_relatorio_por_periodo", {
      data_inicio: SENTINEL_START,
      data_fim: SENTINEL_END,
    });
  });

  // --- Edge case: erro do RPC seta error state ---
  it("define error state quando RPC retorna erro", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Erro interno" },
    });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(result.current.error).toBeTruthy();
  });

  // --- Edge case: data null/undefined no resultado e tratada ---
  it("trata linhas com valores null/undefined sem lancar erro", async () => {
    const mockData = [
      rowFactory({
        "Data Entrada": null,
        "Data Saída": null,
        Telefone: null,
        Placa: null,
        "Forma Pagamento": null,
        "Status Pagamento": null,
      }),
    ];
    mockRpc.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  // --- Edge case: RPC retorna array vazio ---
  it("retorna array vazio quando RPC retorna null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(result.current.data).toEqual([]);
  });
});
