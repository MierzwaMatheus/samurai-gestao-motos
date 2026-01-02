import { FreteApi } from "@/domain/interfaces/FreteApi";

/**
 * Implementação concreta do serviço de frete usando Supabase Edge Function
 * Esta é uma implementação de infraestrutura que conhece detalhes da API externa
 */
export class SupabaseFreteApi implements FreteApi {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor() {
    this.supabaseUrl =
      import.meta.env.VITE_SUPABASE_URL ||
      "https://your-project-id.supabase.co";
    this.supabaseAnonKey =
      import.meta.env.VITE_SUPABASE_ANON_KEY || "";

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.warn(
        "Supabase URL ou ANON KEY não configurados. Configure as variáveis de ambiente."
      );
    }
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

    // Chama a edge function do Supabase
    const response = await fetch(
      `${this.supabaseUrl}/functions/v1/calcular-frete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.supabaseAnonKey}`,
        },
        body: JSON.stringify({ cepDestino: cepLimpo }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || `Erro ao calcular frete: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  }
}

