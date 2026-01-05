import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";

/**
 * Caso de uso: Deletar orçamento
 * Segue o princípio de Responsabilidade Única (SRP)
 * 
 * Este caso de uso:
 * 1. Valida que o orçamento existe
 * 2. Deleta o orçamento (a entrada relacionada não é deletada, apenas o orçamento)
 */
export class DeletarOrcamentoUseCase {
  constructor(private orcamentoRepo: OrcamentoRepository) {}

  async execute(orcamentoId: string): Promise<void> {
    // Validações de negócio
    if (!orcamentoId) {
      throw new Error("ID do orçamento é obrigatório");
    }

    // Verifica se o orçamento existe
    const orcamento = await this.orcamentoRepo.buscarPorId(orcamentoId);
    if (!orcamento) {
      throw new Error("Orçamento não encontrado");
    }

    // Deleta o orçamento
    await this.orcamentoRepo.deletar(orcamentoId);
  }
}

