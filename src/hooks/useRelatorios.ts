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

interface UseQueryResult<T> {
  data: T[] | T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useSupabaseQuery<T>(query: any): UseQueryResult<T> {
  const [data, setData] = useState<T[] | T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
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
  }, []);

  return { data, isLoading, error, refetch: fetchData };
}

export function useFaturamentoMensal(periodo: FiltrosRelatorio['periodo'] = '12m') {
  const intervalo = getIntervaloSql(periodo);

  return useSupabaseQuery<FaturamentoMensal[]>(
    supabase
      .from('vw_faturamento_mensal')
      .select('*')
      .gte('mes', intervalo)
      .order('mes', { ascending: false })
  );
}

export function useFaturamentoPorServico(periodo: FiltrosRelatorio['periodo'] = '12m') {
  const intervalo = getIntervaloSql(periodo);

  return useSupabaseQuery<FaturamentoPorServico[]>(
    supabase
      .from('vw_faturamento_por_servico')
      .select('*')
      .order('faturamento_total', { ascending: false })
      .limit(20)
  );
}

export function useTopClientes(limit: number = 20) {
  return useSupabaseQuery<TopCliente[]>(
    supabase
      .from('vw_top_clientes')
      .select('*')
      .order('faturamento_total', { ascending: false })
      .limit(limit)
  );
}

export function useServicosMaisRealizados() {
  return useSupabaseQuery<ServicoMaisRealizado[]>(
    supabase
      .from('vw_servicos_mais_realizados')
      .select('*')
      .order('total_execucoes', { ascending: false })
      .limit(15)
  );
}

export function useConversaoOrcamentos(periodo: FiltrosRelatorio['periodo'] = '12m') {
  const intervalo = getIntervaloSql(periodo);

  return useSupabaseQuery<ConversaoOrcamento[]>(
    supabase
      .from('vw_conversao_orcamentos')
      .select('*')
      .order('mes', { ascending: false })
  );
}

export function useStatusEntradas() {
  return useSupabaseQuery<StatusEntrada[]>(
    supabase
      .from('vw_status_entradas')
      .select('*')
      .order('quantidade', { ascending: false })
  );
}

export function useStatusEntrega() {
  return useSupabaseQuery<StatusEntrega[]>(
    supabase
      .from('vw_status_entrega')
      .select('*')
      .order('quantidade', { ascending: false })
  );
}

export function useResumoDiario(periodo: FiltrosRelatorio['periodo'] = '90d') {
  const intervalo = getIntervaloSql(periodo);

  return useSupabaseQuery<ResumoDiario[]>(
    supabase
      .from('vw_resumo_diario')
      .select('*')
      .gte('data', intervalo)
      .order('data', { ascending: false })
  );
}

export function useDistribuicaoCategoria() {
  return useSupabaseQuery<DistribuicaoCategoria[]>(
    supabase
      .from('vw_distribuicao_categoria')
      .select('*')
      .order('faturamento_categoria', { ascending: false })
  );
}

export function useMetricasPerformance() {
  return useSupabaseQuery<MetricasPerformance>(
    supabase
      .from('vw_metricas_performance')
      .select('*')
      .single()
  );
}

export function useNovosClientes(periodo: FiltrosRelatorio['periodo'] = '12m') {
  const intervalo = getIntervaloSql(periodo);

  return useSupabaseQuery<NovosClientesPeriodo[]>(
    supabase
      .from('vw_novos_clientes_periodo')
      .select('*')
      .gte('mes', intervalo)
      .order('mes', { ascending: false })
  );
}

export function useFotosPeriodo(periodo: FiltrosRelatorio['periodo'] = '12m') {
  const intervalo = getIntervaloSql(periodo);

  return useSupabaseQuery<FotosPeriodo[]>(
    supabase
      .from('vw_fotos_periodo')
      .select('*')
      .gte('mes', intervalo)
      .order('mes', { ascending: false })
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
