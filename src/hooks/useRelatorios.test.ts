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

    it('deve ordenar por quantidade descendente', async () => {
      const mockData: StatusEntrada[] = [];
      const chain: any = {};
      const builder = {
        order: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
      };
      Object.assign(chain, builder);
      const mockFrom: any = { select: vi.fn(() => chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useStatusEntradas } = await import('@/hooks/useRelatorios');
      renderHook(() => useStatusEntradas());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.order).toHaveBeenCalledWith('quantidade', { ascending: false });
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

    it('deve ordenar por quantidade descendente', async () => {
      const mockData: StatusEntrega[] = [];
      const chain: any = {};
      const builder = {
        order: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
      };
      Object.assign(chain, builder);
      const mockFrom: any = { select: vi.fn(() => chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useStatusEntrega } = await import('@/hooks/useRelatorios');
      renderHook(() => useStatusEntrega());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.order).toHaveBeenCalledWith('quantidade', { ascending: false });
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

    it('deve ordenar por faturamento_categoria descendente', async () => {
      const mockData: DistribuicaoCategoria[] = [];
      const chain: any = {};
      const builder = {
        order: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
      };
      Object.assign(chain, builder);
      const mockFrom: any = { select: vi.fn(() => chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useDistribuicaoCategoria } = await import('@/hooks/useRelatorios');
      renderHook(() => useDistribuicaoCategoria());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.order).toHaveBeenCalledWith('faturamento_categoria', { ascending: false });
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

    it('deve ordenar por faturamento_total descendente', async () => {
      const mockData: FaturamentoPorServico[] = [];
      const chain: any = {};
      const builder = {
        order: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
        limit: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
      };
      Object.assign(chain, builder);
      const mockFrom: any = { select: vi.fn(() => chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useFaturamentoPorServico } = await import('@/hooks/useRelatorios');
      renderHook(() => useFaturamentoPorServico());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.order).toHaveBeenCalledWith('faturamento_total', { ascending: false });
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

    it('deve ordenar por faturamento_total descendente', async () => {
      const mockData: TopCliente[] = [];
      const chain: any = {};
      const builder = {
        order: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
        limit: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
      };
      Object.assign(chain, builder);
      const mockFrom: any = { select: vi.fn(() => chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useTopClientes } = await import('@/hooks/useRelatorios');
      renderHook(() => useTopClientes());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.order).toHaveBeenCalledWith('faturamento_total', { ascending: false });
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

    it('deve ordenar por total_execucoes descendente', async () => {
      const mockData: ServicoMaisRealizado[] = [];
      const chain: any = {};
      const builder = {
        order: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
        limit: vi.fn(function(this: any) { Object.assign(chain, builder); return chain; }),
      };
      Object.assign(chain, builder);
      const mockFrom: any = { select: vi.fn(() => chain) };
      mockSupabase.from.mockReturnValue(mockFrom);

      const { useServicosMaisRealizados } = await import('@/hooks/useRelatorios');
      renderHook(() => useServicosMaisRealizados());

      await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

      expect(chain.order).toHaveBeenCalledWith('total_execucoes', { ascending: false });
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

// ============================================================
// CICLO 3 — Mutation Testing: mata sobreviventes CRÍTICOS/ALTOS
// ============================================================

describe('useRelatorios - error/loading/deps behavior (mutation gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- isLoading inicial deve ser true (BooleanLiteral linha 45) ---
  it('deve iniciar com isLoading=true antes da primeira fetch completar', async () => {
    const neverResolved = new Promise(() => {});
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => chain),
    };
    Object.defineProperty(chain, 'then', {
      get() {
        return (_onFul: any, _onRej: any) => neverResolved;
      },
    });
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    const { result } = renderHook(() => useFaturamentoMensal());

    expect(result.current.isLoading).toBe(true);
  });

  // --- catch block deve capturar erro do supabase (BlockStatement linha 56, ConditionalExpression linha 54) ---
  it('deve capturar erro do supabase no catch e setar error state', async () => {
    const supabaseError = new Error('Falha de conexão');
    let rejectQuery: (err: Error) => void = () => {};
    const queryPromise = new Promise<{ data: any; error: any }>((_, reject) => {
      rejectQuery = (err) => reject(err);
    });
    const chain: any = {
      gte: vi.fn(function(this: any) { return chain; }),
      limit: vi.fn(function(this: any) { return chain; }),
      order: vi.fn(function(this: any) { return chain; }),
      then: queryPromise.then.bind(queryPromise),
      catch: queryPromise.catch.bind(queryPromise),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    const { result } = renderHook(() => useFaturamentoMensal());

    await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());
    rejectQuery(supabaseError);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Falha de conexão');
    expect(result.current.data).toBeNull();
  });

  it('deve capturar erro retornado em { error } e setar error state', async () => {
    const queryPromise = Promise.resolve({ data: null, error: { message: 'Erro RPC' } });
    const chain: any = {
      gte: vi.fn(function(this: any) { return chain; }),
      limit: vi.fn(function(this: any) { return chain; }),
      order: vi.fn(function(this: any) { return chain; }),
      then: queryPromise.then.bind(queryPromise),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    const { result } = renderHook(() => useFaturamentoMensal());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).not.toBeNull();
  });

  // --- finally block deve sempre setar isLoading=false (BlockStatement linha 56) ---
  it('deve setar isLoading=false mesmo quando há erro', async () => {
    let rejectQuery: (err: Error) => void = () => {};
    const queryPromise = new Promise<{ data: any; error: any }>((_, reject) => {
      rejectQuery = (err) => reject(err);
    });
    const chain: any = {
      gte: vi.fn(function(this: any) { return chain; }),
      limit: vi.fn(function(this: any) { return chain; }),
      order: vi.fn(function(this: any) { return chain; }),
      then: queryPromise.then.bind(queryPromise),
      catch: queryPromise.catch.bind(queryPromise),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    const { result } = renderHook(() => useFaturamentoMensal());

    await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());
    rejectQuery(new Error('boom'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  // --- deps [periodo] deve re-trigger fetch quando periodo muda (ArrayDeclaration linhas 81, 122, 155, 188, 203) ---
  it('deve re-executar fetch quando periodo muda em useFaturamentoMensal', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    const { rerender } = renderHook(({ p }) => useFaturamentoMensal(p), {
      initialProps: { p: '12m' as const },
    });

    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(1));

    rerender({ p: '7d' as const });
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(2));

    rerender({ p: '30d' as const });
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(3));
  });

  it('deve re-executar fetch quando periodo muda em useNovosClientesPeriodo', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useNovosClientesPeriodo } = await import('@/hooks/useRelatorios');
    const { rerender } = renderHook(({ p }) => useNovosClientesPeriodo(p), {
      initialProps: { p: '12m' as const },
    });

    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(1));

    rerender({ p: 'tudo' as const });
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(2));
  });

  it('deve re-executar fetch quando periodo muda em useConversaoOrcamentos', async () => {
    const chain: any = {
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useConversaoOrcamentos } = await import('@/hooks/useRelatorios');
    const { rerender } = renderHook(({ p }) => useConversaoOrcamentos(p), {
      initialProps: { p: '12m' as const },
    });

    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(1));

    rerender({ p: '7d' as const });
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(2));
  });

  it('deve re-executar fetch quando periodo muda em useResumoDiario', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useResumoDiario } = await import('@/hooks/useRelatorios');
    const { rerender } = renderHook(({ p }) => useResumoDiario(p), {
      initialProps: { p: '90d' as const },
    });

    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(1));

    rerender({ p: '30d' as const });
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(2));
  });

  it('deve re-executar fetch quando periodo muda em useFotosPeriodo', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useFotosPeriodo } = await import('@/hooks/useRelatorios');
    const { rerender } = renderHook(({ p }) => useFotosPeriodo(p), {
      initialProps: { p: '12m' as const },
    });

    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(1));

    rerender({ p: 'tudo' as const });
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalledTimes(2));
  });
});

describe('useRelatorios - getIntervaloSql boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- getIntervaloSql para '7d' deve ser ~7 dias atrás (linhas 211-212) ---
  it('deve calcular intervalo de 7 dias a partir de agora', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const before = Date.now();
    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    renderHook(() => useFaturamentoMensal('7d'));
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());
    const after = Date.now();

    const gteArg = chain.gte.mock.calls[0][1] as string;
    const gteTime = new Date(gteArg).getTime();

    // esperado: ~7 dias atrás (margem de 200ms)
    expect(gteTime).toBeGreaterThanOrEqual(before - 7 * 24 * 60 * 60 * 1000 - 200);
    expect(gteTime).toBeLessThanOrEqual(after - 7 * 24 * 60 * 60 * 1000 + 200);
  });

  // --- getIntervaloSql para '30d' deve ser ~30 dias atrás (linhas 213-214) ---
  it('deve calcular intervalo de 30 dias a partir de agora', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const before = Date.now();
    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    renderHook(() => useFaturamentoMensal('30d'));
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());
    const after = Date.now();

    const gteArg = chain.gte.mock.calls[0][1] as string;
    const gteTime = new Date(gteArg).getTime();

    expect(gteTime).toBeGreaterThanOrEqual(before - 30 * 24 * 60 * 60 * 1000 - 200);
    expect(gteTime).toBeLessThanOrEqual(after - 30 * 24 * 60 * 60 * 1000 + 200);
  });

  // --- getIntervaloSql para '90d' deve ser ~90 dias atrás (linhas 215-216) ---
  it('deve calcular intervalo de 90 dias a partir de agora', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const before = Date.now();
    const { useResumoDiario } = await import('@/hooks/useRelatorios');
    renderHook(() => useResumoDiario('90d'));
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());
    const after = Date.now();

    const gteArg = chain.gte.mock.calls[0][1] as string;
    const gteTime = new Date(gteArg).getTime();

    expect(gteTime).toBeGreaterThanOrEqual(before - 90 * 24 * 60 * 60 * 1000 - 200);
    expect(gteTime).toBeLessThanOrEqual(after - 90 * 24 * 60 * 60 * 1000 + 200);
  });

  // --- getIntervaloSql para '12m' deve ser ~1 ano atrás (linhas 217-218) ---
  it('deve calcular intervalo de 12 meses (1 ano) a partir de agora', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const before = new Date();
    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    renderHook(() => useFaturamentoMensal('12m'));
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());
    const after = new Date();

    const gteArg = chain.gte.mock.calls[0][1] as string;
    const gteTime = new Date(gteArg);

    const beforeYearAgo = new Date(before);
    beforeYearAgo.setFullYear(beforeYearAgo.getFullYear() - 1);
    const afterYearAgo = new Date(after);
    afterYearAgo.setFullYear(afterYearAgo.getFullYear() - 1);

    expect(gteTime.getTime()).toBeGreaterThanOrEqual(beforeYearAgo.getTime() - 1000);
    expect(gteTime.getTime()).toBeLessThanOrEqual(afterYearAgo.getTime() + 1000);

    expect(gteTime.getFullYear()).toBe(before.getFullYear() - 1);
  });

  // --- getIntervaloSql para 'tudo' deve ser '2000-01-01' (linha 219) ---
  it('deve retornar sentinela 2000-01-01 quando periodo=tudo', async () => {
    const chain: any = {
      gte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    const mockFrom: any = { select: vi.fn(() => chain) };
    mockSupabase.from.mockReturnValue(mockFrom);

    const { useFaturamentoMensal } = await import('@/hooks/useRelatorios');
    renderHook(() => useFaturamentoMensal('tudo'));
    await waitFor(() => expect(mockFrom.select).toHaveBeenCalled());

    const gteArg = chain.gte.mock.calls[0][1] as string;
    expect(gteArg).toBe('2000-01-01T00:00:00.000Z');
  });
});
