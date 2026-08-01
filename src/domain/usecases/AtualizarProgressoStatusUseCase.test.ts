import { describe, it, expect, vi } from "vitest";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { AtualizarProgressoStatusUseCase } from "@/domain/usecases/AtualizarProgressoStatusUseCase";

const buildEntradaRepository = (): EntradaRepository => ({
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorClienteId: vi.fn(),
  buscarPorMotoId: vi.fn(),
  buscarPorStatus: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn().mockResolvedValue({}),
  deletar: vi.fn(),
  buscarPagina: vi.fn(),
});

describe("AtualizarProgressoStatusUseCase — propagação de statusEntrega", () => {
  it("propaga statusEntrega: 'pendente' pra entradaRepo.atualizar quando reabrindo", async () => {
    // Cenário do bug: usuário clica "Reabrir" num card concluído. Sem
    // propagar statusEntrega, a entrada fica com `status=pendente` mas
    // `statusEntrega=entregue`, e o filtro server-side da aba
    // "Concluídos" (statusEntrega IN ('entregue', 'retirado')) mantém
    // o card lá — com botão "Iniciar" incoerente.
    const entradaRepo = buildEntradaRepository();
    const useCase = new AtualizarProgressoStatusUseCase(entradaRepo);

    await useCase.execute("entrada-1", {
      status: "pendente",
      dataConclusao: null,
      formaPagamento: null,
      statusEntrega: "pendente",
    });

    expect(entradaRepo.atualizar).toHaveBeenCalledWith(
      "entrada-1",
      expect.objectContaining({
        status: "pendente",
        statusEntrega: "pendente",
        dataConclusao: null,
        formaPagamento: null,
      })
    );
  });

  it("permite OMITIR statusEntrega (não é obrigatório — mantém compat com calls antigos)", async () => {
    // Garante que callers que não passam statusEntrega (ex: ajuste só
    // de progresso, sem reabrir) continuam funcionando.
    const entradaRepo = buildEntradaRepository();
    const useCase = new AtualizarProgressoStatusUseCase(entradaRepo);

    await useCase.execute("entrada-1", {
      progresso: 50,
    });

    expect(entradaRepo.atualizar).toHaveBeenCalledWith(
      "entrada-1",
      expect.objectContaining({ progresso: 50 })
    );
    // statusEntrega NÃO é tocado quando omitido.
    const callArgs = (entradaRepo.atualizar as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty("statusEntrega");
  });
});
