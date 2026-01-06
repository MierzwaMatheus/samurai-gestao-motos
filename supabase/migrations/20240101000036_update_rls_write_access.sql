-- Migration: Permitir que qualquer usuário ativo gerencie todos os dados
-- Descrição: Atualiza as políticas de INSERT, UPDATE e DELETE para permitir gerenciamento global a usuários autenticados e ativos

-- 1. Atualizar políticas da tabela clientes
DROP POLICY IF EXISTS "Usuários autenticados podem inserir seus clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar seus clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar seus clientes" ON public.clientes;

CREATE POLICY "Usuários ativos podem inserir clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todos os clientes"
  ON public.clientes FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todos os clientes"
  ON public.clientes FOR DELETE
  USING (public.is_active_user());

-- 2. Atualizar políticas da tabela motos
DROP POLICY IF EXISTS "Usuários autenticados podem inserir suas motos" ON public.motos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar suas motos" ON public.motos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas motos" ON public.motos;

CREATE POLICY "Usuários ativos podem inserir motos"
  ON public.motos FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todas as motos"
  ON public.motos FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todas as motos"
  ON public.motos FOR DELETE
  USING (public.is_active_user());

-- 3. Atualizar políticas da tabela entradas
DROP POLICY IF EXISTS "Usuários autenticados podem inserir suas entradas" ON public.entradas;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar suas entradas" ON public.entradas;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas entradas" ON public.entradas;

CREATE POLICY "Usuários ativos podem inserir entradas"
  ON public.entradas FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todas as entradas"
  ON public.entradas FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todas as entradas"
  ON public.entradas FOR DELETE
  USING (public.is_active_user());

-- 4. Atualizar políticas da tabela orcamentos
DROP POLICY IF EXISTS "Usuários autenticados podem inserir seus orçamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar seus orçamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar seus orçamentos" ON public.orcamentos;

CREATE POLICY "Usuários ativos podem inserir orçamentos"
  ON public.orcamentos FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todos os orçamentos"
  ON public.orcamentos FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todos os orçamentos"
  ON public.orcamentos FOR DELETE
  USING (public.is_active_user());

-- 5. Atualizar políticas da tabela fotos
DROP POLICY IF EXISTS "Usuários autenticados podem inserir suas fotos" ON public.fotos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar suas fotos" ON public.fotos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas fotos" ON public.fotos;

CREATE POLICY "Usuários ativos podem inserir fotos"
  ON public.fotos FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todas as fotos"
  ON public.fotos FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todas as fotos"
  ON public.fotos FOR DELETE
  USING (public.is_active_user());

-- 6. Atualizar políticas da tabela tipos_servico
DROP POLICY IF EXISTS "Usuários podem criar seus próprios tipos de serviço" ON public.tipos_servico;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios tipos de serviço" ON public.tipos_servico;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios tipos de serviço" ON public.tipos_servico;

CREATE POLICY "Usuários ativos podem criar tipos de serviço"
  ON public.tipos_servico FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todos os tipos de serviço"
  ON public.tipos_servico FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todos os tipos de serviço"
  ON public.tipos_servico FOR DELETE
  USING (public.is_active_user());

-- 7. Atualizar políticas da tabela entradas_tipos_servico
DROP POLICY IF EXISTS "Usuários podem criar entradas_tipos_servico para suas entradas" ON public.entradas_tipos_servico;
DROP POLICY IF EXISTS "Usuários podem deletar entradas_tipos_servico de suas entradas" ON public.entradas_tipos_servico;

CREATE POLICY "Usuários ativos podem criar entradas_tipos_servico"
  ON public.entradas_tipos_servico FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todas as entradas_tipos_servico"
  ON public.entradas_tipos_servico FOR DELETE
  USING (public.is_active_user());

-- 8. Atualizar políticas da tabela configuracoes_frete
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias configurações" ON public.configuracoes_frete;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias configurações" ON public.configuracoes_frete;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias configurações" ON public.configuracoes_frete;

CREATE POLICY "Usuários ativos podem inserir configurações de frete"
  ON public.configuracoes_frete FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todas as configurações de frete"
  ON public.configuracoes_frete FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todas as configurações de frete"
  ON public.configuracoes_frete FOR DELETE
  USING (public.is_active_user());

-- 9. Atualizar políticas da tabela servicos_personalizados
DROP POLICY IF EXISTS "Usuários podem criar serviços personalizados para suas entradas" ON public.servicos_personalizados;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios serviços personalizados" ON public.servicos_personalizados;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios serviços personalizados" ON public.servicos_personalizados;

CREATE POLICY "Usuários ativos podem criar serviços personalizados"
  ON public.servicos_personalizados FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem atualizar todos os serviços personalizados"
  ON public.servicos_personalizados FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Usuários ativos podem deletar todos os serviços personalizados"
  ON public.servicos_personalizados FOR DELETE
  USING (public.is_active_user());

-- 10. Atualizar políticas de storage (bucket 'fotos')
-- Permitir que qualquer usuário ativo gerencie todas as fotos
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar suas próprias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas próprias fotos" ON storage.objects;

CREATE POLICY "Usuários ativos podem fazer upload de fotos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos' AND
  public.is_active_user()
);

CREATE POLICY "Usuários ativos podem atualizar todas as fotos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fotos' AND
  public.is_active_user()
)
WITH CHECK (
  bucket_id = 'fotos' AND
  public.is_active_user()
);

CREATE POLICY "Usuários ativos podem deletar todas as fotos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fotos' AND
  public.is_active_user()
);
