-- Migration: Adicionar coluna JSONB para fotos de status
-- Descrição: Armazena múltiplas fotos de status com informações (url, data, observação, progresso)

-- Adiciona coluna JSONB para fotos de status
ALTER TABLE public.entradas
  ADD COLUMN IF NOT EXISTS fotos_status JSONB DEFAULT '[]'::jsonb;

-- Cria índice GIN para busca eficiente em JSONB
CREATE INDEX IF NOT EXISTS idx_entradas_fotos_status ON public.entradas USING GIN (fotos_status);

-- Comentário explicativo
COMMENT ON COLUMN public.entradas.fotos_status IS 'Array JSONB com fotos de status. Formato: [{"url": "path/to/file", "data": "2024-01-01T00:00:00Z", "observacao": "texto", "progresso": 50}]';


