import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { OrcamentoCompleto } from "@shared/types";

/**
 * Caso de uso: Listar orçamentos por status
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class ListarOrcamentosUseCase {
  constructor(private orcamentoRepo: OrcamentoRepository) {}

  async execute(status: "ativo" | "expirado"): Promise<OrcamentoCompleto[]> {
    return await this.orcamentoRepo.buscarCompletosPorStatus(status);
  }
}

