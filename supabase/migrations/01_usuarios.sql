-- Tabela: usuarios
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

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_permissao ON public.usuarios(permissao);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON public.usuarios(ativo);
CREATE INDEX IF NOT EXISTS idx_usuarios_criado_por ON public.usuarios(criado_por);

-- Triggers
CREATE TRIGGER update_usuarios_atualizado_em
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

-- Comentários
COMMENT ON TABLE public.usuarios IS 'Tabela de usuários do sistema com informações adicionais';
COMMENT ON COLUMN public.usuarios.id IS 'ID do usuário (FK para auth.users)';
COMMENT ON COLUMN public.usuarios.nome IS 'Nome completo do usuário';
COMMENT ON COLUMN public.usuarios.email IS 'Email do usuário (deve corresponder ao email em auth.users)';
COMMENT ON COLUMN public.usuarios.permissao IS 'Permissão do usuário: admin ou usuario';
COMMENT ON COLUMN public.usuarios.ativo IS 'Indica se o usuário está ativo no sistema';
COMMENT ON COLUMN public.usuarios.criado_por IS 'ID do usuário que criou este registro (admin)';
COMMENT ON TABLE public.usuarios IS 'Para criar o primeiro admin: 1) Criar usuário no Auth, 2) Inserir registro na tabela usuarios com permissao=admin';

-- Políticas RLS (Segurança)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins podem ver usuários" ON public.usuarios
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Apenas admins podem deletar usuários" ON public.usuarios
  FOR DELETE USING (public.is_admin());

CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.usuarios
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins podem inserir usuários" ON public.usuarios
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins podem atualizar usuários" ON public.usuarios
  FOR UPDATE USING (public.is_admin());

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_usuarios_criado_em_br ON public.usuarios(criado_em DESC);
