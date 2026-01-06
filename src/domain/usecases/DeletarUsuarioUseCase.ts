import { UsuarioRepository } from "@/domain/interfaces/UsuarioRepository";

/**
 * Caso de uso: Deletar usuário
 * Segue o princípio de Responsabilidade Única (SRP)
 * 
 * Nota: Na prática, ao invés de deletar, podemos desativar o usuário
 * mas mantemos a interface de deletar para flexibilidade
 */
export class DeletarUsuarioUseCase {
  constructor(private usuarioRepo: UsuarioRepository) {}

  async execute(id: string): Promise<void> {
    // Validações de negócio
    if (!id) {
      throw new Error("ID do usuário é obrigatório");
    }

    // Verificar se usuário existe
    const usuarioExistente = await this.usuarioRepo.buscarPorId(id);
    if (!usuarioExistente) {
      throw new Error("Usuário não encontrado");
    }

    // Deletar usuário
    await this.usuarioRepo.deletar(id);
  }
}

