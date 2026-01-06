-- Migration: Adicionar final_numero_quadro às tabelas motos e entradas
-- Descrição: Garante que a coluna final_numero_quadro existe para armazenar os últimos dígitos do chassi

-- Adicionar na tabela motos (caso não tenha sido aplicado pela migração 15)
ALTER TABLE public.motos
  ADD COLUMN IF NOT EXISTS final_numero_quadro TEXT;

-- Adicionar na tabela entradas (faltando na migração 15)
ALTER TABLE public.entradas
  ADD COLUMN IF NOT EXISTS final_numero_quadro TEXT;

-- Notificar o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
