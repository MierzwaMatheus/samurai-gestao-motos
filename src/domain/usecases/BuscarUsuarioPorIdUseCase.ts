import { UsuarioRepository } from "@/domain/interfaces/UsuarioRepository";
import { Usuario } from "@shared/types";

/**
 * Caso de uso: Buscar usuário por ID
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class BuscarUsuarioPorIdUseCase {
  constructor(private usuarioRepo: UsuarioRepository) {}

  async execute(id: string): Promise<Usuario | null> {
    if (!id) {
      throw new Error("ID do usuário é obrigatório");
    }

    return await this.usuarioRepo.buscarPorId(id);
  }
}

