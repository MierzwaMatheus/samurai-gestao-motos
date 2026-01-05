-- Migration: Adicionar campo quantidade na tabela entradas_tipos_servico
-- Descrição: Permite especificar a quantidade de cada tipo de serviço em uma entrada

ALTER TABLE public.entradas_tipos_servico
ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;

-- Atualizar quantidade para 1 se for NULL (para registros existentes)
UPDATE public.entradas_tipos_servico
SET quantidade = 1
WHERE quantidade IS NULL;

-- Adicionar constraint para garantir que quantidade seja positiva
ALTER TABLE public.entradas_tipos_servico
ADD CONSTRAINT entradas_tipos_servico_quantidade_positiva CHECK (quantidade > 0);

-- Remover constraint de unique que não permite múltiplas quantidades do mesmo serviço
-- Agora permitimos múltiplas linhas com o mesmo tipo_servico_id mas com quantidades diferentes
-- Na verdade, vamos manter a constraint unique mas permitir múltiplas linhas se necessário
-- Vamos remover a constraint unique e criar uma nova que permite múltiplas linhas
ALTER TABLE public.entradas_tipos_servico
DROP CONSTRAINT IF EXISTS entradas_tipos_servico_unique;

-- Criar nova constraint que permite múltiplas linhas do mesmo serviço
-- Mas na prática, vamos manter uma linha por entrada_id + tipo_servico_id e apenas atualizar a quantidade
-- Então vamos recriar a constraint unique
ALTER TABLE public.entradas_tipos_servico
ADD CONSTRAINT entradas_tipos_servico_unique UNIQUE (entrada_id, tipo_servico_id);

