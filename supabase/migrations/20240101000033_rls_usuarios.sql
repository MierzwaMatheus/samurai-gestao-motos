-- Migration: RLS para tabela usuarios
-- Descrição: Políticas de segurança para controle de acesso à tabela usuarios

-- Habilitar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se o usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.usuarios 
    WHERE id = auth.uid() 
    AND permissao = 'admin' 
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Política: Usuários podem ver seus próprios dados
CREATE POLICY "Usuários podem ver seus próprios dados"
  ON public.usuarios
  FOR SELECT
  USING (auth.uid() = id);

-- Política: Admins podem ver todos os usuários
CREATE POLICY "Admins podem ver todos os usuários"
  ON public.usuarios
  FOR SELECT
  USING (public.is_admin());

-- Política: Admins podem inserir novos usuários
CREATE POLICY "Admins podem inserir novos usuários"
  ON public.usuarios
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Política: Admins podem atualizar qualquer usuário
CREATE POLICY "Admins podem atualizar qualquer usuário"
  ON public.usuarios
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Política: Admins podem deletar usuários (desativar ao invés de deletar)
CREATE POLICY "Admins podem deletar usuários"
  ON public.usuarios
  FOR DELETE
  USING (public.is_admin());

-- Comentários para documentação
COMMENT ON FUNCTION public.is_admin() IS 'Verifica se o usuário autenticado é admin';

