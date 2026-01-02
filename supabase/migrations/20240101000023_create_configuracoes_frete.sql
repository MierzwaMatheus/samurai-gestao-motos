-- Migration: Criar tabela configuracoes_frete
-- Descrição: Armazena configurações de frete (CEP origem e valor por km) por usuário

CREATE TABLE IF NOT EXISTS public.configuracoes_frete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cep_origem TEXT NOT NULL,
  valor_por_km NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE
);

-- Índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_configuracoes_frete_user_id ON public.configuracoes_frete(user_id);

-- Trigger para definir user_id automaticamente
CREATE TRIGGER set_configuracoes_frete_user_id
  BEFORE INSERT ON public.configuracoes_frete
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER update_configuracoes_frete_atualizado_em
  BEFORE UPDATE ON public.configuracoes_frete
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

-- RLS (Row Level Security)
ALTER TABLE public.configuracoes_frete ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só podem ver suas próprias configurações
CREATE POLICY "Usuários podem ver suas próprias configurações"
  ON public.configuracoes_frete
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem inserir suas próprias configurações
CREATE POLICY "Usuários podem inserir suas próprias configurações"
  ON public.configuracoes_frete
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar suas próprias configurações
CREATE POLICY "Usuários podem atualizar suas próprias configurações"
  ON public.configuracoes_frete
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar suas próprias configurações
CREATE POLICY "Usuários podem deletar suas próprias configurações"
  ON public.configuracoes_frete
  FOR DELETE
  USING (auth.uid() = user_id);

