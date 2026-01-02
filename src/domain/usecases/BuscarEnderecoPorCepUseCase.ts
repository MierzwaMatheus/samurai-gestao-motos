import { CepApi } from "@/domain/interfaces/CepApi";
import { Endereco } from "@shared/types";

/**
 * Caso de uso para buscar endereço por CEP
 * Contém a regra de negócio e não conhece detalhes de implementação
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class BuscarEnderecoPorCepUseCase {
  constructor(private cepApi: CepApi) {}

  async execute(cep: string): Promise<Endereco> {
    // Validação de negócio: CEP não pode estar vazio
    if (!cep || cep.trim().length === 0) {
      throw new Error("CEP é obrigatório");
    }

    // Delega a busca para o serviço de infraestrutura
    return await this.cepApi.buscarPorCep(cep);
  }
}


