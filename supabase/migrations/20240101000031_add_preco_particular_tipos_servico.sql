-- Migration: Adicionar campo preco_particular e renomear valor para preco_oficina
-- Descrição: Cada tipo de serviço agora tem dois preços: preco_oficina (padrão) e preco_particular

-- Primeiro, adiciona a nova coluna preco_particular
ALTER TABLE public.tipos_servico
ADD COLUMN IF NOT EXISTS preco_particular DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Atualizar preco_particular para o mesmo valor de valor (para registros existentes)
UPDATE public.tipos_servico
SET preco_particular = valor
WHERE preco_particular IS NULL OR preco_particular = 0;

-- Renomear a coluna valor para preco_oficina
ALTER TABLE public.tipos_servico
RENAME COLUMN valor TO preco_oficina;

-- Adicionar constraint para garantir que preco_particular não seja negativo
ALTER TABLE public.tipos_servico
DROP CONSTRAINT IF EXISTS tipos_servico_valor_nao_negativo;

ALTER TABLE public.tipos_servico
ADD CONSTRAINT tipos_servico_preco_oficina_nao_negativo CHECK (preco_oficina >= 0);

ALTER TABLE public.tipos_servico
ADD CONSTRAINT tipos_servico_preco_particular_nao_negativo CHECK (preco_particular >= 0);

-- Atualizar função que calcula valor total para usar preco_oficina
-- Nota: Esta função será atualizada na aplicação para considerar o tipo (oficina/particular)
-- Por enquanto, mantemos usando preco_oficina como padrão
CREATE OR REPLACE FUNCTION calcular_valor_total_servicos(entrada_id_param UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  valor_total DECIMAL(10, 2) := 0;
  valor_tipos_servico DECIMAL(10, 2) := 0;
  valor_servicos_personalizados DECIMAL(10, 2) := 0;
BEGIN
  -- Calcula valor dos tipos de serviço (preco_oficina * quantidade)
  -- Nota: Será necessário passar o tipo (oficina/particular) como parâmetro no futuro
  SELECT COALESCE(SUM(ts.preco_oficina * ets.quantidade), 0)
  INTO valor_tipos_servico
  FROM public.entradas_tipos_servico ets
  JOIN public.tipos_servico ts ON ts.id = ets.tipo_servico_id
  WHERE ets.entrada_id = entrada_id_param;

  -- Calcula valor dos serviços personalizados (valor * quantidade)
  SELECT COALESCE(SUM(valor * quantidade), 0)
  INTO valor_servicos_personalizados
  FROM public.servicos_personalizados
  WHERE entrada_id = entrada_id_param;

  valor_total := COALESCE(valor_tipos_servico, 0) + COALESCE(valor_servicos_personalizados, 0);

  RETURN valor_total;
END;
$$ LANGUAGE plpgsql;

-- Atualizar trigger que recalcula quando tipo de serviço é atualizado
CREATE OR REPLACE FUNCTION atualizar_valor_cobrado_ao_atualizar_tipo_servico()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o preco_oficina mudou, recalcula todas as entradas que usam esse tipo de serviço
  IF OLD.preco_oficina IS DISTINCT FROM NEW.preco_oficina THEN
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

-- Recriar o trigger
DROP TRIGGER IF EXISTS atualizar_valor_cobrado_ao_atualizar_tipo_servico ON public.tipos_servico;

CREATE TRIGGER atualizar_valor_cobrado_ao_atualizar_tipo_servico
  AFTER UPDATE OF preco_oficina ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_cobrado_ao_atualizar_tipo_servico();

