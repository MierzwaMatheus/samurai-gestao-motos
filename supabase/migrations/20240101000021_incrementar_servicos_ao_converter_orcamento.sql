-- Migration: Incrementar contadores ao converter orçamento em entrada
-- Descrição: Quando um orçamento é convertido em entrada, incrementa os contadores de tipos de serviço

-- Função para incrementar quantidade_servicos quando um orçamento é convertido em entrada
CREATE OR REPLACE FUNCTION incrementar_servicos_ao_converter_orcamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o tipo mudou de "orcamento" para "entrada", incrementa os contadores
  IF OLD.tipo = 'orcamento' AND NEW.tipo = 'entrada' THEN
    -- Incrementa o contador para cada tipo de serviço vinculado a esta entrada
    UPDATE public.tipos_servico
    SET quantidade_servicos = quantidade_servicos + 1
    WHERE id IN (
      SELECT tipo_servico_id
      FROM public.entradas_tipos_servico
      WHERE entrada_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incrementar contadores quando um orçamento é convertido em entrada
CREATE TRIGGER incrementar_servicos_ao_converter_orcamento
  AFTER UPDATE OF tipo ON public.entradas
  FOR EACH ROW
  WHEN (OLD.tipo = 'orcamento' AND NEW.tipo = 'entrada')
  EXECUTE FUNCTION incrementar_servicos_ao_converter_orcamento();

