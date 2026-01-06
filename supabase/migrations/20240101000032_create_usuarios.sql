-- Migration: Criar tabela usuarios
-- Descrição: Armazena informações dos usuários do sistema (nome, permissões, etc)
-- Esta tabela complementa auth.users do Supabase com dados adicionais

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  permissao TEXT NOT NULL DEFAULT 'usuario' CHECK (permissao IN ('admin', 'usuario')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_permissao ON public.usuarios(permissao);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON public.usuarios(ativo);
CREATE INDEX IF NOT EXISTS idx_usuarios_criado_por ON public.usuarios(criado_por);

-- Trigger para atualizar atualizado_em automaticamente
CREATE TRIGGER update_usuarios_atualizado_em
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

-- Comentários para documentação
COMMENT ON TABLE public.usuarios IS 'Tabela de usuários do sistema com informações adicionais';
COMMENT ON COLUMN public.usuarios.id IS 'ID do usuário (FK para auth.users)';
COMMENT ON COLUMN public.usuarios.nome IS 'Nome completo do usuário';
COMMENT ON COLUMN public.usuarios.email IS 'Email do usuário (deve corresponder ao email em auth.users)';
COMMENT ON COLUMN public.usuarios.permissao IS 'Permissão do usuário: admin ou usuario';
COMMENT ON COLUMN public.usuarios.ativo IS 'Indica se o usuário está ativo no sistema';
COMMENT ON COLUMN public.usuarios.criado_por IS 'ID do usuário que criou este registro (admin)';

