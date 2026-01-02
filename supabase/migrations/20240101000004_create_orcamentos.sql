-- Migration: Criar tabela orcamentos
-- Descrição: Armazena informações detalhadas dos orçamentos

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data_expiracao TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'expirado', 'convertido')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_entrada_id ON public.orcamentos(entrada_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON public.orcamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_data_expiracao ON public.orcamentos(data_expiracao);

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER update_orcamentos_atualizado_em
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

-- Função para atualizar status de orçamentos expirados
CREATE OR REPLACE FUNCTION atualizar_orcamentos_expirados()
RETURNS void AS $$
BEGIN
  UPDATE public.orcamentos
  SET status = 'expirado'
  WHERE status = 'ativo'
    AND data_expiracao < NOW();
END;
$$ LANGUAGE plpgsql;

