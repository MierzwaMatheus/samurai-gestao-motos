import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function para criar novos usuários
 * Apenas usuários com permissão 'admin' podem criar novos usuários
 * 
 * Request body esperado:
 * {
 *   email: string
 *   senha: string
 *   nome: string
 *   permissao?: 'admin' | 'usuario' (padrão: 'usuario')
 * }
 * 
 * Resposta:
 * {
 *   success: boolean
 *   usuario?: { id, email, nome, permissao }
 *   error?: string
 * }
 */

interface RequestBody {
  email: string;
  senha: string;
  nome: string;
  permissao?: "admin" | "usuario";
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Obter credenciais do Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Configuração do Supabase não encontrada" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obter token de autenticação do usuário que está fazendo a requisição
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Token de autenticação não fornecido" 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar cliente Supabase com token do usuário para verificar permissões
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verificar se o usuário está autenticado e é admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Usuário não autenticado" 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o usuário é admin
    const { data: usuarioAdmin, error: adminError } = await supabaseClient
      .from("usuarios")
      .select("permissao")
      .eq("id", user.id)
      .eq("ativo", true)
      .single();

    if (adminError || !usuarioAdmin || usuarioAdmin.permissao !== "admin") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Apenas administradores podem criar usuários" 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Body da requisição inválido" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, senha, nome, permissao = "usuario" } = body;

    // Validações
    if (!email || !senha || !nome) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email, senha e nome são obrigatórios" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!email.includes("@")) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email inválido" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (senha.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Senha deve ter pelo menos 6 caracteres" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (permissao !== "admin" && permissao !== "usuario") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Permissão inválida. Use 'admin' ou 'usuario'" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar cliente Supabase com service role key para criar usuário
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Criar usuário no auth.users
    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // Confirma email automaticamente
    });

    if (createAuthError || !authUser.user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: createAuthError?.message || "Erro ao criar usuário no sistema de autenticação" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar registro na tabela usuarios
    const { data: usuario, error: createUsuarioError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        id: authUser.user.id,
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        permissao,
        ativo: true,
        criado_por: user.id,
      })
      .select()
      .single();

    if (createUsuarioError) {
      // Se falhar ao criar registro na tabela usuarios, tenta deletar o usuário criado no auth
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao criar registro do usuário: ${createUsuarioError.message}` 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          nome: usuario.nome,
          permissao: usuario.permissao,
          ativo: usuario.ativo,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${errorMessage}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

