import { Endereco } from "@shared/types";

/**
 * Interface para serviços de busca de CEP
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface CepApi {
  buscarPorCep(cep: string): Promise<Endereco>;
}


