-- Tabela: entradas_tipos_servico
CREATE TABLE IF NOT EXISTS public.entradas_tipos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  tipo_servico_id UUID REFERENCES public.tipos_servico(id) ON DELETE CASCADE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entradas_tipos_servico_unique UNIQUE (entrada_id, tipo_servico_id)
);

ALTER TABLE public.entradas_tipos_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas_tipos_servico ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.entradas_tipos_servico ADD CONSTRAINT entradas_tipos_servico_quantidade_positiva CHECK (quantidade > 0);
ALTER TABLE public.entradas_tipos_servico DROP CONSTRAINT IF EXISTS entradas_tipos_servico_unique;
ALTER TABLE public.entradas_tipos_servico ADD CONSTRAINT entradas_tipos_servico_unique UNIQUE (entrada_id, tipo_servico_id);
ALTER TABLE public.entradas_tipos_servico ADD COLUMN IF NOT EXISTS com_oleo boolean DEFAULT false;

-- Índices
CREATE INDEX IF NOT EXISTS idx_entradas_tipos_servico_entrada_id ON public.entradas_tipos_servico(entrada_id);
CREATE INDEX IF NOT EXISTS idx_entradas_tipos_servico_tipo_servico_id ON public.entradas_tipos_servico(tipo_servico_id);

-- Triggers
CREATE TRIGGER incrementar_quantidade_servicos_ao_criar
  AFTER INSERT ON public.entradas_tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION incrementar_quantidade_servicos();
CREATE TRIGGER decrementar_quantidade_servicos_ao_deletar
  AFTER DELETE ON public.entradas_tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION decrementar_quantidade_servicos();
CREATE TRIGGER atualizar_valor_cobrado_ao_alterar_tipos_servico
  AFTER INSERT OR UPDATE OR DELETE ON public.entradas_tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_cobrado_entrada();

-- Políticas RLS (Segurança)
ALTER TABLE public.entradas_tipos_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de entradas_tipos_servico" ON public.entradas_tipos_servico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de entradas_tipos_servico" ON public.entradas_tipos_servico
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em entradas_tipos_servico" ON public.entradas_tipos_servico
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em entradas_tipos_servico" ON public.entradas_tipos_servico
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_entradas_tipos_servico_criado_em_br ON public.entradas_tipos_servico(criado_em DESC);
