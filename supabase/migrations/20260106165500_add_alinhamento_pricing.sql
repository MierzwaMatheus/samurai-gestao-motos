-- Migration to add support for 'alinhamento' service type with specific pricing

-- Add categoria column if it doesn't exist
ALTER TABLE public.tipos_servico 
ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'padrao';

-- Add pricing columns for alinhamento
ALTER TABLE public.tipos_servico 
ADD COLUMN IF NOT EXISTS preco_oficina_com_oleo numeric,
ADD COLUMN IF NOT EXISTS preco_oficina_sem_oleo numeric,
ADD COLUMN IF NOT EXISTS preco_particular_com_oleo numeric,
ADD COLUMN IF NOT EXISTS preco_particular_sem_oleo numeric;

-- Add check constraint for categoria
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'tipos_servico_categoria_check' AND conrelid = 'public.tipos_servico'::regclass
    ) THEN
        ALTER TABLE public.tipos_servico 
        ADD CONSTRAINT tipos_servico_categoria_check CHECK (categoria IN ('padrao', 'alinhamento'));
    END IF;
END $$;

-- Add com_oleo column to entradas_tipos_servico link table
ALTER TABLE public.entradas_tipos_servico
ADD COLUMN IF NOT EXISTS com_oleo boolean DEFAULT false;
