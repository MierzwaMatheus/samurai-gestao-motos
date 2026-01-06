import { UsuarioRepository } from "@/domain/interfaces/UsuarioRepository";
import { AtualizarUsuarioInput, Usuario } from "@shared/types";

/**
 * Caso de uso: Atualizar usuário
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AtualizarUsuarioUseCase {
  constructor(private usuarioRepo: UsuarioRepository) {}

  async execute(id: string, dados: AtualizarUsuarioInput): Promise<Usuario> {
    // Validações de negócio
    if (!id) {
      throw new Error("ID do usuário é obrigatório");
    }

    // Verificar se usuário existe
    const usuarioExistente = await this.usuarioRepo.buscarPorId(id);
    if (!usuarioExistente) {
      throw new Error("Usuário não encontrado");
    }

    // Validações específicas
    if (dados.nome !== undefined) {
      if (dados.nome.trim().length < 2) {
        throw new Error("Nome deve ter pelo menos 2 caracteres");
      }
    }

    if (dados.permissao !== undefined) {
      if (dados.permissao !== "admin" && dados.permissao !== "usuario") {
        throw new Error("Permissão inválida. Use 'admin' ou 'usuario'");
      }
    }

    // Normalizar nome se fornecido
    const dadosAtualizados: AtualizarUsuarioInput = { ...dados };
    if (dados.nome) {
      dadosAtualizados.nome = dados.nome.trim();
    }

    return await this.usuarioRepo.atualizar(id, dadosAtualizados);
  }
}

