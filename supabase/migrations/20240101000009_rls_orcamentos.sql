-- RLS: Row Level Security para tabela orcamentos
-- Descrição: Apenas usuários autenticados podem ver e alterar seus próprios orçamentos

-- Habilitar RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver seus próprios orçamentos
CREATE POLICY "Usuários autenticados podem ver seus orçamentos"
  ON public.orcamentos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários autenticados podem inserir seus próprios orçamentos
CREATE POLICY "Usuários autenticados podem inserir seus orçamentos"
  ON public.orcamentos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem atualizar seus próprios orçamentos
CREATE POLICY "Usuários autenticados podem atualizar seus orçamentos"
  ON public.orcamentos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem deletar seus próprios orçamentos
CREATE POLICY "Usuários autenticados podem deletar seus orçamentos"
  ON public.orcamentos
  FOR DELETE
  USING (auth.uid() = user_id);

