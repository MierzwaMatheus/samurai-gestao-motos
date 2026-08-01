import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";

/**
 * Caso de uso: Atualizar progresso e status de uma entrada
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AtualizarProgressoStatusUseCase {
  constructor(private entradaRepo: EntradaRepository) {}

  async execute(
    entradaId: string,
    dados: {
      progresso?: number;
      status?: "pendente" | "alinhando" | "concluido";
      dataConclusao?: Date | null;
      formaPagamento?: "pix" | "credito" | "debito" | "boleto" | null;
      /**
       * Opcional. Usado no fluxo de "Reabrir" pra resetar a entrada
       * pra `statusEntrega = 'pendente'` junto com `status` — sem
       * isso, o card fica preso na aba "Concluídos" (filtro
       * server-side por statusEntrega) mesmo com `status =
       * 'pendente'`. Defaults a undefined (não toca no campo).
       */
      statusEntrega?: "pendente" | "entregue" | "retirado";
    }
  ): Promise<void> {
    // Validações de negócio
    if (!entradaId) {
      throw new Error("ID da entrada é obrigatório");
    }

    if (dados.progresso !== undefined) {
      if (dados.progresso < 0 || dados.progresso > 100) {
        throw new Error("Progresso deve estar entre 0 e 100");
      }
    }

    // Atualiza entrada. Monta o objeto apenas com os campos
    // efetivamente fornecidos — assim callers que omitem
    // `statusEntrega` (ex: ajuste só de progresso) não enviam
    // `statusEntrega: undefined` pro Supabase (que converteria em
    // `null` via `if (dados.statusEntrega !== undefined)` lá
    // no mapper — o que sobrescreveria o valor atual da entrada
    // com NULL em vez de preservar).
    const updatePayload: Parameters<EntradaRepository["atualizar"]>[1] = {};
    if (dados.progresso !== undefined) updatePayload.progresso = dados.progresso;
    if (dados.status !== undefined) updatePayload.status = dados.status;
    if (dados.dataConclusao !== undefined)
      updatePayload.dataConclusao = dados.dataConclusao;
    if (dados.formaPagamento !== undefined)
      updatePayload.formaPagamento = dados.formaPagamento;
    if (dados.statusEntrega !== undefined)
      updatePayload.statusEntrega = dados.statusEntrega;

    await this.entradaRepo.atualizar(entradaId, updatePayload);
  }
}



