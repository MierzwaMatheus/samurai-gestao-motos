import { UsuarioApi } from "@/domain/interfaces/UsuarioApi";
import { CriarUsuarioInput, Usuario } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação da API de criação de usuários via Edge Function
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 * Usa supabase.functions.invoke() para garantir que o JWT seja enviado corretamente
 */
export class SupabaseUsuarioApi implements UsuarioApi {
  async criarUsuario(dados: CriarUsuarioInput): Promise<Usuario> {
    // Verificar se o usuário está autenticado
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Erro ao obter sessão:", sessionError);
      throw new Error("Erro ao obter sessão. Faça login novamente.");
    }
    
    if (!session) {
      throw new Error("Usuário não autenticado. Faça login novamente.");
    }

    // Chamar Edge Function usando supabase.functions.invoke()
    // Isso garante que o JWT seja enviado automaticamente e corretamente
    const { data: result, error: invokeError } = await supabase.functions.invoke("criar-usuario", {
      body: {
        email: dados.email,
        senha: dados.senha,
        nome: dados.nome,
        permissao: dados.permissao || "usuario",
      },
    });

    if (invokeError) {
      console.error("Erro ao chamar Edge Function:", invokeError);
      console.error("Detalhes do erro:", JSON.stringify(invokeError, null, 2));
      
      // Tentar extrair mensagem de erro mais detalhada
      let errorMessage = invokeError.message || "Erro ao criar usuário";
      
      // Se o erro tiver contexto, usar ele
      if (invokeError.context) {
        console.error("Contexto do erro:", invokeError.context);
        if (invokeError.context.body) {
          errorMessage = invokeError.context.body.error || errorMessage;
        }
      }
      
      throw new Error(errorMessage);
    }

    if (!result || !result.success) {
      console.error("Resultado sem sucesso:", result);
      throw new Error(result?.error || "Erro ao criar usuário");
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

