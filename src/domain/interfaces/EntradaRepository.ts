import { Entrada } from "@shared/types";

/**
 * Interface para repositório de entradas
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface EntradaRepository {
  criar(entrada: Omit<Entrada, "id" | "criadoEm" | "atualizadoEm">): Promise<Entrada>;
  buscarPorId(id: string): Promise<Entrada | null>;
  buscarPorClienteId(clienteId: string): Promise<Entrada[]>;
  buscarPorMotoId(motoId: string): Promise<Entrada[]>;
  buscarPorStatus(status: Entrada["status"]): Promise<Entrada[]>;
  listar(): Promise<Entrada[]>;
  atualizar(id: string, dados: Partial<Entrada>): Promise<Entrada>;
  deletar(id: string): Promise<void>;
}

