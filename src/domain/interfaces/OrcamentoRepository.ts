import { Orcamento, OrcamentoCompleto } from "@shared/types";

/**
 * Página genérica de resultado paginado.
 * Reaproveitável por qualquer repositório que exponha consulta paginada.
 */
export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Parâmetros para consulta paginada de orçamentos.
 * - page: número da página (1-based)
 * - pageSize: quantidade de itens por página
 * - status: filtra orçamentos pelo status informado
 */
export interface BuscarPaginaOrcamentosParams {
  page: number;
  pageSize: number;
  status: Orcamento["status"];
}

/**
 * Interface para repositório de orçamentos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface OrcamentoRepository {
  criar(orcamento: Omit<Orcamento, "id" | "criadoEm" | "atualizadoEm">): Promise<Orcamento>;
  buscarPorId(id: string): Promise<Orcamento | null>;
  buscarPorEntradaId(entradaId: string): Promise<Orcamento | null>;
  buscarCompletosPorStatus(status: Orcamento["status"]): Promise<OrcamentoCompleto[]>;
  listar(): Promise<Orcamento[]>;
  atualizar(id: string, dados: Partial<Orcamento>): Promise<Orcamento>;
  deletar(id: string): Promise<void>;
  /**
   * Busca uma página de orçamentos completos (com cliente, moto, fotos e serviços)
   * aplicando filtro de status server-side. Retorna também o total de registros
   * para suportar scroll infinito e contadores.
   */
  buscarPagina(params: BuscarPaginaOrcamentosParams): Promise<Pagina<OrcamentoCompleto>>;
}