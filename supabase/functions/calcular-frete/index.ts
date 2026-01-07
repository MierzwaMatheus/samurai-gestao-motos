import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function para calcular frete usando OpenRouteService
 * 
 * Request body esperado:
 * {
 *   cepDestino: string (8 dígitos),
 *   destinoCoords?: { lat: number, lng: number } // Opcional, vindo do cache do frontend
 * }
 * 
 * Resposta de sucesso:
 * {
 *   distanciaKm: number,
 *   valorFrete: number,
 *   cepOrigem: string,
 *   cepDestino: string,
 *   origemCoords: { lat: number, lng: number },
 *   destinoCoords: { lat: number, lng: number }
 * }
 * 
 * Resposta de erro:
 * {
 *   error: string,
 *   code: string,
 *   message: string,
 *   details?: any
 * }
 */

// Códigos de erro padronizados
const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_CEP: 'INVALID_CEP',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  CEP_NOT_FOUND: 'CEP_NOT_FOUND',
  GEOCODING_ERROR: 'GEOCODING_ERROR',
  ROUTE_CALCULATION_ERROR: 'ROUTE_CALCULATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

interface ErrorResponse {
  error: string;
  code: ErrorCode;
  message: string;
  details?: any;
}

function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: any
): Response {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  return new Response(
    JSON.stringify({
      error: code,
      code,
      message,
      ...(details && { details }),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

interface RequestBody {
  cepDestino: string;
  destinoCoords?: { lat: number; lng: number }; // Opcional, vindo do cache do frontend
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
// API key do CepAberto
const CEPABERTO_API_KEY = Deno.env.get("CEPABERTO_API_KEY");

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
      console.error("OPENROUTE_API_KEY não configurada");
      return createErrorResponse(
        ERROR_CODES.CONFIGURATION_ERROR,
        "Serviço de cálculo de frete não configurado. Entre em contato com o suporte.",
        503
      );
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Erro ao fazer parse do body:", parseError);
      return createErrorResponse(
        ERROR_CODES.INVALID_REQUEST,
        "Formato da requisição inválido. Verifique os dados enviados.",
        400
      );
    }

    const { cepDestino, destinoCoords: cachedDestinoCoords } = body;

    if (!cepDestino || cepDestino.replace(/\D/g, "").length !== 8) {
      return createErrorResponse(
        ERROR_CODES.INVALID_CEP,
        "CEP inválido. O CEP deve conter exatamente 8 dígitos numéricos.",
        400
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
          .select("cep_origem, valor_por_km, latitude, longitude")
          .single();

        if (!configError && config) {
          cepOrigem = config.cep_origem;
          valorPorKm = parseFloat(config.valor_por_km) || VALOR_POR_KM_DEFAULT;
          console.log(`Configuração encontrada: CEP origem=${cepOrigem}, Valor por km=${valorPorKm}, Latitude=${config.latitude}, Longitude=${config.longitude}`);
          
          // Se já tiver coordenadas salvas, usa elas
          if (config.latitude && config.longitude) {
            const origemCoords = {
              lat: parseFloat(config.latitude),
              lng: parseFloat(config.longitude)
            };
            console.log(`Usando coordenadas em cache: ${origemCoords.lat}, ${origemCoords.lng}`);
            
            // Busca coordenadas do CEP de destino
            console.log(`Buscando coordenadas do CEP de destino: ${cepDestino}`);
            const destinoCoords = await buscarCoordenadasPorCep(cepDestino);
            if (!destinoCoords) {
              console.error("Falha ao buscar coordenadas do destino");
              return createErrorResponse(
                ERROR_CODES.CEP_NOT_FOUND,
                `Não foi possível encontrar o CEP ${cepDestino.replace(/\D/g, "")}. Verifique se o CEP está correto.`,
                404
              );
            }
            console.log(`Coordenadas destino: ${destinoCoords.lat}, ${destinoCoords.lng}`);

            // Continua com o cálculo da distância...
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
              
              // Verifica se é erro de rate limit
              if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
                return createErrorResponse(
                  ERROR_CODES.RATE_LIMIT_EXCEEDED,
                  "Muitas requisições em um curto período. Tente novamente em alguns instantes.",
                  429
                );
              }
              
              return createErrorResponse(
                ERROR_CODES.ROUTE_CALCULATION_ERROR,
                "Não foi possível calcular a rota entre os endereços. Verifique se os CEPs estão corretos.",
                500,
                { debug: errorMessage }
              );
            }

            if (distanciaKm === null) {
              console.error("Falha ao calcular distância");
              return createErrorResponse(
                ERROR_CODES.ROUTE_CALCULATION_ERROR,
                "Não foi possível calcular a distância entre os endereços. Tente novamente mais tarde.",
                503
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
                origemCoords: origemCoords,
                destinoCoords: destinoCoords,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
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
      return createErrorResponse(
        ERROR_CODES.CEP_NOT_FOUND,
        `Não foi possível encontrar o CEP de origem ${cepOrigem}. Entre em contato com o suporte.`,
        404
      );
    }
    console.log(`Coordenadas origem: ${origemCoords.lat}, ${origemCoords.lng}`);
    
    // Salva coordenadas no banco se tivermos o cliente Supabase e as coordenadas não estiverem salvas
    if (supabaseUrl && supabaseAnonKey && authHeader) {
      try {
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        });
        
        // Verifica se já tem coordenadas salvas
        const { data: existingConfig } = await supabaseClient
          .from("configuracoes_frete")
          .select("latitude, longitude")
          .eq("cep_origem", cepOrigem)
          .single();
        
        // Se não tiver coordenadas ou estiverem diferentes, atualiza
        if (!existingConfig?.latitude || !existingConfig?.longitude || 
            parseFloat(existingConfig.latitude) !== origemCoords.lat || 
            parseFloat(existingConfig.longitude) !== origemCoords.lng) {
          
          await supabaseClient
            .from("configuracoes_frete")
            .update({
              latitude: origemCoords.lat,
              longitude: origemCoords.lng
            })
            .eq("cep_origem", cepOrigem);
          
          console.log(`Coordenadas salvas no banco: ${origemCoords.lat}, ${origemCoords.lng}`);
        }
      } catch (saveError) {
        console.log("Erro ao salvar coordenadas (não crítico):", saveError instanceof Error ? saveError.message : String(saveError));
      }
    }

    // Busca coordenadas do CEP de destino (usa cache se disponível)
    let destinoCoords: { lat: number; lng: number } | null;
    
    if (cachedDestinoCoords && cachedDestinoCoords.lat && cachedDestinoCoords.lng) {
      destinoCoords = cachedDestinoCoords;
      console.log(`Usando coordenadas do cache frontend: ${destinoCoords.lat}, ${destinoCoords.lng}`);
    } else {
      console.log(`Buscando coordenadas do CEP de destino: ${cepDestino}`);
      destinoCoords = await buscarCoordenadasPorCep(cepDestino);
      if (!destinoCoords) {
        console.error("Falha ao buscar coordenadas do destino");
        return createErrorResponse(
          ERROR_CODES.CEP_NOT_FOUND,
          `Não foi possível encontrar o CEP ${cepDestino.replace(/\D/g, "")}. Verifique se o CEP está correto.`,
          404
        );
      }
      console.log(`Coordenadas destino: ${destinoCoords.lat}, ${destinoCoords.lng}`);
    }

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
      
      // Verifica se é erro de rate limit
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        return createErrorResponse(
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          "Muitas requisições em um curto período. Tente novamente em alguns instantes.",
          429
        );
      }
      
      return createErrorResponse(
        ERROR_CODES.ROUTE_CALCULATION_ERROR,
        "Não foi possível calcular a rota entre os endereços. Verifique se os CEPs estão corretos.",
        500,
        { debug: errorMessage }
      );
    }

    if (distanciaKm === null) {
      console.error("Falha ao calcular distância");
      return createErrorResponse(
        ERROR_CODES.ROUTE_CALCULATION_ERROR,
        "Não foi possível calcular a distância entre os endereços. Tente novamente mais tarde.",
        503
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
        origemCoords: origemCoords,
        destinoCoords: destinoCoords,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro ao calcular frete:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    // Verifica se é erro de timeout
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      return createErrorResponse(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        "O serviço demorou muito para responder. Tente novamente.",
        504
      );
    }
    
    // Verifica se é erro de rede
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      return createErrorResponse(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        "Erro de conexão com o serviço. Verifique sua internet e tente novamente.",
        503
      );
    }
    
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      "Erro interno ao processar sua solicitação. Tente novamente mais tarde.",
      500,
      { debug: errorMessage }
    );
  }
});

/**
 * Busca coordenadas (lat, lng) de um CEP usando CepAberto (primário) ou ViaCEP (fallback)
 */
async function buscarCoordenadasPorCep(
  cep: string
): Promise<{ lat: number; lng: number } | null> {
  const cepLimpo = cep.replace(/\D/g, "");
  
  // Tenta CepAberto primeiro (já retorna coordenadas)
  if (CEPABERTO_API_KEY) {
    console.log(`Tentando CepAberto para CEP: ${cepLimpo}`);
    try {
      const response = await fetch(
        `https://www.cepaberto.com/api/v3/cep?cep=${cepLimpo}`,
        {
          headers: {
            "Authorization": `Token token=${CEPABERTO_API_KEY}`,
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.latitude && data.longitude) {
          const coords = {
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
          };
          console.log(`Coordenadas encontradas no CepAberto: ${coords.lat}, ${coords.lng}`);
          return coords;
        }
      } else {
        console.log(`CepAberto falhou com status: ${response.status}`);
      }
    } catch (error) {
      console.log("Erro ao usar CepAberto:", error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log("CEPABERTO_API_KEY não configurada, pulando para ViaCEP");
  }

  // Fallback para ViaCEP + Nominatim
  console.log(`Usando fallback ViaCEP para CEP: ${cepLimpo}`);
  return await buscarCoordenadasViaCep(cepLimpo);
}

/**
 * Busca coordenadas (lat, lng) de um CEP usando ViaCEP + Nominatim (fallback)
 */
async function buscarCoordenadasViaCep(
  cepLimpo: string
): Promise<{ lat: number; lng: number } | null> {
  try {
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
      
      console.log(`Coordenadas encontradas no ViaCEP+Nominatim: ${coords.lat}, ${coords.lng}`);
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
      
      // Trata diferentes tipos de erros do OpenRouteService
      if (response.status === 401 || response.status === 403) {
        throw new Error("Erro de autenticação no serviço de rotas. API key inválida.");
      }
      
      if (response.status === 429) {
        throw new Error("Rate limit excedido no serviço de rotas (429).");
      }
      
      if (response.status === 400) {
        throw new Error("Parâmetros inválidos para cálculo de rota (400).");
      }
      
      if (response.status === 404) {
        throw new Error("Rota não encontrada entre os pontos especificados (404).");
      }
      
      if (response.status >= 500) {
        throw new Error(`Serviço de rotas indisponível (${response.status}).`);
      }
      
      // Erro genérico com detalhes
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

