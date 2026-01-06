-- Tabela: historico_atividades
CREATE TABLE IF NOT EXISTS public.historico_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo TEXT NOT NULL CHECK (entidade_tipo IN ('entrada', 'orcamento', 'foto')),
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL,
  detalhes JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.historico_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_atividades DROP CONSTRAINT IF EXISTS historico_atividades_user_id_fkey;
ALTER TABLE public.historico_atividades ADD CONSTRAINT historico_atividades_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_historico_entidade ON public.historico_atividades(entidade_id, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_historico_criado_em ON public.historico_atividades(criado_em);

-- Políticas RLS (Segurança)
ALTER TABLE public.historico_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de historico_atividades" ON public.historico_atividades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de historico_atividades" ON public.historico_atividades
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em historico_atividades" ON public.historico_atividades
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em historico_atividades" ON public.historico_atividades
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_historico_atividades_criado_em_br ON public.historico_atividades(criado_em DESC);
