import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { TipoServico, TipoServicoComQuantidade } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de tipos de serviço usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseTipoServicoRepository implements TipoServicoRepository {
  async criar(tipoServico: Omit<TipoServico, "id" | "criadoEm" | "atualizadoEm" | "quantidadeServicos">): Promise<TipoServico> {
    const { data, error } = await supabase
      .from("tipos_servico")
      .insert({
        nome: tipoServico.nome,
        preco_oficina: tipoServico.precoOficina || 0,
        preco_particular: tipoServico.precoParticular || 0,
        categoria: tipoServico.categoria || "padrao",
        preco_oficina_com_oleo: tipoServico.precoOficinaComOleo,
        preco_oficina_sem_oleo: tipoServico.precoOficinaSemOleo,
        preco_particular_com_oleo: tipoServico.precoParticularComOleo,
        preco_particular_sem_oleo: tipoServico.precoParticularSemOleo,
        quantidade_servicos: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar tipo de serviço: ${error.message}`);
    }

    return this.mapToTipoServico(data);
  }

  async buscarPorId(id: string): Promise<TipoServico | null> {
    const { data, error } = await supabase
      .from("tipos_servico")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar tipo de serviço: ${error.message}`);
    }

    return data ? this.mapToTipoServico(data) : null;
  }

  async buscarPorNome(nome: string): Promise<TipoServico[]> {
    const { data, error } = await supabase
      .from("tipos_servico")
      .select("*")
      .ilike("nome", `%${nome}%`)
      .order("nome", { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar tipos de serviço: ${error.message}`);
    }

    return (data || []).map(this.mapToTipoServico);
  }

  async listar(): Promise<TipoServico[]> {
    const { data, error } = await supabase
      .from("tipos_servico")
      .select("*")
      .order("nome", { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar tipos de serviço: ${error.message}`);
    }

    return (data || []).map(this.mapToTipoServico);
  }

  async atualizar(id: string, dados: Partial<Omit<TipoServico, "id" | "criadoEm" | "atualizadoEm" | "quantidadeServicos">>): Promise<TipoServico> {
    const updateData: any = {};
    if (dados.nome !== undefined) updateData.nome = dados.nome;
    if (dados.precoOficina !== undefined) updateData.preco_oficina = dados.precoOficina;
    if (dados.precoParticular !== undefined) updateData.preco_particular = dados.precoParticular;
    if (dados.categoria !== undefined) updateData.categoria = dados.categoria;
    if (dados.precoOficinaComOleo !== undefined) updateData.preco_oficina_com_oleo = dados.precoOficinaComOleo;
    if (dados.precoOficinaSemOleo !== undefined) updateData.preco_oficina_sem_oleo = dados.precoOficinaSemOleo;
    if (dados.precoParticularComOleo !== undefined) updateData.preco_particular_com_oleo = dados.precoParticularComOleo;
    if (dados.precoParticularSemOleo !== undefined) updateData.preco_particular_sem_oleo = dados.precoParticularSemOleo;

    const { data, error } = await supabase
      .from("tipos_servico")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar tipo de serviço: ${error.message}`);
    }

    return this.mapToTipoServico(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("tipos_servico")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar tipo de serviço: ${error.message}`);
    }
  }

  async vincularTiposServicoAEntrada(entradaId: string, servicos: Array<{ tipoServicoId: string; quantidade: number; comOleo?: boolean }>): Promise<void> {
    if (servicos.length === 0) {
      return;
    }

    // Primeiro, remove todos os vínculos existentes para esta entrada
    const { error: deleteError } = await supabase
      .from("entradas_tipos_servico")
      .delete()
      .eq("entrada_id", entradaId);

    if (deleteError) {
      throw new Error(`Erro ao remover vínculos de tipos de serviço: ${deleteError.message}`);
    }

    // Depois, cria os novos vínculos com quantidade
    const vinculos = servicos.map((servico) => ({
      entrada_id: entradaId,
      tipo_servico_id: servico.tipoServicoId,
      quantidade: servico.quantidade || 1,
      com_oleo: servico.comOleo || false,
    }));

    const { error: insertError } = await supabase
      .from("entradas_tipos_servico")
      .insert(vinculos);

    if (insertError) {
      throw new Error(`Erro ao vincular tipos de serviço à entrada: ${insertError.message}`);
    }
  }

  async buscarPorEntradaId(entradaId: string): Promise<TipoServicoComQuantidade[]> {
    // Busca os vínculos com quantidade
    const { data: vinculos, error: vinculosError } = await supabase
      .from("entradas_tipos_servico")
      .select("tipo_servico_id, quantidade, com_oleo")
      .eq("entrada_id", entradaId);

    if (vinculosError) {
      throw new Error(`Erro ao buscar vínculos de tipos de serviço: ${vinculosError.message}`);
    }

    if (!vinculos || vinculos.length === 0) {
      return [];
    }

    // Depois busca os tipos de serviço pelos IDs
    const tipoServicoIds = vinculos.map((v: any) => v.tipo_servico_id);
    const { data: tiposServico, error: tiposError } = await supabase
      .from("tipos_servico")
      .select("*")
      .in("id", tipoServicoIds);

    if (tiposError) {
      throw new Error(`Erro ao buscar tipos de serviço: ${tiposError.message}`);
    }

    if (!tiposServico || tiposServico.length === 0) {
      return [];
    }

    // Combina os dados do tipo de serviço com a quantidade
    return tiposServico.map((tipo: any) => {
      const vinculo = vinculos.find((v: any) => v.tipo_servico_id === tipo.id);
      return {
        ...this.mapToTipoServico(tipo),
        quantidade: vinculo?.quantidade || 1,
        comOleo: vinculo?.com_oleo || false,
      };
    });
  }

  private mapToTipoServico(data: any): TipoServico {
    const tipoServico = {
      id: data.id,
      nome: data.nome,
      precoOficina: parseFloat(data.preco_oficina ?? data.valor ?? 0) || 0,
      precoParticular: parseFloat(data.preco_particular ?? data.valor ?? 0) || 0,
      categoria: data.categoria || "padrao",
      precoOficinaComOleo: data.preco_oficina_com_oleo ? parseFloat(data.preco_oficina_com_oleo) : undefined,
      precoOficinaSemOleo: data.preco_oficina_sem_oleo ? parseFloat(data.preco_oficina_sem_oleo) : undefined,
      precoParticularComOleo: data.preco_particular_com_oleo ? parseFloat(data.preco_particular_com_oleo) : undefined,
      precoParticularSemOleo: data.preco_particular_sem_oleo ? parseFloat(data.preco_particular_sem_oleo) : undefined,
      quantidadeServicos: data.quantidade_servicos || 0,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
    
    return tipoServico;
  }
}

