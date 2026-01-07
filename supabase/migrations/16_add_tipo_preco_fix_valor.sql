-- Adicionar coluna tipo_preco na tabela entradas
-- Corrigir função calcular_valor_total_servicos para considerar tipo de preço

-- 1. Adicionar coluna tipo_preco
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS tipo_preco TEXT DEFAULT 'oficina' CHECK (tipo_preco IN ('oficina', 'particular'));

-- 2. Atualizar função calcular_valor_total_servicos para usar o tipo de preço correto
CREATE OR REPLACE FUNCTION public.calcular_valor_total_servicos(entrada_id_param UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_tipos DECIMAL;
  total_personalizados DECIMAL;
  v_tipo_preco TEXT;
BEGIN
  -- Buscar o tipo de preço da entrada
  SELECT tipo_preco INTO v_tipo_preco
  FROM public.entradas
  WHERE id = entrada_id_param;

  -- Se não tiver tipo_preco, usar 'oficina' como padrão
  IF v_tipo_preco IS NULL THEN
    v_tipo_preco := 'oficina';
  END IF;

  -- Calcular valor dos tipos de serviço (considerando alinhamento com/sem óleo e tipo de preço)
  SELECT COALESCE(SUM(
    CASE 
      WHEN ts.categoria = 'alinhamento' THEN
        CASE 
          WHEN ets.com_oleo = true THEN
            CASE 
              WHEN v_tipo_preco = 'particular' THEN
                COALESCE(ts.preco_particular_com_oleo, ts.preco_particular, 0)
              ELSE
                COALESCE(ts.preco_oficina_com_oleo, ts.preco_oficina, 0)
            END
          ELSE
            CASE 
              WHEN v_tipo_preco = 'particular' THEN
                COALESCE(ts.preco_particular_sem_oleo, ts.preco_particular, 0)
              ELSE
                COALESCE(ts.preco_oficina_sem_oleo, ts.preco_oficina, 0)
            END
        END
      ELSE
        CASE 
          WHEN v_tipo_preco = 'particular' THEN
            COALESCE(ts.preco_particular, 0)
          ELSE
            COALESCE(ts.preco_oficina, 0)
        END
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

-- 3. Adicionar comentário explicativo
COMMENT ON COLUMN public.entradas.tipo_preco IS 'Tipo de preço usado: "oficina" (padrão) ou "particular"';
