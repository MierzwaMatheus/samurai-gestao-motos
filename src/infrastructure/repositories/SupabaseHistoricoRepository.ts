import { supabase } from "@/infrastructure/supabase/client";

export interface HistoricoRepository {
  registrarAtividade(params: {
    entidadeTipo: "entrada" | "orcamento";
    entidadeId: string;
    acao: string;
    detalhes?: Record<string, any>;
  }): Promise<void>;
}

export class SupabaseHistoricoRepository implements HistoricoRepository {
  async registrarAtividade(params: {
    entidadeTipo: "entrada" | "orcamento";
    entidadeId: string;
    acao: string;
    detalhes?: Record<string, any>;
  }): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || null;

    const { error } = await supabase.from("historico_atividades").insert({
      entidade_tipo: params.entidadeTipo,
      entidade_id: params.entidadeId,
      acao: params.acao,
      detalhes: params.detalhes || {},
      user_id: userId,
    });

    if (error) {
      console.error(
        "[SupabaseHistoricoRepository] Erro ao registrar atividade:",
        error
      );
      throw new Error(`Erro ao registrar atividade: ${error.message}`);
    }
  }
}
