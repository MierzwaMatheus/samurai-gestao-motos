-- Migration: Atualizar função para calcular valor_cobrado automaticamente
-- Descrição: O valor_cobrado será calculado como soma dos valores dos serviços (tipos_servico + servicos_personalizados)

-- Função para calcular o valor total dos serviços de uma entrada
CREATE OR REPLACE FUNCTION calcular_valor_total_servicos(entrada_id_param UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  valor_total DECIMAL(10, 2) := 0;
  valor_tipos_servico DECIMAL(10, 2) := 0;
  valor_servicos_personalizados DECIMAL(10, 2) := 0;
BEGIN
  -- Calcula valor dos tipos de serviço (valor * quantidade)
  SELECT COALESCE(SUM(ts.valor * ets.quantidade), 0)
  INTO valor_tipos_servico
  FROM public.entradas_tipos_servico ets
  INNER JOIN public.tipos_servico ts ON ts.id = ets.tipo_servico_id
  WHERE ets.entrada_id = entrada_id_param;

  -- Calcula valor dos serviços personalizados (valor * quantidade)
  SELECT COALESCE(SUM(valor * quantidade), 0)
  INTO valor_servicos_personalizados
  FROM public.servicos_personalizados
  WHERE entrada_id = entrada_id_param;

  -- Soma total
  valor_total := COALESCE(valor_tipos_servico, 0) + COALESCE(valor_servicos_personalizados, 0);

  RETURN valor_total;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar valor_cobrado quando serviços são adicionados/removidos/atualizados
CREATE OR REPLACE FUNCTION atualizar_valor_cobrado_entrada()
RETURNS TRIGGER AS $$
DECLARE
  entrada_id_param UUID;
  novo_valor DECIMAL(10, 2);
BEGIN
  -- Determina qual entrada_id usar
  IF TG_OP = 'DELETE' THEN
    entrada_id_param := OLD.entrada_id;
  ELSE
    entrada_id_param := NEW.entrada_id;
  END IF;

  -- Calcula novo valor
  novo_valor := calcular_valor_total_servicos(entrada_id_param);

  -- Atualiza valor_cobrado na tabela entradas
  UPDATE public.entradas
  SET valor_cobrado = novo_valor
  WHERE id = entrada_id_param;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar valor_cobrado automaticamente
-- Quando tipos de serviço são adicionados/removidos/atualizados
CREATE TRIGGER atualizar_valor_cobrado_ao_alterar_tipos_servico
  AFTER INSERT OR UPDATE OR DELETE ON public.entradas_tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_cobrado_entrada();

-- Quando serviços personalizados são adicionados/removidos/atualizados
CREATE TRIGGER atualizar_valor_cobrado_ao_alterar_servicos_personalizados
  AFTER INSERT OR UPDATE OR DELETE ON public.servicos_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_cobrado_entrada();

-- Quando o valor de um tipo de serviço é atualizado, recalcula todas as entradas que usam esse tipo
CREATE OR REPLACE FUNCTION atualizar_valor_cobrado_ao_atualizar_tipo_servico()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o valor mudou, recalcula todas as entradas que usam esse tipo de serviço
  IF OLD.valor IS DISTINCT FROM NEW.valor THEN
    UPDATE public.entradas
    SET valor_cobrado = calcular_valor_total_servicos(id)
    WHERE id IN (
      SELECT DISTINCT entrada_id
      FROM public.entradas_tipos_servico
      WHERE tipo_servico_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER atualizar_valor_cobrado_ao_atualizar_tipo_servico
  AFTER UPDATE OF valor ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_cobrado_ao_atualizar_tipo_servico();

