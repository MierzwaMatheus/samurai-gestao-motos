import { UsuarioApi } from "@/domain/interfaces/UsuarioApi";
import { CriarUsuarioInput, Usuario } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação da API de criação de usuários via Edge Function
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseUsuarioApi implements UsuarioApi {
  async criarUsuario(dados: CriarUsuarioInput): Promise<Usuario> {
    // Obter URL do Supabase e token de autenticação
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("VITE_SUPABASE_URL não configurada");
    }

    // Obter token de autenticação do usuário atual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Usuário não autenticado");
    }

    // Chamar Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/criar-usuario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: dados.email,
        senha: dados.senha,
        nome: dados.nome,
        permissao: dados.permissao || "usuario",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Erro ao criar usuário");
    }

    // Mapear resposta para Usuario
    return {
      id: result.usuario.id,
      nome: result.usuario.nome,
      email: result.usuario.email,
      permissao: result.usuario.permissao,
      ativo: result.usuario.ativo,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
  }
}

