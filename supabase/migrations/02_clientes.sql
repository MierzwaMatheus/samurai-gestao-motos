-- Tabela: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  cep TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ADD COLUMN numero_servicos INTEGER DEFAULT 0 NOT NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON public.clientes(telefone);

-- Triggers
CREATE TRIGGER update_clientes_atualizado_em
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER set_clientes_user_id
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- Políticas RLS (Segurança)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de clientes" ON public.clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de clientes" ON public.clientes
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em clientes" ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em clientes" ON public.clientes
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_clientes_criado_em_br ON public.clientes(criado_em DESC);
