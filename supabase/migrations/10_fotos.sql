-- Tabela: fotos
CREATE TABLE IF NOT EXISTS public.fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT DEFAULT 'moto' CHECK (tipo IN ('moto', 'status', 'documento')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_fotos_entrada_id ON public.fotos(entrada_id);
CREATE INDEX IF NOT EXISTS idx_fotos_user_id ON public.fotos(user_id);
CREATE INDEX IF NOT EXISTS idx_fotos_tipo ON public.fotos(tipo);

-- Triggers
CREATE TRIGGER set_fotos_user_id
  BEFORE INSERT ON public.fotos
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();
CREATE TRIGGER trigger_log_fotos
  AFTER INSERT ON public.fotos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_atividade();

-- Políticas RLS (Segurança)
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de fotos" ON public.fotos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de fotos" ON public.fotos
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em fotos" ON public.fotos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em fotos" ON public.fotos
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_fotos_criado_em_br ON public.fotos(criado_em DESC);
