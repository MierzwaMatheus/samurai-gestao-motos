-- Tabela: servicos_personalizados
CREATE TABLE IF NOT EXISTS public.servicos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  CONSTRAINT servicos_personalizados_valor_nao_negativo CHECK (valor >= 0),
  CONSTRAINT servicos_personalizados_quantidade_positiva CHECK (quantidade > 0)
);

ALTER TABLE public.servicos_personalizados ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_servicos_personalizados_entrada_id ON public.servicos_personalizados(entrada_id);
CREATE INDEX IF NOT EXISTS idx_servicos_personalizados_user_id ON public.servicos_personalizados(user_id);

-- Triggers
CREATE TRIGGER atualizar_valor_cobrado_ao_alterar_servicos_personalizados
  AFTER INSERT OR UPDATE OR DELETE ON public.servicos_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_cobrado_entrada();
CREATE TRIGGER set_servicos_personalizados_user_id
      BEFORE INSERT ON public.servicos_personalizados
      FOR EACH ROW
      EXECUTE FUNCTION set_user_id();

-- Políticas RLS (Segurança)
ALTER TABLE public.servicos_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de servicos_personalizados" ON public.servicos_personalizados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de servicos_personalizados" ON public.servicos_personalizados
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em servicos_personalizados" ON public.servicos_personalizados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em servicos_personalizados" ON public.servicos_personalizados
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
CREATE INDEX IF NOT EXISTS idx_servicos_personalizados_criado_em_br ON public.servicos_personalizados(criado_em DESC);
