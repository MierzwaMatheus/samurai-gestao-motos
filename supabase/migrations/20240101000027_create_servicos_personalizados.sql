-- Migration: Criar tabela servicos_personalizados
-- Descrição: Armazena serviços personalizados que não são salvos na tabela tipos_servico
-- Estes serviços são específicos para uma entrada/orçamento e não são reutilizáveis

CREATE TABLE IF NOT EXISTS public.servicos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  CONSTRAINT servicos_personalizados_valor_nao_negativo CHECK (valor >= 0),
  CONSTRAINT servicos_personalizados_quantidade_positiva CHECK (quantidade > 0)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_servicos_personalizados_entrada_id ON public.servicos_personalizados(entrada_id);
CREATE INDEX IF NOT EXISTS idx_servicos_personalizados_user_id ON public.servicos_personalizados(user_id);

-- RLS (Row Level Security) para servicos_personalizados
ALTER TABLE public.servicos_personalizados ENABLE ROW LEVEL SECURITY;

-- Política: usuários só podem ver seus próprios serviços personalizados
CREATE POLICY "Usuários podem ver seus próprios serviços personalizados"
  ON public.servicos_personalizados
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuários só podem criar serviços personalizados para suas próprias entradas
-- O user_id será definido automaticamente pelo trigger, então só verificamos se a entrada pertence ao usuário
CREATE POLICY "Usuários podem criar serviços personalizados para suas entradas"
  ON public.servicos_personalizados
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.entradas
      WHERE entradas.id = servicos_personalizados.entrada_id
      AND entradas.user_id = auth.uid()
    )
  );

-- Política: usuários só podem atualizar seus próprios serviços personalizados
CREATE POLICY "Usuários podem atualizar seus próprios serviços personalizados"
  ON public.servicos_personalizados
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: usuários só podem deletar seus próprios serviços personalizados
CREATE POLICY "Usuários podem deletar seus próprios serviços personalizados"
  ON public.servicos_personalizados
  FOR DELETE
  USING (auth.uid() = user_id);

