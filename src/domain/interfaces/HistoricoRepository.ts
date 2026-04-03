export interface HistoricoRepository {
  registrarAtividade(params: {
    entidadeTipo: "entrada" | "orcamento";
    entidadeId: string;
    acao: string;
    detalhes?: Record<string, any>;
  }): Promise<void>;
}
