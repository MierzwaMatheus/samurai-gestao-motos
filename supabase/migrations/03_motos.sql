-- Tabela: motos
CREATE TABLE IF NOT EXISTS public.motos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  modelo TEXT NOT NULL,
  placa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

ALTER TABLE public.motos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motos ADD COLUMN IF NOT EXISTS final_numero_quadro TEXT;
ALTER TABLE public.motos ADD COLUMN IF NOT EXISTS final_numero_quadro TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_motos_cliente_id ON public.motos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_motos_user_id ON public.motos(user_id);
CREATE INDEX IF NOT EXISTS idx_motos_placa ON public.motos(placa);

-- Triggers
CREATE TRIGGER update_motos_atualizado_em
  BEFORE UPDATE ON public.motos
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER set_motos_user_id
  BEFORE INSERT ON public.motos
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- Políticas RLS (Segurança)
ALTER TABLE public.motos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de motos" ON public.motos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de motos" ON public.motos
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em motos" ON public.motos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em motos" ON public.motos
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_motos_criado_em_br ON public.motos(criado_em DESC);
