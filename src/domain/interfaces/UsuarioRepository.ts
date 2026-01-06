import { Usuario, AtualizarUsuarioInput } from "@shared/types";

/**
 * Interface para repositório de usuários
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface UsuarioRepository {
  criar(usuario: Omit<Usuario, "id" | "criadoEm" | "atualizadoEm">): Promise<Usuario>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  listar(): Promise<Usuario[]>;
  atualizar(id: string, dados: AtualizarUsuarioInput): Promise<Usuario>;
  deletar(id: string): Promise<void>;
}

