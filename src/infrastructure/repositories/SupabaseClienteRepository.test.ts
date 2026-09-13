import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";

// Mock do cliente Supabase: o repositório de clientes usa apenas
// `supabase.from("clientes")` com o contrato fluent padrão.
vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/infrastructure/supabase/client";

const mockedFrom = vi.mocked(supabase.from);

/**
 * Linha crua como o Postgres devolve (snake_case), já com a coluna
 * `cpf_cnpj` adicionada pela migration 28.
 */
const linhaCliente = (overrides: Record<string, unknown> = {}) => ({
  id: "cliente-1",
  nome: "João Motoqueiro",
  telefone: "11999998888",
  email: "joao@example.com",
  endereco: "Rua das Motos, 10",
  cep: "01310000",
  cpf_cnpj: "52998224725",
  numero_servicos: 3,
  criado_em: "2026-01-10T12:00:00Z",
  atualizado_em: "2026-01-11T12:00:00Z",
  ...overrides,
});

/**
 * Query builder mockado: registra o payload de insert/update e resolve
 * com a linha configurada ao final da cadeia `.select().single()`.
 */
const buildChain = (linha: unknown) => {
  const insert = vi.fn();
  const update = vi.fn();
  const chain: Record<string, unknown> = {};
  const self = () => chain;

  for (const metodo of ["select", "eq", "order", "ilike", "or"]) {
    chain[metodo] = vi.fn(self);
  }
  chain.single = vi.fn(async () => ({ data: linha, error: null }));
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: [linha], error: null }).then(resolve);
  chain.insert = insert.mockImplementation(self);
  chain.update = update.mockImplementation(self);

  mockedFrom.mockReturnValue(chain as never);
  return { insert, update };
};

describe("SupabaseClienteRepository — CPF/CNPJ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envia o cpf_cnpj no insert ao criar cliente", async () => {
    const { insert } = buildChain(linhaCliente());

    await new SupabaseClienteRepository().criar({
      nome: "João Motoqueiro",
      telefone: "11999998888",
      cpfCnpj: "52998224725",
      numeroServicos: 0,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ cpf_cnpj: "52998224725" })
    );
  });

  it("envia o cpf_cnpj no update ao atualizar cliente", async () => {
    const { update } = buildChain(linhaCliente({ cpf_cnpj: "11222333000181" }));

    await new SupabaseClienteRepository().atualizar("cliente-1", {
      nome: "João Motoqueiro",
      cpfCnpj: "11222333000181",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cpf_cnpj: "11222333000181" })
    );
  });

  it("mapeia cpf_cnpj para cpfCnpj ao ler um cliente", async () => {
    buildChain(linhaCliente());

    const cliente = await new SupabaseClienteRepository().buscarPorId("cliente-1");

    expect(cliente?.cpfCnpj).toBe("52998224725");
  });

  it("mapeia cpf_cnpj ausente como undefined (campo opcional)", async () => {
    buildChain(linhaCliente({ cpf_cnpj: null }));

    const cliente = await new SupabaseClienteRepository().buscarPorId("cliente-1");

    expect(cliente?.cpfCnpj).toBeUndefined();
  });

  it("mapeia cpf_cnpj também na listagem", async () => {
    buildChain(linhaCliente());

    const clientes = await new SupabaseClienteRepository().listar();

    expect(clientes[0].cpfCnpj).toBe("52998224725");
  });
});
