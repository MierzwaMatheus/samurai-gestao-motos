-- Tabela: orcamentos
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data_expiracao TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'expirado', 'convertido')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_orcamentos_entrada_id ON public.orcamentos(entrada_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON public.orcamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_data_expiracao ON public.orcamentos(data_expiracao);

-- Triggers
CREATE TRIGGER update_orcamentos_atualizado_em
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER set_orcamentos_user_id
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trigger_log_orcamentos
  AFTER INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_atividade();

-- Políticas RLS (Segurança)
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de orcamentos" ON public.orcamentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de orcamentos" ON public.orcamentos
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em orcamentos" ON public.orcamentos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em orcamentos" ON public.orcamentos
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_criado_em_br ON public.orcamentos(criado_em DESC);
