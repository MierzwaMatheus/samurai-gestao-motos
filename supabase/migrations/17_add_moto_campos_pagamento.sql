-- Adicionar campos de detalhes da moto e dados de pagamento/conclusao

-- Motos: marca, ano, cilindrada
ALTER TABLE public.motos
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS ano TEXT,
  ADD COLUMN IF NOT EXISTS cilindrada TEXT;

-- Entradas: data de conclusao e forma de pagamento
ALTER TABLE public.entradas
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT CHECK (forma_pagamento IN ('pix', 'credito', 'debito', 'boleto'));

COMMENT ON COLUMN public.motos.marca IS 'Marca da moto';
COMMENT ON COLUMN public.motos.ano IS 'Ano da moto (texto para flexibilidade)';
COMMENT ON COLUMN public.motos.cilindrada IS 'Cilindrada da moto';
COMMENT ON COLUMN public.entradas.data_conclusao IS 'Data de conclusao do servico';
COMMENT ON COLUMN public.entradas.forma_pagamento IS 'Forma de pagamento: pix, credito, debito, boleto';
