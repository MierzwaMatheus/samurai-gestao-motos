import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";

/**
 * Caso de uso: Atualizar tipo de serviço
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AtualizarTipoServicoUseCase {
  constructor(private tipoServicoRepo: TipoServicoRepository) {}

  async execute(
    id: string,
    dados: Partial<{ nome: string; precoOficina: number; precoParticular: number }>
  ): Promise<{ id: string; nome: string; precoOficina: number; precoParticular: number }> {
    // Validações de negócio
    if (dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length === 0) {
        throw new Error("Nome do tipo de serviço é obrigatório");
      }

      if (dados.nome.trim().length < 2) {
        throw new Error("Nome do tipo de serviço deve ter pelo menos 2 caracteres");
      }
    }

    if (dados.precoOficina !== undefined && dados.precoOficina < 0) {
      throw new Error("Preço oficina não pode ser negativo");
    }

    if (dados.precoParticular !== undefined && dados.precoParticular < 0) {
      throw new Error("Preço particular não pode ser negativo");
    }

    // Verificar se o tipo de serviço existe
    const tipoExistente = await this.tipoServicoRepo.buscarPorId(id);
    if (!tipoExistente) {
      throw new Error("Tipo de serviço não encontrado");
    }

    // Se o nome está sendo alterado, verificar se já existe outro com o mesmo nome
    if (dados.nome && dados.nome.trim().toLowerCase() !== tipoExistente.nome.toLowerCase()) {
      const tiposExistentes = await this.tipoServicoRepo.buscarPorNome(dados.nome.trim());
      const tipoComMesmoNome = tiposExistentes.find(
        (t) => t.id !== id && t.nome.toLowerCase() === dados.nome!.trim().toLowerCase()
      );

      if (tipoComMesmoNome) {
        throw new Error("Já existe um tipo de serviço com este nome");
      }
    }

    // Atualizar tipo de serviço
    const tipoServico = await this.tipoServicoRepo.atualizar(id, {
      nome: dados.nome?.trim(),
      precoOficina: dados.precoOficina,
      precoParticular: dados.precoParticular,
    });

    return {
      id: tipoServico.id,
      nome: tipoServico.nome,
      precoOficina: tipoServico.precoOficina,
      precoParticular: tipoServico.precoParticular,
    };
  }
}

