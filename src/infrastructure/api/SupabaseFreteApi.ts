import { FreteApi } from "@/domain/interfaces/FreteApi";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação concreta do serviço de frete usando Supabase Edge Function
 * Esta é uma implementação de infraestrutura que conhece detalhes da API externa
 */
export class SupabaseFreteApi implements FreteApi {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }

  async calcular(params: { cepDestino: string }): Promise<{
    distanciaKm: number;
    valorFrete: number;
    cepOrigem: string;
    cepDestino: string;
  }> {
    const { cepDestino } = params;

    // Valida CEP
    const cepLimpo = cepDestino.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      throw new Error("CEP destino deve conter 8 dígitos");
    }

    // Chama diretamente com anon key para evitar problemas de JWT
    // A Edge Function pode buscar configurações do usuário se houver JWT válido no header,
    // mas funciona perfeitamente com valores padrão se não houver
    try {
      // Tenta primeiro com JWT se disponível (para buscar configurações do usuário)
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "apikey": this.supabaseAnonKey,
      };
      
      // Se houver token válido, adiciona no header para buscar configurações
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      } else {
        // Se não houver token, usa anon key como fallback
        headers["Authorization"] = `Bearer ${this.supabaseAnonKey}`;
      }

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/calcular-frete`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ cepDestino: cepLimpo }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || `Erro ao calcular frete: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error || data.message || "Erro ao calcular frete");
      }

      if (typeof data.distanciaKm !== "number" || typeof data.valorFrete !== "number") {
        console.error("Resposta inválida da Edge Function:", data);
        throw new Error("Resposta da Edge Function com formato inválido");
      }

      return data;
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error("Erro desconhecido ao calcular frete");
    }
  }

  private async chamarComAnonKey(cepLimpo: string): Promise<{
    distanciaKm: number;
    valorFrete: number;
    cepOrigem: string;
    cepDestino: string;
  }> {
    // Chama diretamente usando fetch com anon key
    // Isso bypassa a verificação de JWT
    // IMPORTANTE: Adiciona tanto Authorization quanto apikey headers
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/calcular-frete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.supabaseAnonKey}`,
          "apikey": this.supabaseAnonKey,
        },
        body: JSON.stringify({ cepDestino: cepLimpo }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `Erro ao calcular frete: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error || data.message || "Erro ao calcular frete");
    }

    if (typeof data.distanciaKm !== "number" || typeof data.valorFrete !== "number") {
      console.error("Resposta inválida da Edge Function:", data);
      throw new Error("Resposta da Edge Function com formato inválido");
    }

    return data;
  }
}

