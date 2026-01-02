-- Migration: Criar tabela motos
-- Descrição: Armazena informações das motos dos clientes

CREATE TABLE IF NOT EXISTS public.motos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  modelo TEXT NOT NULL,
  placa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_motos_cliente_id ON public.motos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_motos_user_id ON public.motos(user_id);
CREATE INDEX IF NOT EXISTS idx_motos_placa ON public.motos(placa);

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER update_motos_atualizado_em
  BEFORE UPDATE ON public.motos
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

