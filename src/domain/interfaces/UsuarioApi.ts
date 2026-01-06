import { CriarUsuarioInput, Usuario } from "@shared/types";

/**
 * Interface para API de criação de usuários via Edge Function
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface UsuarioApi {
  criarUsuario(dados: CriarUsuarioInput): Promise<Usuario>;
}

