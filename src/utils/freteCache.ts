/**
 * Utilitário para cache de coordenadas de CEP no localStorage
 * Otimiza chamadas à API de cálculo de frete
 */

interface CepCoords {
  lat: number;
  lng: number;
}

interface FreteCache {
  [cep: string]: CepCoords;
}

const CACHE_KEY = 'frete_cep_coords';
const CACHE_EXPIRY_DAYS = 90; // Tempo de expiração do cache em dias

/**
 * Salva coordenadas de um CEP no localStorage
 */
export function salvarCepCoords(cep: string, coords: CepCoords): void {
  try {
    const cache = getCepCoordsCache();
    const cepLimpo = cep.replace(/\D/g, '');
    
    cache[cepLimpo] = coords;
    
    // Adiciona timestamp para expiração
    const cacheWithExpiry = {
      data: cache,
      timestamp: Date.now()
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheWithExpiry));
  } catch (error) {
    console.warn('Erro ao salvar coordenadas no localStorage:', error);
  }
}

/**
 * Busca coordenadas de um CEP no localStorage
 */
export function getCepCoords(cep: string): CepCoords | null {
  try {
    const cache = getCepCoordsCache();
    const cepLimpo = cep.replace(/\D/g, '');
    
    return cache[cepLimpo] || null;
  } catch (error) {
    console.warn('Erro ao buscar coordenadas no localStorage:', error);
    return null;
  }
}

/**
 * Obtém o cache completo, verificando expiração
 */
function getCepCoordsCache(): FreteCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Verifica se o cache expirou
    const daysSinceCache = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceCache > CACHE_EXPIRY_DAYS) {
      localStorage.removeItem(CACHE_KEY);
      return {};
    }
    
    return data || {};
  } catch (error) {
    console.warn('Erro ao ler cache do localStorage:', error);
    localStorage.removeItem(CACHE_KEY);
    return {};
  }
}

/**
 * Limpa o cache de coordenadas
 */
export function limparCacheCepCoords(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Erro ao limpar cache do localStorage:', error);
  }
}

/**
 * Função otimizada para calcular frete com cache
 */
export async function calcularFreteComCache(
  supabase: any,
  cepDestino: string
): Promise<any> {
  // Tenta obter coordenadas do cache
  const coordsCache = getCepCoords(cepDestino);
  
  const requestBody: any = {
    cepDestino
  };
  
  // Se tiver coordenadas em cache, inclui na requisição
  if (coordsCache) {
    requestBody.destinoCoords = coordsCache;
    console.log('Usando coordenadas do cache localStorage:', coordsCache);
  }
  
  try {
    const response = await supabase.functions.invoke('calcular-frete', {
      body: requestBody
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    const data = response.data;
    
    // Se a resposta incluir coordenadas do destino e não tinham no cache, salva
    if (data.destinoCoords && !coordsCache) {
      salvarCepCoords(cepDestino, data.destinoCoords);
      console.log('Coordenadas salvas no cache localStorage:', data.destinoCoords);
    }
    
    return data;
    
  } catch (error) {
    console.error('Erro ao calcular frete:', error);
    throw error;
  }
}
