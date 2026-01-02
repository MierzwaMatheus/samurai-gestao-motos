-- Migration: Criar tabela entradas
-- Descrição: Armazena entradas de motos na oficina (entrada ou orçamento)

CREATE TABLE IF NOT EXISTS public.entradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'orcamento')),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  moto_id UUID REFERENCES public.motos(id) ON DELETE CASCADE NOT NULL,
  endereco TEXT,
  cep TEXT,
  frete DECIMAL(10, 2) DEFAULT 0,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'alinhando', 'concluido')),
  progresso INTEGER DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_entradas_cliente_id ON public.entradas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_entradas_moto_id ON public.entradas(moto_id);
CREATE INDEX IF NOT EXISTS idx_entradas_user_id ON public.entradas(user_id);
CREATE INDEX IF NOT EXISTS idx_entradas_tipo ON public.entradas(tipo);
CREATE INDEX IF NOT EXISTS idx_entradas_status ON public.entradas(status);
CREATE INDEX IF NOT EXISTS idx_entradas_criado_em ON public.entradas(criado_em);

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER update_entradas_atualizado_em
  BEFORE UPDATE ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

