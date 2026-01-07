-- Correção da função calcular_valor_total_servicos
-- A função estava tentando acessar coluna 'valor' que não existe em entradas_tipos_servico
-- Agora calcula o valor corretamente baseado nos preços dos tipos de serviço

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
