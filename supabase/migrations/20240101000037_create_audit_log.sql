-- Migration: Criar sistema de histórico de atividades (Audit Log)
-- Descrição: Cria tabela para logs e triggers para registrar ações importantes

-- 1. Criar tabela de histórico
CREATE TABLE IF NOT EXISTS public.historico_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo TEXT NOT NULL CHECK (entidade_tipo IN ('entrada', 'orcamento', 'foto')),
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL,
  detalhes JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_historico_entidade ON public.historico_atividades(entidade_id, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_historico_criado_em ON public.historico_atividades(criado_em);

-- RLS para historico_atividades
ALTER TABLE public.historico_atividades ENABLE ROW LEVEL SECURITY;

-- Política: Usuários ativos podem ver o histórico
CREATE POLICY "Usuários ativos podem ver histórico"
  ON public.historico_atividades FOR SELECT
  USING (public.is_active_user());

-- Política: Inserção apenas via sistema (triggers) ou usuários ativos (caso necessário manual)
CREATE POLICY "Usuários ativos podem inserir histórico"
  ON public.historico_atividades FOR INSERT
  WITH CHECK (public.is_active_user());

-- 2. Função Trigger para registrar atividades
CREATE OR REPLACE FUNCTION public.registrar_atividade()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_acao TEXT;
  v_detalhes JSONB;
  v_entidade_tipo TEXT;
  v_entidade_id UUID;
BEGIN
  -- Tenta pegar o ID do usuário autenticado
  v_user_id := auth.uid();
  
  -- Se não tiver usuário logado (ex: seed ou operação de sistema), usa o dono do registro ou null
  IF v_user_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_user_id := NEW.user_id;
    ELSE
      v_user_id := OLD.user_id;
    END IF;
  END IF;

  v_detalhes := '{}'::jsonb;

  -- Lógica para Tabela ENTRADAS
  IF TG_TABLE_NAME = 'entradas' THEN
    v_entidade_tipo := 'entrada';
    v_entidade_id := NEW.id;

    IF TG_OP = 'INSERT' THEN
      IF NEW.tipo = 'orcamento' THEN
        v_acao := 'orcamento_criado';
      ELSE
        v_acao := 'entrada_criada';
      END IF;
      
      INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id)
      VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
      
    ELSIF TG_OP = 'UPDATE' THEN
      -- Mudança de Status
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_acao := 'status_alterado';
        v_detalhes := jsonb_build_object('de', OLD.status, 'para', NEW.status);
        
        INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id)
        VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
      END IF;

      -- Mudança de Progresso
      IF OLD.progresso IS DISTINCT FROM NEW.progresso THEN
        v_acao := 'progresso_alterado';
        v_detalhes := jsonb_build_object('de', OLD.progresso, 'para', NEW.progresso);
        
        INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id)
        VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
      END IF;
    END IF;

  -- Lógica para Tabela ORCAMENTOS
  ELSIF TG_TABLE_NAME = 'orcamentos' THEN
    v_entidade_tipo := 'orcamento';
    v_entidade_id := NEW.id;

    IF TG_OP = 'INSERT' THEN
      v_acao := 'orcamento_detalhe_criado';
      v_detalhes := jsonb_build_object('valor', NEW.valor);
      
      INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id)
      VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);

    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_acao := 'orcamento_status_alterado';
        v_detalhes := jsonb_build_object('de', OLD.status, 'para', NEW.status);
        
        INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id)
        VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
      END IF;
    END IF;

  -- Lógica para Tabela FOTOS
  ELSIF TG_TABLE_NAME = 'fotos' THEN
    v_entidade_tipo := 'foto';
    v_entidade_id := NEW.id;

    IF TG_OP = 'INSERT' THEN
      v_acao := 'foto_adicionada';
      v_detalhes := jsonb_build_object('tipo', NEW.tipo, 'url', NEW.url);
      
      -- Para fotos, queremos vincular ao histórico da ENTRADA pai também, se possível?
      -- O requisito diz "em cada card teremos um botão de historico". O card é da entrada/orçamento.
      -- Então o histórico deve ser buscado pelo ID da entrada.
      -- Mas a foto tem entrada_id. Vamos registrar com entidade_tipo='entrada' e entidade_id=NEW.entrada_id
      -- para facilitar a busca no frontend (tudo agrupado na entrada).
      
      v_entidade_tipo := 'entrada';
      v_entidade_id := NEW.entrada_id;
      
      INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id)
      VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar Triggers

-- Trigger para Entradas
DROP TRIGGER IF EXISTS trigger_log_entradas ON public.entradas;
CREATE TRIGGER trigger_log_entradas
  AFTER INSERT OR UPDATE ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_atividade();

-- Trigger para Orçamentos
DROP TRIGGER IF EXISTS trigger_log_orcamentos ON public.orcamentos;
CREATE TRIGGER trigger_log_orcamentos
  AFTER INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_atividade();

-- Trigger para Fotos
DROP TRIGGER IF EXISTS trigger_log_fotos ON public.fotos;
CREATE TRIGGER trigger_log_fotos
  AFTER INSERT ON public.fotos
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_atividade();
