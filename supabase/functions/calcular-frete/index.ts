import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function para calcular frete usando OpenRouteService
 * 
 * Request body esperado:
 * {
 *   cepDestino: string (8 dígitos)
 * }
 * 
 * Resposta:
 * {
 *   distanciaKm: number
 *   valorFrete: number
 *   cepOrigem: string
 *   cepDestino: string
 * }
 */

interface RequestBody {
  cepDestino: string;
}

interface OpenRouteResponse {
  type: string;
  features: Array<{
    properties: {
      summary?: {
        distance: number; // em metros
        duration: number; // em segundos
      };
      segments?: Array<{
        distance: number; // em metros (fallback)
      }>;
    };
  }>;
}

// Lê a API key do OpenRouteService do ambiente
// No Supabase Edge Functions, secrets são acessados via Deno.env.get()
const OPENROUTE_API_KEY = Deno.env.get("OPENROUTE_API_KEY");
// Valores padrão caso não encontre configuração no banco
const CEP_ORIGEM_DEFAULT = "06653010";
const VALOR_POR_KM_DEFAULT = 2.0;

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
    // Valida API key
    if (!OPENROUTE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTE_API_KEY não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Erro ao fazer parse do body:", parseError);
      return new Response(
        JSON.stringify({ error: "Body da requisição inválido ou ausente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { cepDestino } = body;

    if (!cepDestino || cepDestino.replace(/\D/g, "").length !== 8) {
      return new Response(
        JSON.stringify({ error: "CEP destino inválido. Deve conter 8 dígitos." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Busca configurações do banco de dados
    // Nas Edge Functions do Supabase, as variáveis são injetadas automaticamente
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    let cepOrigem = CEP_ORIGEM_DEFAULT;
    let valorPorKm = VALOR_POR_KM_DEFAULT;

    // Tenta buscar configurações do banco se tiver as credenciais e token de auth
    const authHeader = req.headers.get("authorization");
    if (supabaseUrl && supabaseAnonKey && authHeader) {
      try {
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        });

        // Busca configuração do usuário
        const { data: config, error: configError } = await supabaseClient
          .from("configuracoes_frete")
          .select("cep_origem, valor_por_km")
          .single();

        if (!configError && config) {
          cepOrigem = config.cep_origem;
          valorPorKm = parseFloat(config.valor_por_km) || VALOR_POR_KM_DEFAULT;
          console.log(`Configuração encontrada: CEP origem=${cepOrigem}, Valor por km=${valorPorKm}`);
        } else {
          // Se não encontrar configuração, usa valores padrão (não é erro)
          console.log(`Configuração não encontrada, usando valores padrão: CEP origem=${cepOrigem}, Valor por km=${valorPorKm}`);
        }
      } catch (configErr) {
        // Se der erro ao buscar configuração, continua com valores padrão (não é crítico)
        console.log("Erro ao buscar configuração, usando valores padrão:", configErr instanceof Error ? configErr.message : String(configErr));
      }
    } else {
      if (!authHeader) {
        console.log("Token de autorização não encontrado, usando valores padrão");
      } else if (!supabaseUrl || !supabaseAnonKey) {
        console.log("Variáveis SUPABASE_URL ou SUPABASE_ANON_KEY não configuradas, usando valores padrão");
      }
    }

    // Busca coordenadas do CEP de origem
    console.log(`Buscando coordenadas do CEP de origem: ${cepOrigem}`);
    const origemCoords = await buscarCoordenadasPorCep(cepOrigem);
    if (!origemCoords) {
      console.error("Falha ao buscar coordenadas da origem");
      return new Response(
        JSON.stringify({ error: "Erro ao buscar coordenadas da origem" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log(`Coordenadas origem: ${origemCoords.lat}, ${origemCoords.lng}`);

    // Busca coordenadas do CEP de destino
    console.log(`Buscando coordenadas do CEP de destino: ${cepDestino}`);
    const destinoCoords = await buscarCoordenadasPorCep(cepDestino);
    if (!destinoCoords) {
      console.error("Falha ao buscar coordenadas do destino");
      return new Response(
        JSON.stringify({ error: "Erro ao buscar coordenadas do destino" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log(`Coordenadas destino: ${destinoCoords.lat}, ${destinoCoords.lng}`);

    // Calcula distância usando OpenRouteService
    console.log("Calculando distância via OpenRouteService...");
    console.log(`Usando API Key: present=${!!OPENROUTE_API_KEY}, length=${OPENROUTE_API_KEY?.length || 0}`);
    let distanciaKm: number | null;
    try {
      distanciaKm = await calcularDistancia(
        origemCoords,
        destinoCoords,
        OPENROUTE_API_KEY
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Erro capturado ao calcular distância:", errorMessage);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao calcular distância",
          details: errorMessage,
          debug: {
            origem: origemCoords,
            destino: destinoCoords,
            apiKeyPresent: !!OPENROUTE_API_KEY,
            apiKeyLength: OPENROUTE_API_KEY?.length || 0,
            cepOrigem: cepOrigem,
            cepDestino: cepDestino.replace(/\D/g, ""),
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (distanciaKm === null) {
      console.error("Falha ao calcular distância");
      console.error(`Origem: ${JSON.stringify(origemCoords)}`);
      console.error(`Destino: ${JSON.stringify(destinoCoords)}`);
      console.error(`API Key presente: ${!!OPENROUTE_API_KEY}`);
      console.error(`API Key length: ${OPENROUTE_API_KEY?.length || 0}`);
      
      return new Response(
        JSON.stringify({ 
          error: "Erro ao calcular distância. Verifique os logs para mais detalhes.",
          debug: {
            origem: origemCoords,
            destino: destinoCoords,
            apiKeyPresent: !!OPENROUTE_API_KEY,
            apiKeyLength: OPENROUTE_API_KEY?.length || 0,
            cepOrigem: cepOrigem,
            cepDestino: cepDestino.replace(/\D/g, ""),
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    console.log(`Distância calculada: ${distanciaKm} km`);

    // Calcula valor do frete (distância * valor por km)
    const valorFrete = distanciaKm * valorPorKm;

    return new Response(
      JSON.stringify({
        distanciaKm: Math.round(distanciaKm * 100) / 100, // 2 casas decimais
        valorFrete: Math.round(valorFrete * 100) / 100,
        cepOrigem: cepOrigem,
        cepDestino: cepDestino.replace(/\D/g, ""),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro ao calcular frete:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({
        error: "Erro interno ao calcular frete",
        message: errorMessage,
        stack: errorStack,
        debug: {
          openrouteApiKeyPresent: !!OPENROUTE_API_KEY,
          openrouteApiKeyLength: OPENROUTE_API_KEY?.length || 0,
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Busca coordenadas (lat, lng) de um CEP usando ViaCEP
 */
async function buscarCoordenadasPorCep(
  cep: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const cepLimpo = cep.replace(/\D/g, "");
    const response = await fetch(
      `https://viacep.com.br/ws/${cepLimpo}/json/`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.erro || !data.localidade) {
      return null;
    }

    // Usa OpenStreetMap Nominatim para geocodificar o endereço
    const endereco = `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`;
    console.log(`Buscando coordenadas para: ${endereco}`);
    
    try {
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          endereco
        )}&limit=1`,
        {
          headers: {
            "User-Agent": "SamuraiGestaoMotos/1.0",
          },
          // Timeout de 10 segundos
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!nominatimResponse.ok) {
        const errorText = await nominatimResponse.text();
        console.error(`Erro Nominatim (${nominatimResponse.status}): ${errorText}`);
        
        // Se for rate limit, tenta alternativa
        if (nominatimResponse.status === 429 || nominatimResponse.status === 403) {
          console.log("Nominatim bloqueado, tentando alternativa...");
          return await buscarCoordenadasAlternativa(data);
        }
        
        return null;
      }

      const nominatimData = await nominatimResponse.json();

      if (!nominatimData || nominatimData.length === 0) {
        console.error("Nominatim retornou array vazio, tentando alternativa...");
        return await buscarCoordenadasAlternativa(data);
      }

      const coords = {
        lat: parseFloat(nominatimData[0].lat),
        lng: parseFloat(nominatimData[0].lon),
      };
      
      console.log(`Coordenadas encontradas: ${coords.lat}, ${coords.lng}`);
      return coords;
    } catch (error) {
      console.error("Erro ao buscar no Nominatim:", error);
      // Tenta alternativa em caso de erro
      return await buscarCoordenadasAlternativa(data);
    }
  } catch (error) {
    console.error("Erro ao buscar coordenadas:", error);
    return null;
  }
}

/**
 * Método alternativo para buscar coordenadas usando apenas cidade/estado
 * Menos preciso, mas funciona quando Nominatim está bloqueado
 */
async function buscarCoordenadasAlternativa(
  data: any
): Promise<{ lat: number; lng: number } | null> {
  try {
    console.log("Usando método alternativo de geocodificação...");
    // Usa apenas cidade e estado para geocodificação
    const enderecoSimples = `${data.localidade}, ${data.uf}, Brasil`;
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        enderecoSimples
      )}&limit=1`,
      {
        headers: {
          "User-Agent": "SamuraiGestaoMotos/1.0",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.error(`Erro método alternativo (${response.status})`);
      return null;
    }

    const dataAlt = await response.json();
    if (!dataAlt || dataAlt.length === 0) {
      console.error("Método alternativo retornou vazio");
      return null;
    }

    const coords = {
      lat: parseFloat(dataAlt[0].lat),
      lng: parseFloat(dataAlt[0].lon),
    };
    
    console.log(`Coordenadas alternativas encontradas: ${coords.lat}, ${coords.lng}`);
    return coords;
  } catch (error) {
    console.error("Erro no método alternativo:", error);
    return null;
  }
}

/**
 * Calcula distância entre dois pontos usando OpenRouteService
 */
async function calcularDistancia(
  origem: { lat: number; lng: number },
  destino: { lat: number; lng: number },
  apiKey: string
): Promise<number | null> {
  try {
    // OpenRouteService espera coordenadas no formato [longitude, latitude]
    // Formato: start=lng,lat&end=lng,lat
    // API key pode ser passada como query parameter OU header Authorization
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${origem.lng},${origem.lat}&end=${destino.lng},${destino.lat}`;
    
    console.log(`Chamando OpenRouteService:`);
    console.log(`  URL (sem key): https://api.openrouteservice.org/v2/directions/driving-car?api_key=***&start=${origem.lng},${origem.lat}&end=${destino.lng},${destino.lat}`);
    console.log(`  Origem: [${origem.lng}, ${origem.lat}] (longitude, latitude)`);
    console.log(`  Destino: [${destino.lng}, ${destino.lat}] (longitude, latitude)`);
    console.log(`  API Key presente: ${!!apiKey}, length: ${apiKey?.length || 0}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, application/geo+json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { raw: errorText };
      }
      
      console.error(`Erro OpenRouteService (${response.status}):`, errorText);
      console.error(`URL chamada: https://api.openrouteservice.org/v2/directions/driving-car?api_key=***&start=${origem.lng},${origem.lat}&end=${destino.lng},${destino.lat}`);
      console.error(`Coordenadas origem: [${origem.lng}, ${origem.lat}] (lng, lat)`);
      console.error(`Coordenadas destino: [${destino.lng}, ${destino.lat}] (lng, lat)`);
      console.error(`API Key presente: ${!!apiKey}, length: ${apiKey?.length || 0}`);
      console.error(`Erro detalhado:`, JSON.stringify(errorJson));
      
      // Retorna erro mais detalhado para debug
      throw new Error(`OpenRouteService error (${response.status}): ${JSON.stringify(errorJson)}`);
    }

    const data: OpenRouteResponse = await response.json();
    console.log("Resposta OpenRouteService recebida:", JSON.stringify(data).substring(0, 300));

    if (!data.features || data.features.length === 0) {
      console.error("Resposta OpenRouteService sem features:", JSON.stringify(data));
      return null;
    }

    const feature = data.features[0];
    
    // A distância está em properties.summary.distance
    let distanciaMetros: number | null = null;
    
    if (feature.properties?.summary?.distance) {
      distanciaMetros = feature.properties.summary.distance;
      console.log(`Distância encontrada em summary: ${distanciaMetros} metros`);
    } else if (feature.properties?.segments?.[0]?.distance) {
      // Fallback: soma todas as distâncias dos segmentos
      distanciaMetros = feature.properties.segments.reduce(
        (total, segment) => total + (segment.distance || 0),
        0
      );
      console.log(`Distância calculada dos segmentos: ${distanciaMetros} metros`);
    } else {
      console.error("Não foi possível encontrar distância na resposta:", JSON.stringify(feature.properties));
      return null;
    }

    // Converte de metros para quilômetros
    const distanciaKm = distanciaMetros / 1000;
    console.log(`Distância final: ${distanciaKm.toFixed(2)} km`);
    return distanciaKm;
  } catch (error) {
    console.error("Erro ao calcular distância:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    throw error; // Propaga o erro para ser capturado no handler principal
  }
}

