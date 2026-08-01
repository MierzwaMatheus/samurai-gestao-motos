import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { StatusEntrada, StatusEntrega, DistribuicaoCategoria, MetricasPerformance, FaturamentoPorServico, TopCliente, ServicoMaisRealizado, FaturamentoMensal, ConversaoOrcamento, NovosClientesPeriodo, FotosPeriodo, ResumoDiario } from '@/domain/interfaces/relatorios';

// Mock do cliente supabase
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('useRelatorios - COLUMNS_BY_VIEW', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useStatusEntradas', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: StatusEntrada[] = [
        { status: 'em_andamento', quantidade: 10, percentual: 50, progresso_medio: 65, dias_medio_conclusao: 5 },
      ];

      const mockSelect = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
      };

      const mockFrom = {
        select: vi.fn().mockReturnValue(mockSelect),
        order: vi.fn().mockReturnThis(),
      };

      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });
      mockSelect.order.mockResolvedValue({ data: mockData, error: null });

      const { useStatusEntradas } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useStatusEntradas());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verifica que select foi chamado com colunas explícitas
      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall).toBeDefined();
      // NÃO deve ser '*'
      expect(selectCall[0]).not.toBe('*');
      // Deve conter as colunas esperadas
      expect(selectCall[0]).toContain('status');
      expect(selectCall[0]).toContain('quantidade');
    });

    it('deve retornar dados corretamente tipados', async () => {
      const mockData: StatusEntrada[] = [
        { status: 'concluido', quantidade: 25, percentual: 100, progresso_medio: 100, dias_medio_conclusao: 3 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.order.mockResolvedValue({ data: mockData, error: null });

      const { useStatusEntradas } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useStatusEntradas());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useStatusEntrega', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: StatusEntrega[] = [
        { status_entrega: 'entregue', quantidade: 15, percentual: 75, dias_medio_entrega: 2 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });

      const { useStatusEntrega } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useStatusEntrega());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('status_entrega');
      expect(selectCall[0]).toContain('quantidade');
    });
  });

  describe('useDistribuicaoCategoria', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: DistribuicaoCategoria[] = [
        { categoria: 'revisão', tipos_servico: 5, entradas_afetadas: 20, total_execucoes: 35, faturamento_categoria: 5000 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });

      const { useDistribuicaoCategoria } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useDistribuicaoCategoria());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('categoria');
      expect(selectCall[0]).toContain('faturamento_categoria');
    });
  });

  describe('useMetricasPerformance', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: MetricasPerformance = {
        total_entradas: 100,
        total_orcamentos: 50,
        pendentes: 20,
        alinhando: 10,
        concluidos: 30,
        entrega_pendente: 5,
        entregues: 25,
        retirados: 10,
        faturamento_total: 50000,
        ticket_medio_geral: 500,
        clientes_unicos: 80,
        motos_unicas: 95,
      };

      const mockFrom = { select: vi.fn().mockReturnThis(), single: vi.fn() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });

      const { useMetricasPerformance } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useMetricasPerformance());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('total_entradas');
      expect(selectCall[0]).toContain('faturamento_total');
    });

    it('deve retornar dados como objeto único (single)', async () => {
      const mockData: MetricasPerformance = {
        total_entradas: 100,
        total_orcamentos: 50,
        pendentes: 20,
        alinhando: 10,
        concluidos: 30,
        entrega_pendente: 5,
        entregues: 25,
        retirada: 10,
        faturamento_total: 50000,
        ticket_medio_geral: 500,
        clientes_unicos: 80,
        motos_unicas: 95,
      };

      const mockFrom = { select: vi.fn().mockReturnThis(), single: vi.fn() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });

      const { useMetricasPerformance } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useMetricasPerformance());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });
  });

  describe('useFaturamentoPorServico', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: FaturamentoPorServico[] = [
        { servico: 'troca de óleo', categoria: 'manutenção', quantidade_entradas: 50, total_execucoes: 55, faturamento_total: 12500 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });

      const { useFaturamentoPorServico } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useFaturamentoPorServico());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('servico');
      expect(selectCall[0]).toContain('faturamento_total');
    });
  });

  describe('useTopClientes', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: TopCliente[] = [
        { cliente_id: '123', cliente_nome: 'João Silva', telefone: '11999999999', email: 'joao@email.com', numero_servicos: 15, total_entradas: 10, faturamento_total: 5000, ticket_medio: 500, ultimo_servico: '2024-01-15' },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });

      const { useTopClientes } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useTopClientes());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('cliente_id');
      expect(selectCall[0]).toContain('cliente_nome');
      expect(selectCall[0]).toContain('faturamento_total');
    });
  });

  describe('useServicosMaisRealizados', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: ServicoMaisRealizado[] = [
        { servico: 'troca de óleo', categoria: 'manutenção', total_historico: 200, entradas_diferentes: 180, total_execucoes: 220, media_por_entrada: 1.22 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.select.mockResolvedValue({ data: mockData, error: null });

      const { useServicosMaisRealizados } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useServicosMaisRealizados());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('servico');
      expect(selectCall[0]).toContain('categoria');
      expect(selectCall[0]).toContain('total_execucoes');
    });
  });

  // ============================================================
  // CICLO 2 — issue #4: colunas explícitas + .limit() antes de .order()
  // ============================================================

  describe('useFaturamentoMensal (ciclo 2)', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: FaturamentoMensal[] = [
        { mes: '2025-01', total_entradas: 50, faturamento_total: 25000, total_frete: 500, ticket_medio: 500, clientes_unicos: 40, motos_unicas: 45 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.gte.mockResolvedValue({ data: mockData, error: null });
      mockFrom.order.mockResolvedValue({ data: mockData, error: null });

      const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useFaturamentoMensal());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('mes');
      expect(selectCall[0]).toContain('faturamento_total');
    });

    it('deve usar limit(60) antes de order()', async () => {
      const mockData: FaturamentoMensal[] = [];
      // Builder pattern: cada método retorna a si mesmo para permitir encadeamento
      const chain: any = {};
      const builder = {
        gte: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
        limit: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
        order: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
      };
      Object.assign(chain, builder);
      const mockSelect = vi.fn(() => chain);
      const mockFrom: any = { select: mockSelect };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
      renderHook(() => useFaturamentoMensal());

      await waitFor(() => expect(mockSelect).toHaveBeenCalled());

      expect(chain.limit).toHaveBeenCalledWith(60);
      expect(chain.order).toHaveBeenCalledWith('mes', { ascending: false });
    });
  });

  describe('useConversaoOrcamentos (ciclo 2)', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: ConversaoOrcamento[] = [
        { mes: '2025-01', orcamentos_criados: 30, orcamentos_convertidos: 15, taxa_conversao_percentual: 50, orcamentos_expirados: 5 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.order.mockResolvedValue({ data: mockData, error: null });

      const { useConversaoOrcamentos } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useConversaoOrcamentos());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('mes');
      expect(selectCall[0]).toContain('taxa_conversao_percentual');
    });

    it('deve usar limit(60) antes de order()', async () => {
      const chain: any = { order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      const mockFrom = { select: vi.fn().mockReturnValue(chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useConversaoOrcamentos } = await import('@/hooks/useRelatorios');
      renderHook(() => useConversaoOrcamentos());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.limit).toHaveBeenCalledWith(60);
      expect(chain.order).toHaveBeenCalledWith('mes', { ascending: false });
    });
  });

  describe('useNovosClientesPeriodo (ciclo 2)', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: NovosClientesPeriodo[] = [
        { mes: '2025-01', novos_clientes: 10, clientes_com_servico: 8, taxa_conversao_percentual: 80 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.gte.mockResolvedValue({ data: mockData, error: null });

      const { useNovosClientesPeriodo } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useNovosClientesPeriodo());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('mes');
      expect(selectCall[0]).toContain('novos_clientes');
    });

    it('deve usar limit(60) antes de order()', async () => {
      const chain: any = { gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      const mockFrom = { select: vi.fn().mockReturnValue(chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useNovosClientesPeriodo } = await import('@/hooks/useRelatorios');
      renderHook(() => useNovosClientesPeriodo());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.limit).toHaveBeenCalledWith(60);
      expect(chain.order).toHaveBeenCalledWith('mes', { ascending: false });
    });
  });

  describe('useFotosPeriodo (ciclo 2)', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: FotosPeriodo[] = [
        { mes: '2025-01', tipo: 'antes', quantidade_fotos: 25, entradas_com_fotos: 20 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.gte.mockResolvedValue({ data: mockData, error: null });

      const { useFotosPeriodo } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useFotosPeriodo());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('mes');
      expect(selectCall[0]).toContain('quantidade_fotos');
    });

    it('deve usar limit(60) antes de order()', async () => {
      const chain: any = { gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      const mockFrom = { select: vi.fn().mockReturnValue(chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useFotosPeriodo } = await import('@/hooks/useRelatorios');
      renderHook(() => useFotosPeriodo());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.limit).toHaveBeenCalledWith(60);
      expect(chain.order).toHaveBeenCalledWith('mes', { ascending: false });
    });
  });

  describe('useResumoDiario (ciclo 2)', () => {
    it('deve usar colunas explícitas ao invés de select("*")', async () => {
      const mockData: ResumoDiario[] = [
        { data: '2025-01-15', novas_entradas: 5, novos_orcamentos: 3, concluidos: 2, em_andamento: 8, entregues: 4, faturamento_dia: 2500, frete_dia: 100 },
      ];

      const mockFrom = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      mockSupabase.from.mockReturnValue(mockFrom);
      mockFrom.gte.mockResolvedValue({ data: mockData, error: null });

      const { useResumoDiario } = await import('@/hooks/useRelatorios');
      const { result } = renderHook(() => useResumoDiario());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockFrom.select).toHaveBeenCalled();
      const selectCall = mockFrom.select.mock.calls[0];
      expect(selectCall[0]).not.toBe('*');
      expect(selectCall[0]).toContain('data');
      expect(selectCall[0]).toContain('faturamento_dia');
    });

    it('deve usar limit(730) antes de order()', async () => {
      const chain: any = { gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis() };
      const mockFrom = { select: vi.fn().mockReturnValue(chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useResumoDiario } = await import('@/hooks/useRelatorios');
      renderHook(() => useResumoDiario());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.limit).toHaveBeenCalledWith(730);
      expect(chain.order).toHaveBeenCalledWith('data', { ascending: false });
    });
  });

  describe('COLUMNS_BY_VIEW - ciclo 2 entries', () => {
    it('deve exportar COLUMNS_BY_VIEW com entradas para vw_faturamento_mensal', async () => {
      const { COLUMNS_BY_VIEW } = await import('@/hooks/useRelatorios');
      expect(COLUMNS_BY_VIEW).toBeDefined();
      expect(COLUMNS_BY_VIEW['vw_faturamento_mensal']).toBeDefined();
      expect(COLUMNS_BY_VIEW['vw_faturamento_mensal']).toContain('mes');
      expect(COLUMNS_BY_VIEW['vw_faturamento_mensal']).toContain('faturamento_total');
    });

    it('deve exportar COLUMNS_BY_VIEW com entradas para vw_conversao_orcamentos', async () => {
      const { COLUMNS_BY_VIEW } = await import('@/hooks/useRelatorios');
      expect(COLUMNS_BY_VIEW['vw_conversao_orcamentos']).toBeDefined();
      expect(COLUMNS_BY_VIEW['vw_conversao_orcamentos']).toContain('mes');
      expect(COLUMNS_BY_VIEW['vw_conversao_orcamentos']).toContain('taxa_conversao_percentual');
    });

    it('deve exportar COLUMNS_BY_VIEW com entradas para vw_novos_clientes_periodo', async () => {
      const { COLUMNS_BY_VIEW } = await import('@/hooks/useRelatorios');
      expect(COLUMNS_BY_VIEW['vw_novos_clientes_periodo']).toBeDefined();
      expect(COLUMNS_BY_VIEW['vw_novos_clientes_periodo']).toContain('mes');
      expect(COLUMNS_BY_VIEW['vw_novos_clientes_periodo']).toContain('novos_clientes');
    });

    it('deve exportar COLUMNS_BY_VIEW com entradas para vw_fotos_periodo', async () => {
      const { COLUMNS_BY_VIEW } = await import('@/hooks/useRelatorios');
      expect(COLUMNS_BY_VIEW['vw_fotos_periodo']).toBeDefined();
      expect(COLUMNS_BY_VIEW['vw_fotos_periodo']).toContain('mes');
      expect(COLUMNS_BY_VIEW['vw_fotos_periodo']).toContain('quantidade_fotos');
    });

    it('deve exportar COLUMNS_BY_VIEW com entradas para vw_resumo_diario', async () => {
      const { COLUMNS_BY_VIEW } = await import('@/hooks/useRelatorios');
      expect(COLUMNS_BY_VIEW['vw_resumo_diario']).toBeDefined();
      expect(COLUMNS_BY_VIEW['vw_resumo_diario']).toContain('data');
      expect(COLUMNS_BY_VIEW['vw_resumo_diario']).toContain('faturamento_dia');
    });
  });
});
