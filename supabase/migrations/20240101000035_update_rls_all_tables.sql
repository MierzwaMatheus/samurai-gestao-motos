-- Migration: Permitir que qualquer usuário ativo veja todos os dados
-- Descrição: Atualiza as políticas de SELECT para permitir acesso global a usuários autenticados e ativos

-- 1. Criar função auxiliar para verificar se o usuário está ativo
-- Esta função é SECURITY DEFINER para poder consultar a tabela usuarios independente das políticas de RLS
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.usuarios 
    WHERE id = auth.uid() 
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário para documentação
COMMENT ON FUNCTION public.is_active_user() IS 'Verifica se o usuário autenticado está ativo na tabela de usuários';

-- 2. Atualizar políticas da tabela clientes
DROP POLICY IF EXISTS "Usuários autenticados podem ver seus clientes" ON public.clientes;
CREATE POLICY "Usuários ativos podem ver todos os clientes"
  ON public.clientes FOR SELECT
  USING (public.is_active_user());

-- 3. Atualizar políticas da tabela motos
DROP POLICY IF EXISTS "Usuários autenticados podem ver suas motos" ON public.motos;
CREATE POLICY "Usuários ativos podem ver todas as motos"
  ON public.motos FOR SELECT
  USING (public.is_active_user());

-- 4. Atualizar políticas da tabela entradas
DROP POLICY IF EXISTS "Usuários autenticados podem ver suas entradas" ON public.entradas;
CREATE POLICY "Usuários ativos podem ver todas as entradas"
  ON public.entradas FOR SELECT
  USING (public.is_active_user());

-- 5. Atualizar políticas da tabela orcamentos
DROP POLICY IF EXISTS "Usuários autenticados podem ver seus orçamentos" ON public.orcamentos;
CREATE POLICY "Usuários ativos podem ver todos os orçamentos"
  ON public.orcamentos FOR SELECT
  USING (public.is_active_user());

-- 6. Atualizar políticas da tabela fotos
DROP POLICY IF EXISTS "Usuários autenticados podem ver suas fotos" ON public.fotos;
CREATE POLICY "Usuários ativos podem ver todas as fotos"
  ON public.fotos FOR SELECT
  USING (public.is_active_user());

-- 7. Atualizar políticas da tabela tipos_servico
DROP POLICY IF EXISTS "Usuários podem ver seus próprios tipos de serviço" ON public.tipos_servico;
CREATE POLICY "Usuários ativos podem ver todos os tipos de serviço"
  ON public.tipos_servico FOR SELECT
  USING (public.is_active_user());

-- 8. Atualizar políticas da tabela entradas_tipos_servico
DROP POLICY IF EXISTS "Usuários podem ver entradas_tipos_servico de suas entradas" ON public.entradas_tipos_servico;
CREATE POLICY "Usuários ativos podem ver todas as entradas_tipos_servico"
  ON public.entradas_tipos_servico FOR SELECT
  USING (public.is_active_user());

-- 9. Atualizar políticas da tabela configuracoes_frete
DROP POLICY IF EXISTS "Usuários podem ver suas próprias configurações" ON public.configuracoes_frete;
CREATE POLICY "Usuários ativos podem ver todas as configurações de frete"
  ON public.configuracoes_frete FOR SELECT
  USING (public.is_active_user());

-- 10. Atualizar políticas da tabela servicos_personalizados
DROP POLICY IF EXISTS "Usuários podem ver seus próprios serviços personalizados" ON public.servicos_personalizados;
CREATE POLICY "Usuários ativos podem ver todos os serviços personalizados"
  ON public.servicos_personalizados FOR SELECT
  USING (public.is_active_user());

-- 11. Atualizar políticas da tabela usuarios
-- Unificando para que qualquer usuário ativo veja todos os usuários
DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem ver todos os usuários" ON public.usuarios;
CREATE POLICY "Usuários ativos podem ver todos os usuários"
  ON public.usuarios FOR SELECT
  USING (public.is_active_user());

-- 12. Atualizar políticas de storage (bucket 'fotos')
-- Permitir que qualquer usuário ativo veja todas as fotos
DROP POLICY IF EXISTS "Usuários autenticados podem ver suas próprias fotos" ON storage.objects;
CREATE POLICY "Usuários ativos podem ver todas as fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'fotos' AND
  public.is_active_user()
);
