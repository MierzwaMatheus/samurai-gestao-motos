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
  // Log imediato para verificar se o código está sendo executado
  console.log("=== EDGE FUNCTION EXECUTANDO ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request - retornando 204");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  console.log("=== Request recebida (não OPTIONS) ===");

  try {
    console.log("=== Iniciando criação de usuário ===");
    
    // Obter credenciais do Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("Supabase URL presente:", !!supabaseUrl);
    console.log("Supabase Anon Key presente:", !!supabaseAnonKey);
    console.log("Supabase Service Key presente:", !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Configuração do Supabase incompleta");
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
    console.log("Auth header presente:", !!authHeader);
    console.log("Auth header length:", authHeader?.length || 0);
    
    if (!authHeader) {
      console.error("Token de autenticação não fornecido");
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

    // Criar cliente Supabase com anon key e o token do usuário no header
    // A anon key pode validar JWTs quando o token está no header Authorization
    console.log("Criando cliente Supabase com anon key...");
    const supabaseClientForAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Validar JWT e obter usuário autenticado
    // O getUser() sem parâmetros usa o token do header Authorization
    console.log("Validando usuário...");
    const { data: { user }, error: userError } = await supabaseClientForAuth.auth.getUser();
    
    if (userError) {
      console.error("Erro ao validar usuário:", JSON.stringify(userError, null, 2));
      console.error("Código do erro:", userError.status);
      console.error("Mensagem do erro:", userError.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: userError.message || "Token inválido ou usuário não autenticado",
          code: userError.status || 401
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (!user) {
      console.error("Usuário não encontrado após validação");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Usuário não encontrado" 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("Usuário autenticado com sucesso:", user.id, user.email);
    
    // Usar o mesmo cliente para consultar a tabela usuarios (respeitando RLS)
    const supabaseClient = supabaseClientForAuth;

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
      const bodyText = await req.text();
      console.log("Body recebido (raw):", bodyText);
      body = JSON.parse(bodyText);
      console.log("Body parseado:", JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error("Erro ao fazer parse do body:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Body da requisição inválido",
          details: parseError instanceof Error ? parseError.message : String(parseError)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, senha, nome, permissao = "usuario" } = body;
    console.log("Dados extraídos:", { email: email ? "presente" : "ausente", senha: senha ? "presente" : "ausente", nome: nome ? "presente" : "ausente", permissao });

    // Validações
    if (!email || !senha || !nome) {
      console.error("Validação falhou: campos obrigatórios ausentes", { email: !!email, senha: !!senha, nome: !!nome });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email, senha e nome são obrigatórios",
          details: { email: !!email, senha: !!senha, nome: !!nome }
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

    // Criar cliente admin para operações administrativas (criar usuário)
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

