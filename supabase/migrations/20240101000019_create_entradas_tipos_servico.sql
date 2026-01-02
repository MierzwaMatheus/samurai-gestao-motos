-- Migration: Criar tabela entradas_tipos_servico
-- Descrição: Tabela de relacionamento entre entradas e tipos de serviço

CREATE TABLE IF NOT EXISTS public.entradas_tipos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID REFERENCES public.entradas(id) ON DELETE CASCADE NOT NULL,
  tipo_servico_id UUID REFERENCES public.tipos_servico(id) ON DELETE CASCADE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entradas_tipos_servico_unique UNIQUE (entrada_id, tipo_servico_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_entradas_tipos_servico_entrada_id ON public.entradas_tipos_servico(entrada_id);
CREATE INDEX IF NOT EXISTS idx_entradas_tipos_servico_tipo_servico_id ON public.entradas_tipos_servico(tipo_servico_id);

-- Função para incrementar quantidade_servicos quando uma entrada é criada
-- Só incrementa se a entrada for do tipo "entrada" (não "orcamento")
CREATE OR REPLACE FUNCTION incrementar_quantidade_servicos()
RETURNS TRIGGER AS $$
DECLARE
  entrada_tipo TEXT;
BEGIN
  -- Verifica o tipo da entrada
  SELECT tipo INTO entrada_tipo
  FROM public.entradas
  WHERE id = NEW.entrada_id;

  -- Só incrementa se for entrada (não orçamento)
  IF entrada_tipo = 'entrada' THEN
    UPDATE public.tipos_servico
    SET quantidade_servicos = quantidade_servicos + 1
    WHERE id = NEW.tipo_servico_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para decrementar quantidade_servicos quando uma entrada é deletada
-- Só decrementa se a entrada for do tipo "entrada" (não "orcamento")
CREATE OR REPLACE FUNCTION decrementar_quantidade_servicos()
RETURNS TRIGGER AS $$
DECLARE
  entrada_tipo TEXT;
BEGIN
  -- Verifica o tipo da entrada (antes de deletar)
  SELECT tipo INTO entrada_tipo
  FROM public.entradas
  WHERE id = OLD.entrada_id;

  -- Só decrementa se for entrada (não orçamento)
  IF entrada_tipo = 'entrada' THEN
    UPDATE public.tipos_servico
    SET quantidade_servicos = GREATEST(0, quantidade_servicos - 1)
    WHERE id = OLD.tipo_servico_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incrementar quantidade_servicos quando uma entrada_tipos_servico é criada
CREATE TRIGGER incrementar_quantidade_servicos_ao_criar
  AFTER INSERT ON public.entradas_tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION incrementar_quantidade_servicos();

-- Trigger para decrementar quantidade_servicos quando uma entrada_tipos_servico é deletada
CREATE TRIGGER decrementar_quantidade_servicos_ao_deletar
  AFTER DELETE ON public.entradas_tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION decrementar_quantidade_servicos();

