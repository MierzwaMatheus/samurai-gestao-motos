import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function: consultar-uso-storage
 *
 * Agrega bytes/quantidade por usuário no bucket `fotos`. Substitui a
 * listagem recursiva paginada que `SupabaseStorageApi.consultarEspacoBucket`
 * executava no cliente (centenas de requests).
 *
 * Request body: {} (vazio — filtra sempre pelo auth.uid() do requester)
 *
 * Resposta:
 * {
 *   espacoUsadoBytes: number,
 *   totalArquivos: number
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do Supabase não encontrada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação não fornecido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cliente com o JWT do usuário — `auth.getUser()` valida o token e
    // `rpc()` roda SECURITY DEFINER com o auth.uid() do requester.
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: userError?.message || "Usuário não autenticado",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error: rpcError } = await supabaseClient.rpc(
      "aggregate_storage_usage",
      { p_bucket: "fotos" }
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Erro ao agregar uso: ${rpcError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // `rpc()` com RETURNS TABLE devolve um array; pegamos a primeira linha.
    const row = Array.isArray(data) ? data[0] : data;
    const espacoUsadoBytes = Number(row?.espaco_usado_bytes ?? 0);
    const totalArquivos = Number(row?.total_arquivos ?? 0);

    return new Response(
      JSON.stringify({ espacoUsadoBytes, totalArquivos }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: `Erro interno: ${errorMessage}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});