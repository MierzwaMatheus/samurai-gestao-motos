import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseOrcamentoRepository } from "@/infrastructure/repositories/SupabaseOrcamentoRepository";
import { transformPorTipo } from "@/infrastructure/storage/imageTransforms";

// Mock do cliente Supabase: precisamos encadear várias chamadas `.from(...)`
// (orcamentos, entradas, clientes, motos, fotos) e `.rpc(...)` para a
// atualização de orçamentos expirados, mais o `storage.from("fotos")` para
// signed URLs.
vi.mock("@/infrastructure/supabase/client", () => {
  const dbFrom = vi.fn();
  const storageFrom = vi.fn();
  const rpc = vi.fn();
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: dbFrom,
      rpc,
      storage: { from: storageFrom },
    },
  };
});

import { supabase } from "@/infrastructure/supabase/client";

const mockedDbFrom = vi.mocked(supabase.from);
const mockedStorageFrom = vi.mocked(supabase.storage.from);
const mockedRpc = vi.mocked(supabase.rpc);

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
  // Cada método encadeável retorna o próximo elo, e o último retorna o
  // `terminal` quando resolvido/encadeado o suficiente.
  const chain: any = {};
  chain.then = (resolve: (v: T) => unknown) => Promise.resolve(terminal).then(resolve);
  chain.catch = () => chain;

  for (const method of ["select", "eq", "order", "in", "single"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  return chain;
};

/**
 * Configura o pipeline completo de mocks para `buscarCompletosPorStatus`,
 * retornando os dados que satisfazem o fluxo:
 * - 1 orçamento ativo;
 * - 1 entrada com cliente + moto;
 * - N fotos da moto (`tipo: moto`).
 */
const setupBuscarCompletosPorStatus = (
  fotos: Array<Record<string, unknown>>
) => {
  const orcamentos = [
    {
      id: "orc-1",
      entrada_id: "entrada-1",
      valor: 100,
      data_expiracao: "2099-01-01T00:00:00Z",
      status: "ativo",
      criado_em: "2025-01-01T00:00:00Z",
      atualizado_em: "2025-01-01T00:00:00Z",
    },
  ];
  const entradas = [
    {
      id: "entrada-1",
      descricao: "desc",
      frete: null,
      valor_cobrado: null,
      endereco: null,
      cep: null,
      data_orcamento: null,
      cliente_id: "cli-1",
      moto_id: "moto-1",
    },
  ];
  const clientes = [{ id: "cli-1", nome: "Cliente Teste", telefone: "123" }];
  const motos = [
    {
      id: "moto-1",
      modelo: "Modelo X",
      placa: "ABC-1234",
      marca: "Honda",
      ano: 2020,
      cilindrada: 150,
    },
  ];

  // rpc: atualizar_orcamentos_expirados → sucesso silencioso
  mockedRpc.mockResolvedValue({ data: null, error: null });

  // Despacha por nome de tabela para tornar a ordem de `.from(...)`
  // irrelevante — fica mais robusto contra refactors que reordenem
  // queries.
  mockedDbFrom.mockImplementation(((table: string) => {
    if (table === "orcamentos") {
      return buildQueryChain({ data: orcamentos, error: null });
    }
    if (table === "entradas") {
      return buildQueryChain({ data: entradas, error: null });
    }
    if (table === "clientes") {
      return buildQueryChain({ data: clientes, error: null });
    }
    if (table === "motos") {
      return buildQueryChain({ data: motos, error: null });
    }
    if (table === "fotos") {
      return buildQueryChain({ data: fotos, error: null });
    }
    return buildQueryChain({ data: null, error: null });
  }) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SupabaseOrcamentoRepository — application of image transformations", () => {
  describe("buscarCompletosPorStatus", () => {
    it("chama createSignedUrl com transformPorTipo('moto') na listagem (query de fotos filtra tipo=moto)", async () => {
      const { createSignedUrl } = buildBucket();

      setupBuscarCompletosPorStatus([
        {
          entrada_id: "entrada-1",
          url: "user/entrada/moto/foto.jpg",
        },
      ]);

      await new SupabaseOrcamentoRepository().buscarCompletosPorStatus(
        "ativo"
      );

      expect(createSignedUrl).toHaveBeenCalledTimes(1);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/foto.jpg",
        2592000,
        { transform: transformPorTipo("moto") }
      );
    });

    it("não chama createSignedUrl quando a foto da listagem já é URL completa (http)", async () => {
      const { createSignedUrl } = buildBucket();

      setupBuscarCompletosPorStatus([
        {
          entrada_id: "entrada-1",
          url: "https://already-signed.example/foto.jpg",
        },
      ]);

      await new SupabaseOrcamentoRepository().buscarCompletosPorStatus(
        "ativo"
      );

      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("chama createSignedUrl uma vez por entrada_id distinto, sempre com transformPorTipo('moto')", async () => {
      const { createSignedUrl } = buildBucket();

      // Deduplicação por entrada_id é o comportamento real da query —
      // cada entrada fica com apenas a primeira foto (a mais recente).
      setupBuscarCompletosPorStatus([
        {
          entrada_id: "entrada-1",
          url: "user/entrada/moto/a.jpg",
        },
        {
          entrada_id: "entrada-2",
          url: "user/entrada/moto/b.jpg",
        },
      ]);

      await new SupabaseOrcamentoRepository().buscarCompletosPorStatus(
        "ativo"
      );

      expect(createSignedUrl).toHaveBeenCalledTimes(2);
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/a.jpg",
        2592000,
        { transform: transformPorTipo("moto") }
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada/moto/b.jpg",
        2592000,
        { transform: transformPorTipo("moto") }
      );
    });
  });
});