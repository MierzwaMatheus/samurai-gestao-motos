-- Migration: Criar tabela tipos_servico
-- Descrição: Armazena os tipos de serviço disponíveis e contador de quantos serviços daquele tipo foram feitos

CREATE TABLE IF NOT EXISTS public.tipos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  quantidade_servicos INTEGER DEFAULT 0 NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  CONSTRAINT tipos_servico_nome_unique UNIQUE (nome, user_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_tipos_servico_user_id ON public.tipos_servico(user_id);
CREATE INDEX IF NOT EXISTS idx_tipos_servico_nome ON public.tipos_servico(nome);
CREATE INDEX IF NOT EXISTS idx_tipos_servico_criado_em ON public.tipos_servico(criado_em);

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER update_tipos_servico_atualizado_em
  BEFORE UPDATE ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();



