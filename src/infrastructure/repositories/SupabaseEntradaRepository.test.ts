import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";

// Mock do cliente Supabase: para `buscarPagina` precisamos encadear várias
// chamadas `.from(...)` (entradas, count, clientes, motos, fotos,
// entradas_tipos_servico, tipos_servico) e mais o `storage.from(...)` para
// signed URLs das fotos.
vi.mock("@/infrastructure/supabase/client", () => {
  const dbFrom = vi.fn();
  const storageFrom = vi.fn();
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: dbFrom,
      storage: { from: storageFrom },
    },
  };
});

import { supabase } from "@/infrastructure/supabase/client";

const mockedDbFrom = vi.mocked(supabase.from);
const mockedStorageFrom = vi.mocked(supabase.storage.from);

/**
 * Monta o duplo de teste do bucket de storage, expondo o spy de
 * `createSignedUrl` para observarmos os argumentos recebidos.
 */
const buildBucket = () => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.example/moto.jpg" },
    error: null,
  });
  mockedStorageFrom.mockReturnValue({ createSignedUrl } as never);
  return { createSignedUrl };
};

/**
 * Encadeia um query builder mockado. Cada método encadeável termina
 * devolvendo `terminal`, simulando o contrato fluent da Supabase JS.
 */
const buildQueryChain = <T>(terminal: T) => {
  const chain: any = {};
  chain.then = (resolve: (v: T) => unknown) =>
    Promise.resolve(terminal).then(resolve);
  chain.catch = () => chain;

  for (const method of [
    "select",
    "eq",
    "in",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "or",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  return chain;
};

/**
 * Configura o dispatcher de `supabase.from(...)` retornando o chain certo
 * por nome de tabela. `entradas` alterna entre o chain da página principal
 * (1ª chamada) e o chain da contagem exata (2ª chamada).
 */
const setupPagedEntradas = () => {
  const clienteId = "11111111-1111-4111-8111-111111111111";
  const motoId = "22222222-2222-4222-8222-222222222222";

  const entradasChain = buildQueryChain({
    data: [
      {
        id: "entrada-1",
        cliente_id: clienteId,
        moto_id: motoId,
        descricao: "Revisão geral",
        status: "pendente",
        status_entrega: "pendente",
        tipo: "entrada",
        progresso: 0,
        criado_em: "2025-01-01T00:00:00Z",
        atualizado_em: "2025-01-01T00:00:00Z",
        frete: null,
      },
    ],
    error: null,
  });

  const countChain = buildQueryChain({
    data: null,
    error: null,
    count: 42,
  });

  const clientesChain = buildQueryChain({
    data: [{ id: clienteId, nome: "Cliente", telefone: "123" }],
    error: null,
  });
  const motosChain = buildQueryChain({
    data: [{ id: motoId, modelo: "CG", placa: "ABC1D23" }],
    error: null,
  });
  const fotosChain = buildQueryChain({ data: [], error: null });
  const vinculosChain = buildQueryChain({ data: [], error: null });
  const tiposChain = buildQueryChain({ data: [], error: null });

  let entradasCall = 0;
  mockedDbFrom.mockImplementation(((table: string) => {
    if (table === "entradas") {
      entradasCall += 1;
      return entradasCall === 1 ? entradasChain : countChain;
    }
    if (table === "clientes") return clientesChain;
    if (table === "motos") return motosChain;
    if (table === "fotos") return fotosChain;
    if (table === "entradas_tipos_servico") return vinculosChain;
    if (table === "tipos_servico") return tiposChain;
    return buildQueryChain({ data: [], error: null });
  }) as never);

  return {
    entradasChain,
    countChain,
    clientesChain,
    motosChain,
    fotosChain,
    vinculosChain,
    tiposChain,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SupabaseEntradaRepository — paginação", () => {
  it("aplica .range() + .order() + limit() na query de página e contagem exata head=true", async () => {
    buildBucket();
    const { entradasChain, countChain } = setupPagedEntradas();

    const pagina = await new SupabaseEntradaRepository().buscarPagina({
      page: 2,
      pageSize: 10,
    });

    // Faixa da página 2 com pageSize 10: from=10, to=19
    expect(entradasChain.range).toHaveBeenCalledWith(10, 19);
    expect(entradasChain.order).toHaveBeenCalledWith("criado_em", {
      ascending: false,
    });
    // .order() deve vir antes de .limit() para garantir a ordenação correta
    expect(entradasChain.order.mock.invocationCallOrder[0]).toBeLessThan(
      entradasChain.limit.mock.invocationCallOrder[0]
    );
    expect(entradasChain.limit).toHaveBeenCalledWith(10);

    // Query de contagem exata, sem corpo, apenas o count
    expect(countChain.select).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });

    expect(pagina).toMatchObject({
      total: 42,
      page: 2,
      pageSize: 10,
    });
  });

  it("aplica .eq('tipo', ...) quando o filtro tipo é informado", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      tipo: "entrada",
    });

    expect(entradasChain.eq).toHaveBeenCalledWith("tipo", "entrada");
  });

  it("aplica .in('status_entrega', [...]) quando statusEntrega é informado", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      statusEntrega: ["pendente", "entregue"],
    });

    expect(entradasChain.in).toHaveBeenCalledWith("status_entrega", [
      "pendente",
      "entregue",
    ]);
  });

  it("aplica .in('status', [...]) quando status é informado", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      status: ["concluido"],
    });

    expect(entradasChain.in).toHaveBeenCalledWith("status", ["concluido"]);
  });

  it("gera .or(...) quando busca é informada", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      busca: "CG",
    });

    expect(entradasChain.or).toHaveBeenCalledTimes(1);
    // O argumento deve conter o termo de busca (não-string vazia)
    const arg = entradasChain.or.mock.calls[0][0] as string;
    expect(arg).toContain("CG");
  });

  it("não aplica .eq('tipo', ...) quando tipo é omitido", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(entradasChain.eq).not.toHaveBeenCalledWith(
      "tipo",
      expect.anything()
    );
  });

  it("não aplica .in('status_entrega', ...) quando statusEntrega é omitido", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(entradasChain.in).not.toHaveBeenCalledWith(
      "status_entrega",
      expect.any(Array)
    );
  });

  it("não aplica .or(...) quando busca é omitida", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(entradasChain.or).not.toHaveBeenCalled();
  });

  it("lança erro com mensagem clara quando a query principal falha", async () => {
    buildBucket();
    const errorChain = buildQueryChain({ data: null, error: { message: "boom" } });
    mockedDbFrom.mockReturnValue(errorChain);

    await expect(
      new SupabaseEntradaRepository().buscarPagina({ page: 1, pageSize: 10 })
    ).rejects.toThrow(/Erro ao buscar entradas.*boom/);
  });
});
