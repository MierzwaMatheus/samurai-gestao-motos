import { TipoServico } from "@shared/types";

/**
 * Interface para repositório de tipos de serviço
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface TipoServicoRepository {
  criar(tipoServico: Omit<TipoServico, "id" | "criadoEm" | "atualizadoEm" | "quantidadeServicos">): Promise<TipoServico>;
  buscarPorId(id: string): Promise<TipoServico | null>;
  buscarPorNome(nome: string): Promise<TipoServico[]>;
  listar(): Promise<TipoServico[]>;
  atualizar(id: string, dados: Partial<Omit<TipoServico, "id" | "criadoEm" | "atualizadoEm" | "quantidadeServicos">>): Promise<TipoServico>;
  deletar(id: string): Promise<void>;
  vincularTiposServicoAEntrada(entradaId: string, tiposServicoIds: string[]): Promise<void>;
  buscarPorEntradaId(entradaId: string): Promise<TipoServico[]>;
}

