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
        telefone: entrada.telefone,
        frete: entrada.frete,
        valor_cobrado: entrada.valorCobrado,
        descricao: entrada.descricao,
        observacoes: entrada.observacoes,
        data_orcamento: entrada.dataOrcamento?.toISOString(),
        data_entrada: entrada.dataEntrada?.toISOString(),
        data_entrega: entrada.dataEntrega?.toISOString(),
        status: entrada.status,
        status_entrega: entrada.statusEntrega || "pendente",
        progresso: entrada.progresso,
        final_numero_quadro: entrada.finalNumeroQuadro,
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
    const updateData: any = {};
    if (dados.endereco !== undefined) updateData.endereco = dados.endereco;
    if (dados.cep !== undefined) updateData.cep = dados.cep;
    if (dados.telefone !== undefined) updateData.telefone = dados.telefone;
    if (dados.frete !== undefined) updateData.frete = dados.frete;
    if (dados.valorCobrado !== undefined) updateData.valor_cobrado = dados.valorCobrado;
    if (dados.descricao !== undefined) updateData.descricao = dados.descricao;
    if (dados.observacoes !== undefined) updateData.observacoes = dados.observacoes;
    if (dados.dataOrcamento !== undefined) updateData.data_orcamento = dados.dataOrcamento.toISOString();
    if (dados.dataEntrada !== undefined) updateData.data_entrada = dados.dataEntrada.toISOString();
    if (dados.dataEntrega !== undefined) updateData.data_entrega = dados.dataEntrega.toISOString();
    if (dados.status !== undefined) updateData.status = dados.status;
    if (dados.statusEntrega !== undefined) updateData.status_entrega = dados.statusEntrega;
    if (dados.progresso !== undefined) updateData.progresso = dados.progresso;
    if (dados.finalNumeroQuadro !== undefined) updateData.final_numero_quadro = dados.finalNumeroQuadro;
    if (dados.osAssinadaUrl !== undefined) updateData.os_assinada_url = dados.osAssinadaUrl;

    const { data, error } = await supabase
      .from("entradas")
      .update(updateData)
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
      telefone: data.telefone,
      frete: parseFloat(data.frete || 0),
      valorCobrado: data.valor_cobrado ? parseFloat(data.valor_cobrado) : undefined,
      descricao: data.descricao,
      observacoes: data.observacoes,
      dataOrcamento: data.data_orcamento ? new Date(data.data_orcamento) : undefined,
      dataEntrada: data.data_entrada ? new Date(data.data_entrada) : undefined,
      dataEntrega: data.data_entrega ? new Date(data.data_entrega) : undefined,
      status: data.status,
      statusEntrega: data.status_entrega,
      progresso: data.progresso || 0,
      finalNumeroQuadro: data.final_numero_quadro,
      osAssinadaUrl: data.os_assinada_url,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}

