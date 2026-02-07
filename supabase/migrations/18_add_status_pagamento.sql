-- Adicionar campos de status do pagamento
-- Permite controlar se o pagamento está pendente ou pago

ALTER TABLE public.entradas
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT CHECK (status_pagamento IN ('pendente', 'pago')),
  ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ;

COMMENT ON COLUMN public.entradas.status_pagamento IS 'Status do pagamento: pendente ou pago';
COMMENT ON COLUMN public.entradas.data_pagamento IS 'Data e hora em que o pagamento foi realizado';
