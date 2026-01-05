import { FreteApi } from "@/domain/interfaces/FreteApi";

/**
 * Caso de uso para calcular frete
 * Contém a regra de negócio e não conhece detalhes de implementação
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class CalcularFreteUseCase {
  constructor(private freteApi: FreteApi) {}

  async execute(cepDestino: string): Promise<{
    distanciaKm: number;
    valorFrete: number;
    cepOrigem: string;
    cepDestino: string;
  }> {
    // Validação de negócio: CEP não pode estar vazio
    if (!cepDestino || cepDestino.trim().length === 0) {
      throw new Error("CEP destino é obrigatório");
    }

    // Valida formato do CEP
    const cepLimpo = cepDestino.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      throw new Error("CEP deve conter 8 dígitos");
    }

    // Delega o cálculo para o serviço de infraestrutura
    return await this.freteApi.calcular({ cepDestino: cepLimpo });
  }
}



