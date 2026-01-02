import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { Entrada } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de entradas usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseEntradaRepository implements EntradaRepository {
  async criar(entrada: Omit<Entrada, "id" | "criadoEm" | "atualizadoEm">): Promise<Entrada> {
    const { data, error } = await supabase
      .from("entradas")
      .insert({
        tipo: entrada.tipo,
        cliente_id: entrada.clienteId,
        moto_id: entrada.motoId,
        endereco: entrada.endereco,
        cep: entrada.cep,
        frete: entrada.frete,
        descricao: entrada.descricao,
        status: entrada.status,
        progresso: entrada.progresso,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar entrada: ${error.message}`);
    }

    return this.mapToEntrada(data);
  }

  async buscarPorId(id: string): Promise<Entrada | null> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar entrada: ${error.message}`);
    }

    return data ? this.mapToEntrada(data) : null;
  }

  async buscarPorClienteId(clienteId: string): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async buscarPorMotoId(motoId: string): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("moto_id", motoId)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async buscarPorStatus(status: Entrada["status"]): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("status", status)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async listar(): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async atualizar(id: string, dados: Partial<Entrada>): Promise<Entrada> {
    const { data, error } = await supabase
      .from("entradas")
      .update({
        endereco: dados.endereco,
        cep: dados.cep,
        frete: dados.frete,
        descricao: dados.descricao,
        status: dados.status,
        progresso: dados.progresso,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar entrada: ${error.message}`);
    }

    return this.mapToEntrada(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("entradas")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar entrada: ${error.message}`);
    }
  }

  private mapToEntrada(data: any): Entrada {
    return {
      id: data.id,
      tipo: data.tipo,
      clienteId: data.cliente_id,
      motoId: data.moto_id,
      endereco: data.endereco,
      cep: data.cep,
      frete: parseFloat(data.frete || 0),
      descricao: data.descricao,
      status: data.status,
      progresso: data.progresso || 0,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}

