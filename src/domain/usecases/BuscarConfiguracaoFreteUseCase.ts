import { ConfiguracaoFreteRepository } from "@/domain/interfaces/ConfiguracaoFreteRepository";
import { ConfiguracaoFrete } from "@shared/types";

/**
 * Caso de uso: Buscar configuração de frete do usuário
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class BuscarConfiguracaoFreteUseCase {
  constructor(private configRepo: ConfiguracaoFreteRepository) {}

  async execute(): Promise<ConfiguracaoFrete | null> {
    return await this.configRepo.buscarPorUsuario();
  }
}


