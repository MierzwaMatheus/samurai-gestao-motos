-- Migration: Adicionar campos faltantes nas tabelas
-- Descrição: Adiciona campos para telefone, valor cobrado, datas e status de entrega

-- Adicionar colunas na tabela motos
ALTER TABLE public.motos
  ADD COLUMN IF NOT EXISTS final_numero_quadro TEXT;

-- Adicionar colunas na tabela entradas
ALTER TABLE public.entradas
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS valor_cobrado DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS data_orcamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_entrega TEXT DEFAULT 'pendente' CHECK (status_entrega IN ('pendente', 'entregue', 'retirado')),
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS os_assinada_url TEXT;

-- Adicionar índice para busca por data
CREATE INDEX IF NOT EXISTS idx_entradas_data_entrada ON public.entradas(data_entrada);
CREATE INDEX IF NOT EXISTS idx_entradas_data_entrega ON public.entradas(data_entrega);
CREATE INDEX IF NOT EXISTS idx_entradas_status_entrega ON public.entradas(status_entrega);

