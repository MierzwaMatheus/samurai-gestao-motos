import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";

/**
 * Caso de uso: Deletar entrada
 * Segue o princípio de Responsabilidade Única (SRP)
 * 
 * Este caso de uso:
 * 1. Valida que a entrada existe
 * 2. Deleta a entrada (os relacionamentos serão deletados via CASCADE no banco)
 */
export class DeletarEntradaUseCase {
  constructor(private entradaRepo: EntradaRepository) {}

  async execute(entradaId: string): Promise<void> {
    // Validações de negócio
    if (!entradaId) {
      throw new Error("ID da entrada é obrigatório");
    }

    // Verifica se a entrada existe
    const entrada = await this.entradaRepo.buscarPorId(entradaId);
    if (!entrada) {
      throw new Error("Entrada não encontrada");
    }

    // Deleta a entrada (os relacionamentos serão deletados via CASCADE no banco)
    await this.entradaRepo.deletar(entradaId);
  }
}

