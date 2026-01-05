import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";

/**
 * Caso de uso: Converter orçamento em entrada
 * Segue o princípio de Responsabilidade Única (SRP)
 * 
 * Este caso de uso:
 * 1. Marca o orçamento como "convertido"
 * 2. Altera o tipo da entrada relacionada de "orcamento" para "entrada"
 * 3. Define a dataEntrada se não estiver definida
 */
export class ConverterOrcamentoEntradaUseCase {
  constructor(
    private orcamentoRepo: OrcamentoRepository,
    private entradaRepo: EntradaRepository
  ) {}

  async execute(orcamentoId: string): Promise<void> {
    // Validações de negócio
    if (!orcamentoId) {
      throw new Error("ID do orçamento é obrigatório");
    }

    // 1. Busca o orçamento para obter a entrada relacionada
    const orcamento = await this.orcamentoRepo.buscarPorId(orcamentoId);
    if (!orcamento) {
      throw new Error("Orçamento não encontrado");
    }

    // 2. Atualiza o status do orçamento para "convertido"
    await this.orcamentoRepo.atualizar(orcamentoId, { status: "convertido" });

    // 3. Busca a entrada relacionada
    const entrada = await this.entradaRepo.buscarPorId(orcamento.entradaId);
    if (!entrada) {
      throw new Error("Entrada relacionada não encontrada");
    }

    // 4. Atualiza o tipo da entrada de "orcamento" para "entrada"
    // e define a dataEntrada se não estiver definida
    await this.entradaRepo.atualizar(orcamento.entradaId, {
      tipo: "entrada",
      dataEntrada: entrada.dataEntrada || new Date(),
    });
  }
}



