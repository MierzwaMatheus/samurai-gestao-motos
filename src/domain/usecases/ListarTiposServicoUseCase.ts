import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { TipoServico } from "@shared/types";

/**
 * Caso de uso: Listar tipos de serviço
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class ListarTiposServicoUseCase {
  constructor(private tipoServicoRepo: TipoServicoRepository) {}

  async execute(busca?: string): Promise<TipoServico[]> {
    if (busca && busca.trim().length > 0) {
      return await this.tipoServicoRepo.buscarPorNome(busca.trim());
    }
    return await this.tipoServicoRepo.listar();
  }
}



