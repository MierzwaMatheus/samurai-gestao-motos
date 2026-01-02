-- Migration: Criar tabela fotos
-- Descrição: Armazena referências às fotos das motos

CREATE TABLE IF NOT EXISTS public.fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT DEFAULT 'moto' CHECK (tipo IN ('moto', 'status', 'documento')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_fotos_entrada_id ON public.fotos(entrada_id);
CREATE INDEX IF NOT EXISTS idx_fotos_user_id ON public.fotos(user_id);
CREATE INDEX IF NOT EXISTS idx_fotos_tipo ON public.fotos(tipo);

