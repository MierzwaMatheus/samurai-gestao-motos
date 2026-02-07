-- View para exportação Excel do relatório de serviços concluídos
-- Contém todas as colunas necessárias para o relatório

CREATE OR REPLACE VIEW vw_relatorio_excel AS
SELECT
  e.data_entrada AS "Data Entrada",
  e.data_entrega AS "Data Saída",
  c.nome AS "Nome Cliente",
  c.telefone AS "Telefone",
  m.modelo AS "Modelo Moto",
  m.placa AS "Placa",
  COALESCE(m.marca, '') AS "Marca",
  COALESCE(m.ano, '') AS "Ano",
  COALESCE(m.cilindrada, '') AS "Cilindrada",
  e.forma_pagamento AS "Forma Pagamento",
  e.status_pagamento AS "Status Pagamento",
  COALESCE(e.valor_cobrado, 0) AS "Valor Serviço",
  COALESCE(e.frete, 0) AS "Frete",
  (COALESCE(e.valor_cobrado, 0) + COALESCE(e.frete, 0)) AS "Total",
  e.status AS "Status Serviço",
  e.status_entrega AS "Status Entrega",
  COALESCE(e.descricao, '') AS "Descrição"
FROM public.entradas e
JOIN public.clientes c ON e.cliente_id = c.id
JOIN public.motos m ON e.moto_id = m.id
WHERE e.tipo = 'entrada' AND e.status = 'concluido'
ORDER BY e.data_entrada DESC;

-- Function para obter dados do relatório por período
CREATE OR REPLACE FUNCTION fn_relatorio_por_periodo(data_inicio TIMESTAMPTZ, data_fim TIMESTAMPTZ)
RETURNS TABLE (
  "Data Entrada" TIMESTAMPTZ,
  "Data Saída" TIMESTAMPTZ,
  "Nome Cliente" TEXT,
  "Telefone" TEXT,
  "Modelo Moto" TEXT,
  "Placa" TEXT,
  "Forma Pagamento" TEXT,
  "Status Pagamento" TEXT,
  "Valor Serviço" NUMERIC,
  "Frete" NUMERIC,
  "Total" NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.data_entrada,
    e.data_entrega,
    c.nome,
    c.telefone,
    m.modelo,
    m.placa,
    e.forma_pagamento,
    e.status_pagamento,
    COALESCE(e.valor_cobrado, 0),
    COALESCE(e.frete, 0),
    (COALESCE(e.valor_cobrado, 0) + COALESCE(e.frete, 0))
  FROM public.entradas e
  JOIN public.clientes c ON e.cliente_id = c.id
  JOIN public.motos m ON e.moto_id = m.id
  WHERE e.tipo = 'entrada'
    AND e.status = 'concluido'
    AND COALESCE(e.data_entrada, e.criado_em) >= data_inicio
    AND COALESCE(e.data_entrada, e.criado_em) <= data_fim
  ORDER BY e.data_entrada DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
