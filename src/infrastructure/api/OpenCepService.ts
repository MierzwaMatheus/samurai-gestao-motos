import { CepApi } from "@/domain/interfaces/CepApi";
import { Endereco } from "@shared/types";

/**
 * Implementação concreta do serviço de CEP usando OpenCEP API
 * Esta é uma implementação de infraestrutura que conhece detalhes da API externa
 */
export class OpenCepService implements CepApi {
  private readonly baseUrl = "https://opencep.com/v1";

  async buscarPorCep(cep: string): Promise<Endereco> {
    // Remove caracteres não numéricos do CEP
    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      throw new Error("CEP deve conter 8 dígitos");
    }

    const response = await fetch(`${this.baseUrl}/${cepLimpo}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("CEP não encontrado");
      }
      throw new Error(`Erro ao buscar CEP: ${response.statusText}`);
    }

    const data = await response.json();

    // Valida se a resposta contém os dados esperados
    if (!data.cep || !data.logradouro) {
      throw new Error("Resposta da API inválida");
    }

    return {
      cep: data.cep,
      estado: data.uf,
      cidade: data.localidade,
      bairro: data.bairro,
      rua: data.logradouro,
      // OpenCEP não fornece coordenadas
      coordenadas: undefined,
    };
  }
}

