import { ServicoPersonalizado, ServicoPersonalizadoInput } from "@shared/types";

/**
 * Interface para repositório de serviços personalizados
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface ServicoPersonalizadoRepository {
  criar(entradaId: string, servico: ServicoPersonalizadoInput): Promise<ServicoPersonalizado>;
  buscarPorEntradaId(entradaId: string): Promise<ServicoPersonalizado[]>;
  atualizar(id: string, servico: Partial<ServicoPersonalizadoInput>): Promise<ServicoPersonalizado>;
  deletar(id: string): Promise<void>;
  deletarPorEntradaId(entradaId: string): Promise<void>;
}

