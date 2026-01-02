-- RLS: Row Level Security para tabela clientes
-- Descrição: Apenas usuários autenticados podem ver e alterar seus próprios clientes

-- Habilitar RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver seus próprios clientes
CREATE POLICY "Usuários autenticados podem ver seus clientes"
  ON public.clientes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários autenticados podem inserir seus próprios clientes
CREATE POLICY "Usuários autenticados podem inserir seus clientes"
  ON public.clientes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem atualizar seus próprios clientes
CREATE POLICY "Usuários autenticados podem atualizar seus clientes"
  ON public.clientes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários autenticados podem deletar seus próprios clientes
CREATE POLICY "Usuários autenticados podem deletar seus clientes"
  ON public.clientes
  FOR DELETE
  USING (auth.uid() = user_id);

