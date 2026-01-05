-- Migration: Adicionar campo valor na tabela tipos_servico
-- Descrição: Cada tipo de serviço agora tem um valor padrão

ALTER TABLE public.tipos_servico
ADD COLUMN IF NOT EXISTS valor DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Atualizar valor para 0 se for NULL (para registros existentes)
UPDATE public.tipos_servico
SET valor = 0
WHERE valor IS NULL;

-- Adicionar constraint para garantir que valor não seja negativo
ALTER TABLE public.tipos_servico
ADD CONSTRAINT tipos_servico_valor_nao_negativo CHECK (valor >= 0);

