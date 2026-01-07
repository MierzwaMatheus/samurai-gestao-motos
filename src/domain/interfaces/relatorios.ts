export interface FaturamentoMensal {
  mes: string;
  total_entradas: number;
  faturamento_total: number;
  total_frete: number;
  ticket_medio: number;
  clientes_unicos: number;
  motos_unicas: number;
}

export interface FaturamentoPorServico {
  servico: string;
  categoria: string;
  quantidade_entradas: number;
  total_execucoes: number;
  faturamento_total: number;
}

export interface TopCliente {
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  email: string | null;
  numero_servicos: number;
  total_entradas: number;
  faturamento_total: number;
  ticket_medio: number;
  ultimo_servico: string;
}

export interface ServicoMaisRealizado {
  servico: string;
  categoria: string;
  total_historico: number;
  entradas_diferentes: number;
  total_execucoes: number;
  media_por_entrada: number;
}

export interface ConversaoOrcamento {
  mes: string;
  orcamentos_criados: number;
  orcamentos_convertidos: number;
  taxa_conversao_percentual: number;
  orcamentos_expirados: number;
}

export interface StatusEntrada {
  status: string;
  quantidade: number;
  percentual: number;
  progresso_medio: number;
  dias_medio_conclusao: number;
}

export interface StatusEntrega {
  status_entrega: string;
  quantidade: number;
  percentual: number;
  dias_medio_entrega: number;
}

export interface AtividadePeriodo {
  dia: string;
  acao: string;
  entidade_tipo: string;
  quantidade: number;
}

export interface FaturamentoClienteDetalhado {
  cliente_id: string;
  cliente_nome: string;
  entrada_id: string;
  data_entrada: string;
  moto_modelo: string;
  placa: string | null;
  status: string;
  valor_cobrado: number | null;
  frete: number | null;
}

export interface ServicoPersonalizadoComum {
  servico_personalizado: string;
  quantidade_entradas: number;
  total_execucoes: number;
  valor_medio: number;
  faturamento_total: number;
}

export interface ResumoDiario {
  data: string;
  novas_entradas: number;
  novos_orcamentos: number;
  concluidos: number;
  em_andamento: number;
  entregues: number;
  faturamento_dia: number;
  frete_dia: number;
}

export interface DistribuicaoCategoria {
  categoria: string;
  tipos_servico: number;
  entradas_afetadas: number;
  total_execucoes: number;
  faturamento_categoria: number;
}

export interface NovosClientesPeriodo {
  mes: string;
  novos_clientes: number;
  clientes_com_servico: number;
  taxa_conversao_percentual: number;
}

export interface MetricasPerformance {
  total_entradas: number;
  total_orcamentos: number;
  pendentes: number;
  alinhando: number;
  concluidos: number;
  entrega_pendente: number;
  entregues: number;
  retirados: number;
  faturamento_total: number;
  ticket_medio_geral: number;
  clientes_unicos: number;
  motos_unicas: number;
}

export interface FotosPeriodo {
  mes: string;
  tipo: string;
  quantidade_fotos: number;
  entradas_com_fotos: number;
}

export type TipoRelatorio =
  | 'faturamento-mensal'
  | 'faturamento-servico'
  | 'top-clientes'
  | 'servicos-mais-realizados'
  | 'conversao-orcamentos'
  | 'status-entradas'
  | 'status-entrega'
  | 'resumo-diario'
  | 'metricas-gerais'
  | 'distribuicao-categoria';

export interface FiltrosRelatorio {
  periodo: '7d' | '30d' | '90d' | '12m' | 'tudo';
  dataInicio?: Date;
  dataFim?: Date;
}

export interface DadosGrafico {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
}
