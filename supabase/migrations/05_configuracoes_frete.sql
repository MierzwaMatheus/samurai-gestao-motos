-- =========================
-- Tabela: configuracoes_frete
-- =========================

CREATE TABLE IF NOT EXISTS public.configuracoes_frete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cep_origem TEXT NOT NULL,
  valor_por_km NUMERIC(10, 2) NOT NULL DEFAULT 2.00,

  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id UUID NOT NULL UNIQUE
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =========================
-- Segurança (RLS)
-- =========================

ALTER TABLE public.configuracoes_frete ENABLE ROW LEVEL SECURITY;

-- =========================
-- Índices
-- =========================

CREATE INDEX IF NOT EXISTS idx_configuracoes_frete_user_id
  ON public.configuracoes_frete(user_id);

CREATE INDEX IF NOT EXISTS idx_configuracoes_frete_criado_em_br
  ON public.configuracoes_frete(criado_em DESC);

-- =========================
-- Triggers
-- =========================

DROP TRIGGER IF EXISTS set_configuracoes_frete_user_id
ON public.configuracoes_frete;

CREATE TRIGGER set_configuracoes_frete_user_id
  BEFORE INSERT ON public.configuracoes_frete
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();


DROP TRIGGER IF EXISTS update_configuracoes_frete_atualizado_em
ON public.configuracoes_frete;

CREATE TRIGGER update_configuracoes_frete_atualizado_em
  BEFORE UPDATE ON public.configuracoes_frete
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();

-- =========================
-- Políticas RLS
-- =========================

DROP POLICY IF EXISTS "Usuários autenticados podem ler dados de configuracoes_frete"
ON public.configuracoes_frete;

CREATE POLICY "Usuários autenticados podem ler dados de configuracoes_frete"
  ON public.configuracoes_frete
  FOR SELECT
  TO authenticated
  USING (true);


DROP POLICY IF EXISTS "Usuários autenticados podem inserir dados em configuracoes_frete"
ON public.configuracoes_frete;

CREATE POLICY "Usuários autenticados podem inserir dados em configuracoes_frete"
  ON public.configuracoes_frete
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


DROP POLICY IF EXISTS "Usuários autenticados podem atualizar dados em configuracoes_frete"
ON public.configuracoes_frete;

CREATE POLICY "Usuários autenticados podem atualizar dados em configuracoes_frete"
  ON public.configuracoes_frete
  FOR UPDATE
  TO authenticated
  USING (true);


DROP POLICY IF EXISTS "Usuários autenticados podem deletar dados de configuracoes_frete"
ON public.configuracoes_frete;

CREATE POLICY "Usuários autenticados podem deletar dados de configuracoes_frete"
  ON public.configuracoes_frete
  FOR DELETE
  TO authenticated
  USING (true);
