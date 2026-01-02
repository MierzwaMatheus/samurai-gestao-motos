import { CepApi } from "@/domain/interfaces/CepApi";
import { Endereco } from "@shared/types";

/**
 * Implementação concreta do serviço de CEP usando ViaCEP API
 * Esta é uma implementação de infraestrutura que conhece detalhes da API externa
 */
export class ViaCepService implements CepApi {
  private readonly baseUrl = "https://viacep.com.br/ws";

  async buscarPorCep(cep: string): Promise<Endereco> {
    // Remove caracteres não numéricos do CEP
    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      throw new Error("CEP deve conter 8 dígitos");
    }

    const response = await fetch(`${this.baseUrl}/${cepLimpo}/json/`);

    if (!response.ok) {
      throw new Error(`Erro ao buscar CEP: ${response.statusText}`);
    }

    const data = await response.json();

    // ViaCEP retorna { erro: true } quando o CEP não é encontrado
    if (data.erro) {
      throw new Error("CEP não encontrado");
    }

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
      // ViaCEP não fornece coordenadas
      coordenadas: undefined,
    };
  }
}

