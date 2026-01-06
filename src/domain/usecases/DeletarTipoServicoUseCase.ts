import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";

/**
 * Caso de uso: Deletar tipo de serviço
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class DeletarTipoServicoUseCase {
  constructor(private tipoServicoRepo: TipoServicoRepository) {}

  async execute(id: string): Promise<void> {
    // Validações de negócio
    if (!id || id.trim().length === 0) {
      throw new Error("ID do tipo de serviço é obrigatório");
    }

    // Verificar se o tipo de serviço existe
    const tipoExistente = await this.tipoServicoRepo.buscarPorId(id);
    if (!tipoExistente) {
      throw new Error("Tipo de serviço não encontrado");
    }

    // Deletar tipo de serviço
    await this.tipoServicoRepo.deletar(id);
  }
}

