import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { ServicoPersonalizado, ServicoPersonalizadoInput } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de serviços personalizados usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseServicoPersonalizadoRepository implements ServicoPersonalizadoRepository {
  async criar(entradaId: string, servico: ServicoPersonalizadoInput): Promise<ServicoPersonalizado> {
    const { data, error } = await supabase
      .from("servicos_personalizados")
      .insert({
        entrada_id: entradaId,
        nome: servico.nome,
        valor: servico.valor,
        quantidade: servico.quantidade || 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar serviço personalizado: ${error.message}`);
    }

    return this.mapToServicoPersonalizado(data);
  }

  async buscarPorEntradaId(entradaId: string): Promise<ServicoPersonalizado[]> {
    const { data, error } = await supabase
      .from("servicos_personalizados")
      .select("*")
      .eq("entrada_id", entradaId)
      .order("criado_em", { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar serviços personalizados: ${error.message}`);
    }

    return (data || []).map(this.mapToServicoPersonalizado);
  }

  async atualizar(id: string, servico: Partial<ServicoPersonalizadoInput>): Promise<ServicoPersonalizado> {
    const updateData: any = {};
    if (servico.nome !== undefined) updateData.nome = servico.nome;
    if (servico.valor !== undefined) updateData.valor = servico.valor;
    if (servico.quantidade !== undefined) updateData.quantidade = servico.quantidade;

    const { data, error } = await supabase
      .from("servicos_personalizados")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar serviço personalizado: ${error.message}`);
    }

    return this.mapToServicoPersonalizado(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("servicos_personalizados")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar serviço personalizado: ${error.message}`);
    }
  }

  async deletarPorEntradaId(entradaId: string): Promise<void> {
    const { error } = await supabase
      .from("servicos_personalizados")
      .delete()
      .eq("entrada_id", entradaId);

    if (error) {
      throw new Error(`Erro ao deletar serviços personalizados: ${error.message}`);
    }
  }

  private mapToServicoPersonalizado(data: any): ServicoPersonalizado {
    return {
      id: data.id,
      entradaId: data.entrada_id,
      nome: data.nome,
      valor: parseFloat(data.valor) || 0,
      quantidade: data.quantidade || 1,
      criadoEm: new Date(data.criado_em),
    };
  }
}

