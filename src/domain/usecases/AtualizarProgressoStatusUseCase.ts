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

    // Atualiza entrada
    await this.entradaRepo.atualizar(entradaId, {
      progresso: dados.progresso,
      status: dados.status,
    });
  }
}


