-- RLS: Row Level Security para tabela motos
-- Descrição: Apenas usuários autenticados podem ver e alterar suas próprias motos

-- Habilitar RLS
ALTER TABLE public.motos ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver suas próprias motos
CREATE POLICY "Usuários autenticados podem ver suas motos"
  ON public.motos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários autenticados podem inserir suas próprias motos
CREATE POLICY "Usuários autenticados podem inserir suas motos"
  ON public.motos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem atualizar suas próprias motos
CREATE POLICY "Usuários autenticados podem atualizar suas motos"
  ON public.motos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem deletar suas próprias motos
CREATE POLICY "Usuários autenticados podem deletar suas motos"
  ON public.motos
  FOR DELETE
  USING (auth.uid() = user_id);

