import { ConfiguracaoFreteRepository } from "@/domain/interfaces/ConfiguracaoFreteRepository";
import { ConfiguracaoFrete } from "@shared/types";

/**
 * Caso de uso: Atualizar configuração de frete
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AtualizarConfiguracaoFreteUseCase {
  constructor(private configRepo: ConfiguracaoFreteRepository) {}

  async execute(dados: {
    cepOrigem: string;
    valorPorKm: number;
  }): Promise<ConfiguracaoFrete> {
    // Validações de negócio
    if (!dados.cepOrigem || dados.cepOrigem.trim().length === 0) {
      throw new Error("CEP de origem é obrigatório");
    }

    const cepLimpo = dados.cepOrigem.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      throw new Error("CEP de origem deve conter 8 dígitos");
    }

    if (dados.valorPorKm <= 0) {
      throw new Error("Valor por km deve ser maior que zero");
    }

    if (dados.valorPorKm > 1000) {
      throw new Error("Valor por km não pode ser maior que R$ 1.000,00");
    }

    return await this.configRepo.criarOuAtualizar({
      cepOrigem: cepLimpo,
      valorPorKm: dados.valorPorKm,
    });
  }
}



