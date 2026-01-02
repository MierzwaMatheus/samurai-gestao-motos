-- RLS: Row Level Security para tabela fotos
-- Descrição: Apenas usuários autenticados podem ver e alterar suas próprias fotos

-- Habilitar RLS
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver suas próprias fotos
CREATE POLICY "Usuários autenticados podem ver suas fotos"
  ON public.fotos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários autenticados podem inserir suas próprias fotos
CREATE POLICY "Usuários autenticados podem inserir suas fotos"
  ON public.fotos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem atualizar suas próprias fotos
CREATE POLICY "Usuários autenticados podem atualizar suas fotos"
  ON public.fotos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem deletar suas próprias fotos
CREATE POLICY "Usuários autenticados podem deletar suas fotos"
  ON public.fotos
  FOR DELETE
  USING (auth.uid() = user_id);

