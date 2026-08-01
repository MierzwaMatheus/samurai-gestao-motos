import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function: listar-arquivos-storage
 *
 * Lista objetos do bucket `fotos` dentro do intervalo [dataInicio, dataFim]
 * para o `auth.uid()` corrente. Substitui a recursão de listagem em
 * `SupabaseStorageApi.listarArquivosPorPeriodo`.
 *
 * Request body:
 * {
 *   dataInicio: ISO 8601 string,
 *   dataFim: ISO 8601 string
 * }
 *
 * Resposta:
 * {
 *   arquivos: [
 *     { caminho, nome, tamanhoBytes, dataCriacao (ISO), tipo },
 *     ...
 *   ]
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function handler(req: Request): Promise<Response> {
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

    // Parse do body
    const bodyText = await req.text();
    let body: { dataInicio?: string; dataFim?: string };
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Body da requisição inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { dataInicio, dataFim } = body;
    if (!dataInicio || !dataFim) {
      return new Response(
        JSON.stringify({ error: "dataInicio e dataFim são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error: rpcError } = await supabaseClient.rpc(
      "list_storage_objects_in_period",
      {
        p_bucket: "fotos",
        p_inicio: dataInicio,
        p_fim: dataFim,
      }
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Erro ao listar arquivos: ${rpcError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const arquivos = (Array.isArray(data) ? data : []).map(row => ({
      caminho: row.caminho,
      nome: row.nome,
      tamanhoBytes: Number(row.tamanho_bytes),
      // timestamptz → ISO 8601 com sufixo Z (cliente reparseia com `new Date(...)`)
      dataCriacao: new Date(row.data_criacao).toISOString(),
      tipo: row.tipo,
    }));

    return new Response(JSON.stringify({ arquivos }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
}

if (import.meta.main) {
  Deno.serve(handler);
}