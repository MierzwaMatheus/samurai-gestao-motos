-- RLS: Row Level Security para tabela entradas
-- Descrição: Apenas usuários autenticados podem ver e alterar suas próprias entradas

-- Habilitar RLS
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver suas próprias entradas
CREATE POLICY "Usuários autenticados podem ver suas entradas"
  ON public.entradas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários autenticados podem inserir suas próprias entradas
CREATE POLICY "Usuários autenticados podem inserir suas entradas"
  ON public.entradas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem atualizar suas próprias entradas
CREATE POLICY "Usuários autenticados podem atualizar suas entradas"
  ON public.entradas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem deletar suas próprias entradas
CREATE POLICY "Usuários autenticados podem deletar suas entradas"
  ON public.entradas
  FOR DELETE
  USING (auth.uid() = user_id);

