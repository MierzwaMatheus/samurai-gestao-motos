import { describe, it, expect, vi } from "vitest";

import { CriarEntradaUseCase } from "@/domain/usecases/CriarEntradaUseCase";
import { DadosCadastro } from "@shared/types";

/**
 * O CPF/CNPJ segue a mesma regra já usada para o telefone: ao cadastrar
 * uma entrada, o documento informado é gravado no cliente novo e
 * atualiza o cadastro do cliente existente quando divergir do que está
 * salvo.
 */
const clienteExistente = (overrides: Record<string, unknown> = {}) => ({
  id: "cliente-1",
  nome: "João Motoqueiro",
  telefone: "11999998888",
  numeroServicos: 1,
  criadoEm: new Date("2026-01-01"),
  atualizadoEm: new Date("2026-01-01"),
  ...overrides,
});

const montarUseCase = (clientes: Record<string, unknown> = {}) => {
  const clienteRepo = {
    criar: vi.fn().mockResolvedValue(clienteExistente()),
    buscarPorId: vi.fn().mockResolvedValue(clienteExistente()),
    buscarPorNome: vi.fn().mockResolvedValue([]),
    buscarPorNomeOuTelefone: vi.fn(),
    listar: vi.fn(),
    atualizar: vi.fn().mockResolvedValue(clienteExistente()),
    deletar: vi.fn(),
    ...clientes,
  };
  const motoRepo = { criar: vi.fn().mockResolvedValue({ id: "moto-1" }) };
  const entradaRepo = {
    criar: vi.fn().mockResolvedValue({ id: "entrada-1" }),
    buscarPorId: vi.fn().mockResolvedValue({ id: "entrada-1" }),
  };
  const orcamentoRepo = { criar: vi.fn() };
  const tipoServicoRepo = { vincularAEntrada: vi.fn(), listar: vi.fn() };
  const servicoPersonalizadoRepo = { criar: vi.fn() };

  const useCase = new CriarEntradaUseCase(
    clienteRepo as never,
    motoRepo as never,
    entradaRepo as never,
    orcamentoRepo as never,
    tipoServicoRepo as never,
    servicoPersonalizadoRepo as never
  );

  return { useCase, clienteRepo };
};

const dadosBase: DadosCadastro = {
  tipo: "entrada",
  cliente: "João Motoqueiro",
  moto: "CB 500",
  fotos: [],
  frete: null,
};

describe("CriarEntradaUseCase — CPF/CNPJ do cliente", () => {
  it("grava o CPF/CNPJ ao criar um cliente novo", async () => {
    const { useCase, clienteRepo } = montarUseCase();

    await useCase.execute({ ...dadosBase, cpfCnpj: "52998224725" });

    expect(clienteRepo.criar).toHaveBeenCalledWith(
      expect.objectContaining({ cpfCnpj: "52998224725" })
    );
  });

  it("grava apenas os dígitos quando o documento vem formatado do formulário", async () => {
    const { useCase, clienteRepo } = montarUseCase();

    await useCase.execute({ ...dadosBase, cpfCnpj: "529.982.247-25" });

    expect(clienteRepo.criar).toHaveBeenCalledWith(
      expect.objectContaining({ cpfCnpj: "52998224725" })
    );
  });

  it("cria o cliente sem documento quando o campo não foi informado", async () => {
    const { useCase, clienteRepo } = montarUseCase();

    await useCase.execute({ ...dadosBase });

    expect(clienteRepo.criar).toHaveBeenCalledWith(
      expect.objectContaining({ cpfCnpj: undefined })
    );
  });

  it("atualiza o cadastro do cliente existente quando o documento muda", async () => {
    const { useCase, clienteRepo } = montarUseCase({
      buscarPorId: vi.fn().mockResolvedValue(clienteExistente({ cpfCnpj: "11222333000181" })),
    });

    await useCase.execute({
      ...dadosBase,
      clienteId: "cliente-1",
      cpfCnpj: "52998224725",
    });

    expect(clienteRepo.atualizar).toHaveBeenCalledWith(
      "cliente-1",
      expect.objectContaining({ cpfCnpj: "52998224725" })
    );
  });

  it("não reescreve o cadastro quando o documento informado é igual ao salvo", async () => {
    const { useCase, clienteRepo } = montarUseCase({
      buscarPorId: vi.fn().mockResolvedValue(clienteExistente({ cpfCnpj: "52998224725" })),
    });

    await useCase.execute({
      ...dadosBase,
      clienteId: "cliente-1",
      cpfCnpj: "52998224725",
    });

    expect(clienteRepo.atualizar).not.toHaveBeenCalled();
  });

  it("não apaga o documento salvo quando o campo vem vazio", async () => {
    const { useCase, clienteRepo } = montarUseCase({
      buscarPorId: vi.fn().mockResolvedValue(clienteExistente({ cpfCnpj: "52998224725" })),
    });

    await useCase.execute({ ...dadosBase, clienteId: "cliente-1", cpfCnpj: "" });

    expect(clienteRepo.atualizar).not.toHaveBeenCalled();
  });

  it("atualiza o telefone do cliente existente quando ele muda", async () => {
    const { useCase, clienteRepo } = montarUseCase({
      buscarPorId: vi.fn().mockResolvedValue(clienteExistente({ telefone: "11888887777" })),
    });

    await useCase.execute({
      ...dadosBase,
      clienteId: "cliente-1",
      telefone: "11999998888",
    });

    expect(clienteRepo.atualizar).toHaveBeenCalledWith(
      "cliente-1",
      expect.objectContaining({ telefone: "11999998888" })
    );
  });

  it("não toca no cadastro quando o telefone informado é o mesmo já salvo", async () => {
    const { useCase, clienteRepo } = montarUseCase({
      buscarPorId: vi.fn().mockResolvedValue(clienteExistente({ telefone: "11999998888" })),
    });

    await useCase.execute({
      ...dadosBase,
      clienteId: "cliente-1",
      telefone: "11999998888",
    });

    expect(clienteRepo.atualizar).not.toHaveBeenCalled();
  });

  it("não apaga o telefone salvo quando o campo vem vazio", async () => {
    const { useCase, clienteRepo } = montarUseCase({
      buscarPorId: vi.fn().mockResolvedValue(clienteExistente({ telefone: "11999998888" })),
    });

    await useCase.execute({ ...dadosBase, clienteId: "cliente-1", telefone: "" });

    expect(clienteRepo.atualizar).not.toHaveBeenCalled();
  });

  it("atualiza o documento do cliente encontrado por nome", async () => {
    const { useCase, clienteRepo } = montarUseCase({
      buscarPorNome: vi.fn().mockResolvedValue([clienteExistente()]),
    });

    await useCase.execute({ ...dadosBase, cpfCnpj: "52998224725" });

    expect(clienteRepo.criar).not.toHaveBeenCalled();
    expect(clienteRepo.atualizar).toHaveBeenCalledWith(
      "cliente-1",
      expect.objectContaining({ cpfCnpj: "52998224725" })
    );
  });
});
