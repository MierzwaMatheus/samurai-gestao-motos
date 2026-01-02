import { Moto } from "@shared/types";

/**
 * Interface para repositório de motos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface MotoRepository {
  criar(moto: Omit<Moto, "id" | "criadoEm" | "atualizadoEm">): Promise<Moto>;
  buscarPorId(id: string): Promise<Moto | null>;
  buscarPorClienteId(clienteId: string): Promise<Moto[]>;
  listar(): Promise<Moto[]>;
  atualizar(id: string, dados: Partial<Moto>): Promise<Moto>;
  deletar(id: string): Promise<void>;
}

