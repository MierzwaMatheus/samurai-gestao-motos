import { UsuarioApi } from "@/domain/interfaces/UsuarioApi";
import { CriarUsuarioInput, Usuario } from "@shared/types";

/**
 * Caso de uso: Criar novo usuário
 * Segue o princípio de Responsabilidade Única (SRP)
 * A regra de negócio está isolada da infraestrutura
 */
export class CriarUsuarioUseCase {
  constructor(private usuarioApi: UsuarioApi) {}

  async execute(dados: CriarUsuarioInput): Promise<Usuario> {
    // Validações de negócio
    if (!dados.email || !dados.senha || !dados.nome) {
      throw new Error("Email, senha e nome são obrigatórios");
    }

    if (!dados.email.includes("@")) {
      throw new Error("Email inválido");
    }

    if (dados.senha.length < 6) {
      throw new Error("Senha deve ter pelo menos 6 caracteres");
    }

    if (dados.nome.trim().length < 2) {
      throw new Error("Nome deve ter pelo menos 2 caracteres");
    }

    // Validação de permissão
    if (dados.permissao && dados.permissao !== "admin" && dados.permissao !== "usuario") {
      throw new Error("Permissão inválida. Use 'admin' ou 'usuario'");
    }

    // Normalizar email
    const emailNormalizado = dados.email.toLowerCase().trim();
    const nomeNormalizado = dados.nome.trim();

    // Criar usuário via API (Edge Function)
    return await this.usuarioApi.criarUsuario({
      ...dados,
      email: emailNormalizado,
      nome: nomeNormalizado,
      permissao: dados.permissao || "usuario",
    });
  }
}

