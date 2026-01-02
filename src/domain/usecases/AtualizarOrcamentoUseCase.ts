import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";

/**
 * Caso de uso: Atualizar status de orçamento
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AtualizarOrcamentoUseCase {
  constructor(private orcamentoRepo: OrcamentoRepository) {}

  async execute(id: string, status: "ativo" | "expirado" | "convertido"): Promise<void> {
    await this.orcamentoRepo.atualizar(id, { status });
  }
}

