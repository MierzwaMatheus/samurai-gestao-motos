-- Tabela: entradas
CREATE TABLE IF NOT EXISTS public.entradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'orcamento')),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  moto_id UUID REFERENCES public.motos(id) ON DELETE CASCADE NOT NULL,
  endereco TEXT,
  cep TEXT,
  frete DECIMAL(10, 2) DEFAULT 0,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'alinhando', 'concluido')),
  progresso INTEGER DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS valor_cobrado DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS data_orcamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_entrega TEXT DEFAULT 'pendente' CHECK (status_entrega IN ('pendente', 'entregue', 'retirado')),
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS os_assinada_url TEXT;
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS fotos_status JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS final_numero_quadro TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_entradas_cliente_id ON public.entradas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_entradas_moto_id ON public.entradas(moto_id);
CREATE INDEX IF NOT EXISTS idx_entradas_user_id ON public.entradas(user_id);
CREATE INDEX IF NOT EXISTS idx_entradas_tipo ON public.entradas(tipo);
CREATE INDEX IF NOT EXISTS idx_entradas_status ON public.entradas(status);
CREATE INDEX IF NOT EXISTS idx_entradas_criado_em ON public.entradas(criado_em);
CREATE INDEX IF NOT EXISTS idx_entradas_data_entrada ON public.entradas(data_entrada);
CREATE INDEX IF NOT EXISTS idx_entradas_data_entrega ON public.entradas(data_entrega);
CREATE INDEX IF NOT EXISTS idx_entradas_status_entrega ON public.entradas(status_entrega);
CREATE INDEX IF NOT EXISTS idx_entradas_fotos_status ON public.entradas USING GIN (fotos_status);

-- Triggers
CREATE TRIGGER update_entradas_atualizado_em
  BEFORE UPDATE ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em();
CREATE TRIGGER set_entradas_user_id
  BEFORE INSERT ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();
CREATE TRIGGER atualizar_numero_servicos_ao_criar_entrada
  AFTER INSERT ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_numero_servicos_cliente();
CREATE TRIGGER atualizar_numero_servicos_ao_deletar_entrada
  AFTER DELETE ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_numero_servicos_cliente();
CREATE TRIGGER incrementar_servicos_ao_converter_orcamento
  AFTER UPDATE OF tipo ON public.entradas
  FOR EACH ROW
  WHEN (OLD.tipo = 'orcamento' AND NEW.tipo = 'entrada')
  EXECUTE FUNCTION incrementar_servicos_ao_converter_orcamento();
CREATE TRIGGER trigger_log_entradas
  AFTER INSERT OR UPDATE ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_atividade();

-- Comentários
COMMENT ON COLUMN public.entradas.fotos_status IS 'Array JSONB com fotos de status. Formato: [{"url": "path/to/file", "data": "2024-01-01T00:00:00Z", "observacao": "texto", "progresso": 50}]';

-- Políticas RLS (Segurança)
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler dados de entradas" ON public.entradas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem deletar dados de entradas" ON public.entradas
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem inserir dados em entradas" ON public.entradas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dados em entradas" ON public.entradas
  FOR UPDATE TO authenticated USING (true);

-- Otimizações de Performance
