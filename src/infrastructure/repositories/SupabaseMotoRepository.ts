import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { Moto } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de motos usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseMotoRepository implements MotoRepository {
  async criar(moto: Omit<Moto, "id" | "criadoEm" | "atualizadoEm">): Promise<Moto> {
    const { data, error } = await supabase
      .from("motos")
      .insert({
        cliente_id: moto.clienteId,
        modelo: moto.modelo,
        placa: moto.placa,
        final_numero_quadro: moto.finalNumeroQuadro,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar moto: ${error.message}`);
    }

    return this.mapToMoto(data);
  }

  async buscarPorId(id: string): Promise<Moto | null> {
    const { data, error } = await supabase
      .from("motos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar moto: ${error.message}`);
    }

    return data ? this.mapToMoto(data) : null;
  }

  async buscarPorClienteId(clienteId: string): Promise<Moto[]> {
    const { data, error } = await supabase
      .from("motos")
      .select("*")
      .eq("cliente_id", clienteId);

    if (error) {
      throw new Error(`Erro ao buscar motos: ${error.message}`);
    }

    return (data || []).map(this.mapToMoto);
  }

  async listar(): Promise<Moto[]> {
    const { data, error } = await supabase
      .from("motos")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar motos: ${error.message}`);
    }

    return (data || []).map(this.mapToMoto);
  }

  async atualizar(id: string, dados: Partial<Moto>): Promise<Moto> {
    const { data, error } = await supabase
      .from("motos")
      .update({
        modelo: dados.modelo,
        placa: dados.placa,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar moto: ${error.message}`);
    }

    return this.mapToMoto(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("motos")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar moto: ${error.message}`);
    }
  }

  private mapToMoto(data: any): Moto {
    return {
      id: data.id,
      clienteId: data.cliente_id,
      modelo: data.modelo,
      placa: data.placa,
      finalNumeroQuadro: data.final_numero_quadro,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}

