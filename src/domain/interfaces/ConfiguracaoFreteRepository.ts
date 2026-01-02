import { ConfiguracaoFrete } from "@shared/types";

/**
 * Interface para repositório de configurações de frete
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface ConfiguracaoFreteRepository {
  buscarPorUsuario(): Promise<ConfiguracaoFrete | null>;
  criarOuAtualizar(
    dados: Omit<ConfiguracaoFrete, "id" | "criadoEm" | "atualizadoEm">
  ): Promise<ConfiguracaoFrete>;
}


