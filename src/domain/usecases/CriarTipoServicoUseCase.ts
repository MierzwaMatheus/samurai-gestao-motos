import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";

/**
 * Caso de uso: Criar tipo de serviço
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class CriarTipoServicoUseCase {
  constructor(private tipoServicoRepo: TipoServicoRepository) { }

  async execute(
    nome: string,
    precoOficina: number = 0,
    precoParticular: number = 0,
    categoria: "padrao" | "alinhamento" = "padrao",
    precosAlinhamento?: {
      precoOficinaComOleo?: number;
      precoOficinaSemOleo?: number;
      precoParticularComOleo?: number;
      precoParticularSemOleo?: number;
    }
  ): Promise<{ id: string; nome: string; precoOficina: number; precoParticular: number }> {
    // Validações de negócio
    if (!nome || nome.trim().length === 0) {
      throw new Error("Nome do tipo de serviço é obrigatório");
    }

    if (nome.trim().length < 2) {
      throw new Error("Nome do tipo de serviço deve ter pelo menos 2 caracteres");
    }

    if (precoOficina < 0) {
      throw new Error("Preço oficina não pode ser negativo");
    }

    if (precoParticular < 0) {
      throw new Error("Preço particular não pode ser negativo");
    }

    // Verificar se já existe um tipo de serviço com o mesmo nome
    const tiposExistentes = await this.tipoServicoRepo.buscarPorNome(nome.trim());
    const tipoExistente = tiposExistentes.find(
      (t) => t.nome.toLowerCase() === nome.trim().toLowerCase()
    );

    if (tipoExistente) {
      throw new Error("Já existe um tipo de serviço com este nome");
    }

    // Criar tipo de serviço
    const tipoServico = await this.tipoServicoRepo.criar({
      nome: nome.trim(),
      precoOficina: precoOficina,
      precoParticular: precoParticular,
      categoria,
      precoOficinaComOleo: precosAlinhamento?.precoOficinaComOleo,
      precoOficinaSemOleo: precosAlinhamento?.precoOficinaSemOleo,
      precoParticularComOleo: precosAlinhamento?.precoParticularComOleo,
      precoParticularSemOleo: precosAlinhamento?.precoParticularSemOleo,
    });

    return {
      id: tipoServico.id,
      nome: tipoServico.nome,
      precoOficina: tipoServico.precoOficina,
      precoParticular: tipoServico.precoParticular,
    };
  }
}



