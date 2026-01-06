-- =========================
-- Tabela: tipos_servico
-- =========================

CREATE TABLE IF NOT EXISTS public.tipos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  quantidade_servicos INTEGER NOT NULL DEFAULT 0,

  preco_oficina DECIMAL(10, 2) NOT NULL DEFAULT 0,
  preco_particular DECIMAL(10, 2) NOT NULL DEFAULT 0,

  preco_oficina_com_oleo NUMERIC,
  preco_oficina_sem_oleo NUMERIC,
  preco_particular_com_oleo NUMERIC,
  preco_particular_sem_oleo NUMERIC,

  categoria TEXT NOT NULL DEFAULT 'padrao',

  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT tipos_servico_nome_unique UNIQUE (nome, user_id),
  CONSTRAINT tipos_servico_preco_oficina_nao_negativo CHECK (preco_oficina >= 0),
  CONSTRAINT tipos_servico_preco_particular_nao_negativo CHECK (preco_particular >= 0),
  CONSTRAINT tipos_servico_categoria_check CHECK (categoria IN ('padrao', 'alinhamento'))
);

-- =========================
-- Segurança (RLS)
-- =========================

ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;

-- =========================
-- Índices
-- =========================

CREATE INDEX IF NOT EXISTS idx_tipos_servico_user_id
  ON public.tipos_servico(user_id);

CREATE INDEX IF NOT EXISTS idx_tipos_servico_nome
  ON public.tipos_servico(nome);

CREATE INDEX IF NOT EXISTS idx_tipos_servico_criado_em
  ON public.tipos_servico(criado_em);

-- =========================
-- Triggers
-- =========================

DROP TRIGGER IF EXISTS set_tipos_servico_user_id
ON public.tipos_servico;

CREATE TRIGGER set_tipos_servico_user_id
  BEFORE INSERT ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();


DROP TRIGGER IF EXISTS update_tipos_servico_atualizado_em
ON public.tipos_servico;

CREATE TRIGGER update_tipos_servico_atualizado_em
  BEFORE UPDATE ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();


DROP TRIGGER IF EXISTS atualizar_valor_cobrado_ao_atualizar_tipo_servico
ON public.tipos_servico;

CREATE TRIGGER atualizar_valor_cobrado_ao_atualizar_tipo_servico
  AFTER UPDATE OF
    preco_oficina,
    preco_particular,
    preco_oficina_com_oleo,
    preco_oficina_sem_oleo,
    preco_particular_com_oleo,
    preco_particular_sem_oleo
  ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_cobrado_ao_atualizar_tipo_servico();

-- =========================
-- Políticas RLS
-- =========================

DROP POLICY IF EXISTS "Usuários autenticados podem ler dados de tipos_servico"
ON public.tipos_servico;

CREATE POLICY "Usuários autenticados podem ler dados de tipos_servico"
  ON public.tipos_servico
  FOR SELECT
  TO authenticated
  USING (true);


DROP POLICY IF EXISTS "Usuários autenticados podem inserir dados em tipos_servico"
ON public.tipos_servico;

CREATE POLICY "Usuários autenticados podem inserir dados em tipos_servico"
  ON public.tipos_servico
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


DROP POLICY IF EXISTS "Usuários autenticados podem atualizar dados em tipos_servico"
ON public.tipos_servico;

CREATE POLICY "Usuários autenticados podem atualizar dados em tipos_servico"
  ON public.tipos_servico
  FOR UPDATE
  TO authenticated
  USING (true);


DROP POLICY IF EXISTS "Usuários autenticados podem deletar dados de tipos_servico"
ON public.tipos_servico;

CREATE POLICY "Usuários autenticados podem deletar dados de tipos_servico"
  ON public.tipos_servico
  FOR DELETE
  TO authenticated
  USING (true);
