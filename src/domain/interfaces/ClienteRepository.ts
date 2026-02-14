import { Cliente } from "@shared/types";

/**
 * Interface para repositório de clientes
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface ClienteRepository {
  criar(cliente: Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">): Promise<Cliente>;
  buscarPorId(id: string): Promise<Cliente | null>;
  buscarPorNome(nome: string): Promise<Cliente[]>;
  buscarPorNomeOuTelefone(termo: string): Promise<Cliente[]>;
  listar(): Promise<Cliente[]>;
  atualizar(id: string, dados: Partial<Cliente>): Promise<Cliente>;
  deletar(id: string): Promise<void>;
}

