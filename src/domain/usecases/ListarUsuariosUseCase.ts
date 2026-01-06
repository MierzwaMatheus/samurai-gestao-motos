import { UsuarioRepository } from "@/domain/interfaces/UsuarioRepository";
import { Usuario } from "@shared/types";

/**
 * Caso de uso: Listar usuários
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class ListarUsuariosUseCase {
  constructor(private usuarioRepo: UsuarioRepository) {}

  async execute(): Promise<Usuario[]> {
    return await this.usuarioRepo.listar();
  }
}

