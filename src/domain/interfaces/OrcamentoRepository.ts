import { Orcamento, OrcamentoCompleto } from "@shared/types";

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
}

