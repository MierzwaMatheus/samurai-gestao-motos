import { useState, useEffect } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import type {
  FaturamentoMensal,
  FaturamentoPorServico,
  TopCliente,
  ServicoMaisRealizado,
  ConversaoOrcamento,
  StatusEntrada,
  StatusEntrega,
  ResumoDiario,
  DistribuicaoCategoria,
  MetricasPerformance,
  NovosClientesPeriodo,
  FotosPeriodo,
  FiltrosRelatorio,
} from '@/domain/interfaces/relatorios';

/** Colunas explícitas por view - ciclo 1 issue #4 */
const COLUMNS_BY_VIEW = {
  'vw_status_entradas': ['status', 'quantidade', 'percentual', 'progresso_medio', 'dias_medio_conclusao'],
  'vw_status_entrega': ['status_entrega', 'quantidade', 'percentual', 'dias_medio_entrega'],
  'vw_distribuicao_categoria': ['categoria', 'tipos_servico', 'entradas_afetadas', 'total_execucoes', 'faturamento_categoria'],
  'vw_metricas_performance': ['total_entradas', 'total_orcamentos', 'pendentes', 'alinhando', 'concluidos', 'entrega_pendente', 'entregues', 'retirados', 'faturamento_total', 'ticket_medio_geral', 'clientes_unicos', 'motos_unicas'],
  'vw_faturamento_por_servico': ['servico', 'categoria', 'quantidade_entradas', 'total_execucoes', 'faturamento_total'],
  'vw_top_clientes': ['cliente_id', 'cliente_nome', 'telefone', 'email', 'numero_servicos', 'total_entradas', 'faturamento_total', 'ticket_medio', 'ultimo_servico'],
  'vw_servicos_mais_realizados': ['servico', 'categoria', 'total_historico', 'entradas_diferentes', 'total_execucoes', 'media_por_entrada'],
} as const;

interface UseQueryResult<T> {
  data: T[] | T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useSupabaseQuery<T>(queryFn: () => any, deps: any[] = []) {
  const [data, setData] = useState<T[] | T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = queryFn();
      const { data: result, error: err } = await query;
      if (err) throw err;
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, deps);

  return { data, isLoading, error, refetch: fetchData };
}

export function useFaturamentoMensal(periodo: FiltrosRelatorio['periodo'] = '12m') {
  return useSupabaseQuery<FaturamentoMensal[]>(
    () => {
      const intervalo = getIntervaloSql(periodo);
      return supabase
        .from('vw_faturamento_mensal')
        .select('*')
        .gte('mes', intervalo)
        .order('mes', { ascending: false });
    },
    [periodo]
  );
}

export function useFaturamentoPorServico(periodo: FiltrosRelatorio['periodo'] = '12m') {
  return useSupabaseQuery<FaturamentoPorServico[]>(
    () => supabase
      .from('vw_faturamento_por_servico')
      .select(COLUMNS_BY_VIEW['vw_faturamento_por_servico'].join(','))
      .order('faturamento_total', { ascending: false })
      .limit(20)
  );
}

export function useTopClientes(limit: number = 20) {
  return useSupabaseQuery<TopCliente[]>(
    () => supabase
      .from('vw_top_clientes')
      .select(COLUMNS_BY_VIEW['vw_top_clientes'].join(','))
      .order('faturamento_total', { ascending: false })
      .limit(limit)
  );
}

export function useServicosMaisRealizados() {
  return useSupabaseQuery<ServicoMaisRealizado[]>(
    () => supabase
      .from('vw_servicos_mais_realizados')
      .select(COLUMNS_BY_VIEW['vw_servicos_mais_realizados'].join(','))
      .order('total_execucoes', { ascending: false })
      .limit(15)
  );
}

export function useConversaoOrcamentos(periodo: FiltrosRelatorio['periodo'] = '12m') {
  return useSupabaseQuery<ConversaoOrcamento[]>(
    () => supabase
      .from('vw_conversao_orcamentos')
      .select('*')
      .order('mes', { ascending: false }),
    [periodo]
  );
}

export function useStatusEntradas() {
  return useSupabaseQuery<StatusEntrada[]>(
    () => supabase
      .from('vw_status_entradas')
      .select(COLUMNS_BY_VIEW['vw_status_entradas'].join(','))
      .order('quantidade', { ascending: false })
  );
}

export function useStatusEntrega() {
  return useSupabaseQuery<StatusEntrega[]>(
    () => supabase
      .from('vw_status_entrega')
      .select(COLUMNS_BY_VIEW['vw_status_entrega'].join(','))
      .order('quantidade', { ascending: false })
  );
}

export function useResumoDiario(periodo: FiltrosRelatorio['periodo'] = '90d') {
  return useSupabaseQuery<ResumoDiario[]>(
    () => {
      const intervalo = getIntervaloSql(periodo);
      return supabase
        .from('vw_resumo_diario')
        .select('*')
        .gte('data', intervalo)
        .order('data', { ascending: false });
    },
    [periodo]
  );
}

export function useDistribuicaoCategoria() {
  return useSupabaseQuery<DistribuicaoCategoria[]>(
    () => supabase
      .from('vw_distribuicao_categoria')
      .select(COLUMNS_BY_VIEW['vw_distribuicao_categoria'].join(','))
      .order('faturamento_categoria', { ascending: false })
  );
}

export function useMetricasPerformance() {
  return useSupabaseQuery<MetricasPerformance>(
    () => supabase
      .from('vw_metricas_performance')
      .select(COLUMNS_BY_VIEW['vw_metricas_performance'].join(','))
      .single()
  );
}

export function useNovosClientesPeriodo(periodo: FiltrosRelatorio['periodo'] = '12m') {
  return useSupabaseQuery<NovosClientesPeriodo[]>(
    () => {
      const intervalo = getIntervaloSql(periodo);
      return supabase
        .from('vw_novos_clientes_periodo')
        .select('*')
        .gte('mes', intervalo)
        .order('mes', { ascending: false });
    },
    [periodo]
  );
}

export function useFotosPeriodo(periodo: FiltrosRelatorio['periodo'] = '12m') {
  return useSupabaseQuery<FotosPeriodo[]>(
    () => {
      const intervalo = getIntervaloSql(periodo);
      return supabase
        .from('vw_fotos_periodo')
        .select('*')
        .gte('mes', intervalo)
        .order('mes', { ascending: false });
    },
    [periodo]
  );
}

function getIntervaloSql(periodo: FiltrosRelatorio['periodo']): string {
  const agora = new Date();
  
  switch (periodo) {
    case '7d':
      return new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90d':
      return new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case '12m':
      return new Date(agora.setFullYear(agora.getFullYear() - 1)).toISOString();
    case 'tudo':
      return new Date('2000-01-01').toISOString();
    default:
      return new Date(agora.setFullYear(agora.getFullYear() - 1)).toISOString();
  }
}
