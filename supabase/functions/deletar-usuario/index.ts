import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function para deletar usuários
 * Apenas usuários com permissão 'admin' podem deletar usuários
 * 
 * Request body esperado:
 * {
 *   id: string
 * }
 * 
 * Resposta:
 * {
 *   success: boolean
 *   error?: string
 * }
 */

interface RequestBody {
    id: string;
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
                    error: "Apenas administradores podem deletar usuários"
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

        const { id } = body;

        if (!id) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "ID do usuário é obrigatório"
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Não permitir que o usuário delete a si mesmo
        if (id === user.id) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Você não pode deletar sua própria conta"
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Criar cliente Supabase com service role key para deletar usuário
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Deletar usuário no auth.users (isso deve disparar o CASCADE para a tabela usuarios)
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (deleteAuthError) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: deleteAuthError.message || "Erro ao deletar usuário no sistema de autenticação"
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Erro ao deletar usuário:", error);
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
