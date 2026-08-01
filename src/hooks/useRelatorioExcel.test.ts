import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock do módulo supabase - vi.mock é hoisted, factory retorna o mock
vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { useRelatorioExcel } from "./useRelatorioExcel";
import { supabase } from "@/infrastructure/supabase/client";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

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

// ============================================================
// CICLO 3 — Mutation Testing: mata sobreviventes CRÍTICOS/ALTOS
// ============================================================

describe("useRelatorioExcel - mutation gate (initial state, loading, deps)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Estado inicial deve ser data=[] (linha 22 ArrayDeclaration) ---
  it("deve iniciar com data como array vazio", () => {
    const { result } = renderHook(() => useRelatorioExcel());

    expect(result.current.data).toEqual([]);
    expect(result.current.data).toHaveLength(0);
  });

  // --- Estado inicial deve ser isLoading=false (linha 23 BooleanLiteral) ---
  it("deve iniciar com isLoading=false", () => {
    const { result } = renderHook(() => useRelatorioExcel());

    expect(result.current.isLoading).toBe(false);
  });

  // --- Estado inicial deve ser error=null ---
  it("deve iniciar com error=null", () => {
    const { result } = renderHook(() => useRelatorioExcel());

    expect(result.current.error).toBeNull();
  });

  // --- setIsLoading(true) ao iniciar fetch (linha 28 BooleanLiteral) ---
  it("deve setar isLoading=true durante o fetch", async () => {
    let resolveRpc: (value: any) => void = () => {};
    mockRpc.mockReturnValueOnce(new Promise((resolve) => {
      resolveRpc = resolve;
    }));

    const { result } = renderHook(() => useRelatorioExcel());

    // Antes do fetch: isLoading=false
    expect(result.current.isLoading).toBe(false);

    // Inicia fetch (sem await para capturar estado intermediário)
    let fetchPromise: Promise<any>;
    act(() => {
      fetchPromise = result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    // Durante o fetch: isLoading=true
    await act(async () => {
      // Microtask para permitir que setIsLoading(true) seja aplicado
      await Promise.resolve();
    });
    expect(result.current.isLoading).toBe(true);

    // Resolve o RPC
    await act(async () => {
      resolveRpc({ data: [], error: null });
      await fetchPromise;
    });

    // Após fetch: isLoading=false
    expect(result.current.isLoading).toBe(false);
  });

  // --- finally block deve sempre setar isLoading=false (linha 51 BlockStatement, linha 52 BooleanLiteral) ---
  it("deve setar isLoading=false mesmo quando RPC rejeita", async () => {
    mockRpc.mockRejectedValueOnce(new Error("Falha de conexão"));

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Falha de conexão");
  });

  // --- finally block com erro retornado em { error } ---
  it("deve setar isLoading=false quando RPC retorna { error }", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "Erro" } });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  // --- return [] em catch (linha 50 ArrayDeclaration) ---
  it("deve retornar array vazio quando RPC falha", async () => {
    mockRpc.mockRejectedValueOnce(new Error("Falha"));

    const { result } = renderHook(() => useRelatorioExcel());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.fetchRelatorio(
        new Date("2024-06-01"),
        new Date("2024-06-30")
      );
    });

    expect(returnValue).toEqual([]);
    expect(result.current.data).toEqual([]);
  });

  // --- useCallback deve manter identidade entre renders (linha 55 ArrayDeclaration) ---
  it("fetchRelatorio deve ter identidade estável entre renders (deps=[])", () => {
    const { result, rerender } = renderHook(() => useRelatorioExcel());

    const firstRef = result.current.fetchRelatorio;
    rerender();
    const secondRef = result.current.fetchRelatorio;

    expect(firstRef).toBe(secondRef);
  });
});

describe("useRelatorioExcel - atualizarStatusPagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Quando status="pago", data_pagamento deve ser ISO atual ---
  it("deve definir data_pagamento como ISO atual quando status=pago", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const fromResult = {
      update: mockUpdate,
    };
    mockFrom.mockReturnValue(fromResult);

    const { result } = renderHook(() => useRelatorioExcel());

    const before = Date.now();
    await act(async () => {
      await result.current.atualizarStatusPagamento("entrada-123", "pago");
    });
    const after = Date.now();

    expect(mockFrom).toHaveBeenCalledWith("entradas");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updates = mockUpdate.mock.calls[0][0];
    expect(updates.status_pagamento).toBe("pago");
    expect(updates.data_pagamento).toBeTruthy();

    // data_pagamento deve ser um ISO string próximo de agora
    const dataPagamentoTime = new Date(updates.data_pagamento as string).getTime();
    expect(dataPagamentoTime).toBeGreaterThanOrEqual(before - 100);
    expect(dataPagamentoTime).toBeLessThanOrEqual(after + 100);

    // atualizado_em também deve ser definido
    expect(updates.atualizado_em).toBeTruthy();
    const atualizadoEmTime = new Date(updates.atualizado_em as string).getTime();
    expect(atualizadoEmTime).toBeGreaterThanOrEqual(before - 100);
    expect(atualizadoEmTime).toBeLessThanOrEqual(after + 100);

    // eq("id", entradaId) deve ser chamado
    const eqFn = fromResult.update.mock.results[0].value.eq;
    expect(eqFn).toHaveBeenCalledWith("id", "entrada-123");
  });

  // --- Quando status="pendente", data_pagamento deve ser null ---
  it("deve definir data_pagamento=null quando status=pendente", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const fromResult = {
      update: mockUpdate,
    };
    mockFrom.mockReturnValue(fromResult);

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await result.current.atualizarStatusPagamento("entrada-456", "pendente");
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updates = mockUpdate.mock.calls[0][0];
    expect(updates.status_pagamento).toBe("pendente");
    expect(updates.data_pagamento).toBeNull();
    expect(updates.atualizado_em).toBeTruthy();
  });

  // --- Deve lançar erro se update falhar ---
  it("deve lancar erro quando update retorna error", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
    });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await expect(
        result.current.atualizarStatusPagamento("entrada-789", "pago")
      ).rejects.toBeDefined();
    });
  });

  // --- useCallback deve manter identidade (linha 74 ArrayDeclaration) ---
  it("atualizarStatusPagamento deve ter identidade estável entre renders (deps=[])", () => {
    const { result, rerender } = renderHook(() => useRelatorioExcel());

    const firstRef = result.current.atualizarStatusPagamento;
    rerender();
    const secondRef = result.current.atualizarStatusPagamento;

    expect(firstRef).toBe(secondRef);
  });
});

describe("useRelatorioExcel - atualizarFormaPagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Deve chamar update com forma_pagamento e atualizado_em ---
  it("deve atualizar forma_pagamento e atualizado_em", async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { result } = renderHook(() => useRelatorioExcel());

    const before = Date.now();
    await act(async () => {
      await result.current.atualizarFormaPagamento("entrada-001", "credito");
    });
    const after = Date.now();

    expect(mockFrom).toHaveBeenCalledWith("entradas");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updates = mockUpdate.mock.calls[0][0];
    expect(updates.forma_pagamento).toBe("credito");
    expect(updates.atualizado_em).toBeTruthy();

    const atualizadoEmTime = new Date(updates.atualizado_em as string).getTime();
    expect(atualizadoEmTime).toBeGreaterThanOrEqual(before - 100);
    expect(atualizadoEmTime).toBeLessThanOrEqual(after + 100);

    expect(mockEq).toHaveBeenCalledWith("id", "entrada-001");
  });

  // --- Deve lançar erro se update falhar ---
  it("deve lancar erro quando update retorna error", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
    });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { result } = renderHook(() => useRelatorioExcel());

    await act(async () => {
      await expect(
        result.current.atualizarFormaPagamento("entrada-002", "pix")
      ).rejects.toBeDefined();
    });
  });

  // --- useCallback deve manter identidade (linha 91 ArrayDeclaration) ---
  it("atualizarFormaPagamento deve ter identidade estável entre renders (deps=[])", () => {
    const { result, rerender } = renderHook(() => useRelatorioExcel());

    const firstRef = result.current.atualizarFormaPagamento;
    rerender();
    const secondRef = result.current.atualizarFormaPagamento;

    expect(firstRef).toBe(secondRef);
  });
});


// ============================================================
// CICLO 3b — Mutation Testing: cobre exportToExcel + helpers
// ============================================================

/**
 * Helper: executa exportToExcel capturando o CSV gerado e o click no link.
 * Usa DOM real do jsdom mas substitui click por spy para evitar download.
 */
let exportToExcelFn: any;
beforeAll(async () => {
  const mod = await import("./useRelatorioExcel");
  exportToExcelFn = mod.exportToExcel;
});

function captureExport(sample: any[], filename?: string): { csv: string; downloadName: string; clicked: boolean } {
  // exportToExcel é importado via "export function exportToExcel" no topo do test? Não — precisamos usar dynamic import.
  // Como o test file está em ESM, usamos o modulo já importado (useRelatorioExcel).
  // Mas exportToExcel está em ./useRelatorioExcel — vamos usar o namespace.
  // Truque: re-importar dinamicamente para acessar exportToExcel.
  const blobParts: string[] = [];
  const originalBlob = global.Blob;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  // Mock Blob para capturar conteúdo CSV
  const BlobMock = vi.fn().mockImplementation((parts: any[], options: any) => {
    blobParts.push(parts.join(""));
    return new originalBlob(parts, options);
  });
  global.Blob = BlobMock as any;
  URL.createObjectURL = vi.fn().mockReturnValue("blob:test");
  URL.revokeObjectURL = vi.fn();

  // Spy no HTMLAnchorElement.prototype.click para capturar invocações sem disparar download real
  let clicked = false;
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    clicked = true;
  };

  // Captura o filename via setAttribute
  let downloadName = "";
  const realSetAttr = HTMLAnchorElement.prototype.setAttribute;
  HTMLAnchorElement.prototype.setAttribute = function (name: string, value: string) {
    if (name === "download") downloadName = value;
    return realSetAttr.call(this, name, value);
  };

  try {
    exportToExcelFn(sample, filename);
  } finally {
    global.Blob = originalBlob;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = realClick;
    HTMLAnchorElement.prototype.setAttribute = realSetAttr;
  }

  return { csv: blobParts[0] || "", downloadName, clicked };
}

describe("exportToExcel + formatadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve gerar CSV com headers e linhas formatadas", async () => {
    const sample = [rowFactory()];
    const { csv, clicked } = captureExport(sample, "test");

    expect(clicked).toBe(true);
    expect(csv).toContain("Data Entrada");
    expect(csv).toContain("Nome Cliente");
    expect(csv).toContain("Valor Serviço");
    expect(csv).toContain("João Silva");
    expect(csv).toContain("Honda CG 150");
    expect(csv).toContain("ABC-1234");
    expect(csv).toContain("11999999999");
    // Forma pix → "Pix"
    expect(csv).toContain("Pix");
    // Status pago → "Pago"
    expect(csv).toContain("Pago");
    // Formatado: moeda BRL
    expect(csv).toMatch(/R\$/);
  });

  it("deve usar filename padrão 'relatorio' quando não fornecido", async () => {
    const sample = [rowFactory()];
    const { downloadName } = captureExport(sample);
    expect(downloadName).toMatch(/^relatorio_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("deve usar filename customizado quando fornecido", async () => {
    const sample = [rowFactory()];
    const { downloadName } = captureExport(sample, "vendas-junho");
    expect(downloadName).toMatch(/^vendas-junho_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("deve disparar click no link de download", async () => {
    const sample = [rowFactory()];
    const { clicked } = captureExport(sample, "test");
    expect(clicked).toBe(true);
  });

  it("deve formatar campos null como string vazia em colunas de texto", async () => {
    const sample = [
      rowFactory({
        "Data Entrada": null,
        "Data Saída": null,
        Telefone: null,
        Placa: null,
      }),
    ];
    const { csv } = captureExport(sample, "test");
    expect(csv).toContain("Data Entrada");
    // Cada linha com null gera string vazia → CSV ainda tem header + 1 linha
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
  });

  it("deve formatar forma_pagamento 'credito' como 'Cartão Crédito'", async () => {
    const sample = [rowFactory({ "Forma Pagamento": "credito" })];
    const { csv } = captureExport(sample, "test");
    expect(csv).toContain("Cartão Crédito");
  });

  it("deve formatar forma_pagamento 'debito' como 'Cartão Débito'", async () => {
    const sample = [rowFactory({ "Forma Pagamento": "debito" })];
    const { csv } = captureExport(sample, "test");
    expect(csv).toContain("Cartão Débito");
  });

  it("deve formatar forma_pagamento 'boleto' como 'Boleto'", async () => {
    const sample = [rowFactory({ "Forma Pagamento": "boleto" })];
    const { csv } = captureExport(sample, "test");
    expect(csv).toContain("Boleto");
  });

  it("deve usar fallback quando forma_pagamento é desconhecida", async () => {
    const sample = [rowFactory({ "Forma Pagamento": "criptomoeda" })];
    const { csv } = captureExport(sample, "test");
    // Forma desconhecida → mantém o valor original
    expect(csv).toContain("criptomoeda");
  });

  it("deve formatar forma_pagamento null como '-'", async () => {
    const sample = [rowFactory({ "Forma Pagamento": null, Placa: "" })];
    const { csv } = captureExport(sample, "test");
    // Placa vazia (sem '-') para evitar match com placa
    expect(csv).toContain("-");
  });

  it("deve formatar status_pagamento 'pendente' como 'Pendente'", async () => {
    const sample = [rowFactory({ "Status Pagamento": "pendente" })];
    const { csv } = captureExport(sample, "test");
    expect(csv).toContain("Pendente");
  });

  it("deve formatar status_pagamento null como 'Pendente'", async () => {
    const sample = [rowFactory({ "Status Pagamento": null, "Forma Pagamento": "" })];
    const { csv } = captureExport(sample, "test");
    // Verifica que existe 'Pendente' no CSV (do formatarStatusPagamento(null))
    // E que a Forma Pagamento está como '-' (mapeamento de null → '-')
    expect(csv).toContain("Pendente");
    expect(csv).toContain('"-"');
  });

  it("deve formatar valores monetários em BRL com casas decimais", async () => {
    const sample = [rowFactory({ "Valor Serviço": 150.5, Frete: 20.25, Total: 170.75 })];
    const { csv } = captureExport(sample, "test");
    expect(csv).toMatch(/R\$\s*150,50/);
    expect(csv).toMatch(/R\$\s*20,25/);
    expect(csv).toMatch(/R\$\s*170,75/);
  });

  it("deve gerar CSV com múltiplas linhas", async () => {
    const sample = [rowFactory(), rowFactory({ "Nome Cliente": "Maria" })];
    const { csv } = captureExport(sample, "test");
    expect(csv).toContain("João Silva");
    expect(csv).toContain("Maria");
    // header + 2 linhas
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
  });

  it("deve gerar CSV vazio (só headers) para array vazio", async () => {
    const { csv } = captureExport([], "test");
    expect(csv).toContain("Data Entrada");
    const lines = csv.split("\n");
    expect(lines.length).toBe(1);
  });
});
