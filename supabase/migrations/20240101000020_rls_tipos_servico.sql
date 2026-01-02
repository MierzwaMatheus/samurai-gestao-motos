-- Migration: RLS para tipos_servico e entradas_tipos_servico
-- Descrição: Políticas de segurança para tipos de serviço

-- Habilitar RLS
ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas_tipos_servico ENABLE ROW LEVEL SECURITY;

-- Políticas para tipos_servico
-- Usuários podem ver apenas seus próprios tipos de serviço
CREATE POLICY "Usuários podem ver seus próprios tipos de serviço"
  ON public.tipos_servico
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários podem criar seus próprios tipos de serviço
CREATE POLICY "Usuários podem criar seus próprios tipos de serviço"
  ON public.tipos_servico
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios tipos de serviço
CREATE POLICY "Usuários podem atualizar seus próprios tipos de serviço"
  ON public.tipos_servico
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem deletar seus próprios tipos de serviço
CREATE POLICY "Usuários podem deletar seus próprios tipos de serviço"
  ON public.tipos_servico
  FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para entradas_tipos_servico
-- Usuários podem ver apenas entradas_tipos_servico de suas entradas
CREATE POLICY "Usuários podem ver entradas_tipos_servico de suas entradas"
  ON public.entradas_tipos_servico
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.entradas
      WHERE entradas.id = entradas_tipos_servico.entrada_id
      AND entradas.user_id = auth.uid()
    )
  );

-- Usuários podem criar entradas_tipos_servico para suas entradas
CREATE POLICY "Usuários podem criar entradas_tipos_servico para suas entradas"
  ON public.entradas_tipos_servico
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.entradas
      WHERE entradas.id = entradas_tipos_servico.entrada_id
      AND entradas.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.tipos_servico
      WHERE tipos_servico.id = entradas_tipos_servico.tipo_servico_id
      AND tipos_servico.user_id = auth.uid()
    )
  );

-- Usuários podem deletar entradas_tipos_servico de suas entradas
CREATE POLICY "Usuários podem deletar entradas_tipos_servico de suas entradas"
  ON public.entradas_tipos_servico
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.entradas
      WHERE entradas.id = entradas_tipos_servico.entrada_id
      AND entradas.user_id = auth.uid()
    )
  );

