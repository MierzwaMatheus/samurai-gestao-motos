-- Funções Globais e Triggers

-- 1. Função para atualizar o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Função para definir user_id automaticamente (IMPORTANTE: Corrigido)
CREATE OR REPLACE FUNCTION public.set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para verificar se o usuário atual é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND permissao = 'admin' AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para verificar se o usuário autenticado está ativo
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.usuarios 
    WHERE id = auth.uid() 
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.is_active_user() IS 'Verifica se o usuário autenticado está ativo na tabela de usuários';

-- 5. Função para registrar atividades no log
CREATE OR REPLACE FUNCTION public.registrar_atividade()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_acao TEXT;
  v_detalhes JSONB;
  v_entidade_tipo TEXT;
  v_entidade_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN v_user_id := NEW.user_id;
    ELSE v_user_id := OLD.user_id;
    END IF;
  END IF;
  v_detalhes := '{}'::jsonb;
  IF TG_TABLE_NAME = 'entradas' THEN
    v_entidade_tipo := 'entrada';
    v_entidade_id := NEW.id;
    IF TG_OP = 'INSERT' THEN
      IF NEW.tipo = 'orcamento' THEN v_acao := 'orcamento_criado';
      ELSE v_acao := 'entrada_criada';
      END IF;
      INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id)
      VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_acao := 'status_alterado';
        v_detalhes := jsonb_build_object('de', OLD.status, 'para', NEW.status);
        INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id) VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
      END IF;
      IF OLD.progresso IS DISTINCT FROM NEW.progresso THEN
        v_acao := 'progresso_alterado';
        v_detalhes := jsonb_build_object('de', OLD.progresso, 'para', NEW.progresso);
        INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id) VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'orcamentos' THEN
    v_entidade_tipo := 'orcamento';
    v_entidade_id := NEW.id;
    IF TG_OP = 'INSERT' THEN
      v_acao := 'orcamento_detalhe_criado';
      v_detalhes := jsonb_build_object('valor', NEW.valor);
      INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id) VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_acao := 'orcamento_status_alterado';
        v_detalhes := jsonb_build_object('de', OLD.status, 'para', NEW.status);
        INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id) VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'fotos' THEN
    v_entidade_tipo := 'entrada';
    v_entidade_id := NEW.entrada_id;
    IF TG_OP = 'INSERT' THEN
      v_acao := 'foto_adicionada';
      v_detalhes := jsonb_build_object('tipo', NEW.tipo, 'url', NEW.url);
      INSERT INTO public.historico_atividades (entidade_tipo, entidade_id, acao, detalhes, user_id) VALUES (v_entidade_tipo, v_entidade_id, v_acao, v_detalhes, v_user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Funções de Negócio
CREATE OR REPLACE FUNCTION public.atualizar_orcamentos_expirados()
RETURNS void AS $$
BEGIN
  UPDATE public.entradas
  SET status = 'cancelado'
  WHERE tipo = 'orcamento'
    AND status = 'pendente'
    AND criado_em < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.atualizar_numero_servicos_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clientes
    SET numero_servicos = numero_servicos + 1
    WHERE id = NEW.cliente_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clientes
    SET numero_servicos = GREATEST(0, numero_servicos - 1)
    WHERE id = OLD.cliente_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.incrementar_quantidade_servicos()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tipos_servico
  SET quantidade_servicos = quantidade_servicos + 1
  WHERE id = NEW.tipo_servico_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrementar_quantidade_servicos()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tipos_servico
  SET quantidade_servicos = GREATEST(0, quantidade_servicos - 1)
  WHERE id = OLD.tipo_servico_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.incrementar_servicos_ao_converter_orcamento()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tipo = 'orcamento' AND NEW.tipo = 'entrada' THEN
    UPDATE public.clientes
    SET numero_servicos = numero_servicos + 1
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.calcular_valor_total_servicos(entrada_id_param UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_tipos DECIMAL;
  total_personalizados DECIMAL;
BEGIN
  -- Calcular valor dos tipos de serviço (considerando alinhamento com/sem óleo)
  SELECT COALESCE(SUM(
    CASE 
      WHEN ts.categoria = 'alinhamento' THEN
        CASE 
          WHEN ets.com_oleo = true THEN
            COALESCE(ts.preco_oficina_com_oleo, ts.preco_oficina, 0)
          ELSE
            COALESCE(ts.preco_oficina_sem_oleo, ts.preco_oficina, 0)
        END
      ELSE
        COALESCE(ts.preco_oficina, 0)
    END * ets.quantidade
  ), 0) INTO total_tipos
  FROM public.entradas_tipos_servico ets
  JOIN public.tipos_servico ts ON ets.tipo_servico_id = ts.id
  WHERE ets.entrada_id = entrada_id_param;
  
  -- Calcular valor dos serviços personalizados
  SELECT COALESCE(SUM(valor * quantidade), 0) INTO total_personalizados
  FROM public.servicos_personalizados
  WHERE entrada_id = entrada_id_param;
  
  RETURN total_tipos + total_personalizados;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.atualizar_valor_cobrado_entrada()
RETURNS TRIGGER AS $$
DECLARE
  v_entrada_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN v_entrada_id := OLD.entrada_id;
  ELSE v_entrada_id := NEW.entrada_id;
  END IF;
  UPDATE public.entradas
  SET valor_cobrado = public.calcular_valor_total_servicos(v_entrada_id)
  WHERE id = v_entrada_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.atualizar_valor_cobrado_ao_atualizar_tipo_servico()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.valor IS DISTINCT FROM NEW.valor THEN
    UPDATE public.entradas
    SET valor_cobrado = public.calcular_valor_total_servicos(id)
    WHERE id IN (
      SELECT DISTINCT entrada_id
      FROM public.entradas_tipos_servico
      WHERE tipo_servico_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
