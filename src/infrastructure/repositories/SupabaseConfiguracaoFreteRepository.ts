import { ConfiguracaoFreteRepository } from "@/domain/interfaces/ConfiguracaoFreteRepository";
import { ConfiguracaoFrete } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de configurações de frete usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseConfiguracaoFreteRepository implements ConfiguracaoFreteRepository {
  async buscarPorUsuario(): Promise<ConfiguracaoFrete | null> {
    const { data, error } = await supabase
      .from("configuracoes_frete")
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar configuração: ${error.message}`);
    }

    return data ? this.mapToConfiguracaoFrete(data) : null;
  }

  async criarOuAtualizar(
    dados: Omit<ConfiguracaoFrete, "id" | "criadoEm" | "atualizadoEm">
  ): Promise<ConfiguracaoFrete> {
    // Primeiro tenta buscar configuração existente
    const configExistente = await this.buscarPorUsuario();

    if (configExistente) {
      // Atualiza configuração existente
      const { data, error } = await supabase
        .from("configuracoes_frete")
        .update({
          cep_origem: dados.cepOrigem,
          valor_por_km: dados.valorPorKm,
        })
        .eq("id", configExistente.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar configuração: ${error.message}`);
      }

      return this.mapToConfiguracaoFrete(data);
    } else {
      // Cria nova configuração
      const { data, error } = await supabase
        .from("configuracoes_frete")
        .insert({
          cep_origem: dados.cepOrigem,
          valor_por_km: dados.valorPorKm,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar configuração: ${error.message}`);
      }

      return this.mapToConfiguracaoFrete(data);
    }
  }

  private mapToConfiguracaoFrete(data: any): ConfiguracaoFrete {
    return {
      id: data.id,
      cepOrigem: data.cep_origem,
      valorPorKm: parseFloat(data.valor_por_km),
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}


