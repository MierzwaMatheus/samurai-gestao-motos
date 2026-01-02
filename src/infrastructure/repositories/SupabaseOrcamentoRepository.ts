import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { Orcamento, OrcamentoCompleto } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de orçamentos usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseOrcamentoRepository implements OrcamentoRepository {
  async criar(orcamento: Omit<Orcamento, "id" | "criadoEm" | "atualizadoEm">): Promise<Orcamento> {
    const { data, error } = await supabase
      .from("orcamentos")
      .insert({
        entrada_id: orcamento.entradaId,
        valor: orcamento.valor,
        data_expiracao: orcamento.dataExpiracao.toISOString(),
        status: orcamento.status,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar orçamento: ${error.message}`);
    }

    return this.mapToOrcamento(data);
  }

  async buscarPorId(id: string): Promise<Orcamento | null> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar orçamento: ${error.message}`);
    }

    return data ? this.mapToOrcamento(data) : null;
  }

  async buscarPorEntradaId(entradaId: string): Promise<Orcamento | null> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("entrada_id", entradaId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar orçamento: ${error.message}`);
    }

    return data ? this.mapToOrcamento(data) : null;
  }

  async buscarCompletosPorStatus(status: Orcamento["status"]): Promise<OrcamentoCompleto[]> {
    // Busca orçamentos com joins para obter dados completos
    const { data: orcamentos, error: orcamentosError } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("status", status)
      .order("criado_em", { ascending: false });

    if (orcamentosError) {
      throw new Error(`Erro ao buscar orçamentos: ${orcamentosError.message}`);
    }

    if (!orcamentos || orcamentos.length === 0) {
      return [];
    }

    // Busca entradas relacionadas
    const entradaIds = orcamentos.map((o: any) => o.entrada_id);
    const { data: entradas, error: entradasError } = await supabase
      .from("entradas")
      .select("id, descricao, cliente_id, moto_id")
      .in("id", entradaIds);

    if (entradasError) {
      throw new Error(`Erro ao buscar entradas: ${entradasError.message}`);
    }

    // Busca clientes e motos
    const clienteIds = [...new Set(entradas?.map((e: any) => e.cliente_id) || [])];
    const motoIds = [...new Set(entradas?.map((e: any) => e.moto_id) || [])];

    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome")
      .in("id", clienteIds);

    const { data: motos } = await supabase
      .from("motos")
      .select("id, modelo")
      .in("id", motoIds);

    // Mapeia os dados completos
    return orcamentos.map((orcamento: any) => {
      const entrada = entradas?.find((e: any) => e.id === orcamento.entrada_id);
      const cliente = clientes?.find((c: any) => c.id === entrada?.cliente_id);
      const moto = motos?.find((m: any) => m.id === entrada?.moto_id);

      return {
        ...this.mapToOrcamento(orcamento),
        cliente: cliente?.nome || "",
        moto: moto?.modelo || "",
        descricao: entrada?.descricao,
      };
    });
  }

  async listar(): Promise<Orcamento[]> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar orçamentos: ${error.message}`);
    }

    return (data || []).map(this.mapToOrcamento);
  }

  async atualizar(id: string, dados: Partial<Orcamento>): Promise<Orcamento> {
    const updateData: any = {};
    if (dados.valor !== undefined) updateData.valor = dados.valor;
    if (dados.dataExpiracao !== undefined) updateData.data_expiracao = dados.dataExpiracao.toISOString();
    if (dados.status !== undefined) updateData.status = dados.status;

    const { data, error } = await supabase
      .from("orcamentos")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar orçamento: ${error.message}`);
    }

    return this.mapToOrcamento(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("orcamentos")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar orçamento: ${error.message}`);
    }
  }

  private mapToOrcamento(data: any): Orcamento {
    return {
      id: data.id,
      entradaId: data.entrada_id,
      valor: parseFloat(data.valor || 0),
      dataExpiracao: new Date(data.data_expiracao),
      status: data.status,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}

