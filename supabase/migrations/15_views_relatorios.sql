-- ============================================
-- Views Otimizadas para Relatórios
-- ============================================

-- View 1: Faturamento Mensal Consolidado
CREATE OR REPLACE VIEW vw_faturamento_mensal AS
SELECT
  DATE_TRUNC('month', COALESCE(e.data_entrada, e.criado_em)) AS mes,
  COUNT(*) AS total_entradas,
  SUM(e.valor_cobrado) AS faturamento_total,
  SUM(e.frete) AS total_frete,
  AVG(e.valor_cobrado) AS ticket_medio,
  COUNT(DISTINCT e.cliente_id) AS clientes_unicos,
  COUNT(DISTINCT e.moto_id) AS motos_unicas
FROM public.entradas e
WHERE e.tipo = 'entrada'
  AND e.status IN ('concluido', 'alinhando')
GROUP BY DATE_TRUNC('month', COALESCE(e.data_entrada, e.criado_em))
ORDER BY mes DESC;

-- View 2: Faturamento por Tipo de Serviço
CREATE OR REPLACE VIEW vw_faturamento_por_servico AS
SELECT
  ts.nome AS servico,
  ts.categoria,
  COUNT(DISTINCT ets.entrada_id) AS quantidade_entradas,
  SUM(ets.quantidade) AS total_execucoes,
  SUM(
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
  ) AS faturamento_total
FROM public.entradas_tipos_servico ets
JOIN public.tipos_servico ts ON ets.tipo_servico_id = ts.id
JOIN public.entradas e ON ets.entrada_id = e.id
WHERE e.tipo = 'entrada'
GROUP BY ts.id, ts.nome, ts.categoria
ORDER BY faturamento_total DESC;

-- View 3: Top Clientes por Faturamento
CREATE OR REPLACE VIEW vw_top_clientes AS
SELECT
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  c.telefone,
  c.email,
  c.numero_servicos,
  COUNT(e.id) AS total_entradas,
  SUM(e.valor_cobrado) AS faturamento_total,
  AVG(e.valor_cobrado) AS ticket_medio,
  MAX(e.criado_em) AS ultimo_servico
FROM public.clientes c
LEFT JOIN public.entradas e ON c.id = e.cliente_id AND e.tipo = 'entrada'
GROUP BY c.id, c.nome, c.telefone, c.email, c.numero_servicos
ORDER BY faturamento_total DESC NULLS LAST;

-- View 4: Serviços Mais Realizados
CREATE OR REPLACE VIEW vw_servicos_mais_realizados AS
SELECT
  ts.nome AS servico,
  ts.categoria,
  ts.quantidade_servicos AS total_historico,
  COUNT(DISTINCT ets.entrada_id) AS entradas_diferentes,
  COALESCE(SUM(ets.quantidade), 0) AS total_execucoes,
  COALESCE(AVG(ets.quantidade), 0) AS media_por_entrada
FROM public.tipos_servico ts
LEFT JOIN public.entradas_tipos_servico ets ON ts.id = ets.tipo_servico_id
GROUP BY ts.id, ts.nome, ts.categoria, ts.quantidade_servicos
ORDER BY total_execucoes DESC;

-- View 5: Conversão de Orçamentos
CREATE OR REPLACE VIEW vw_conversao_orcamentos AS
SELECT
  DATE_TRUNC('month', e.criado_em) AS mes,
  COUNT(*) FILTER (WHERE e.tipo = 'orcamento') AS orcamentos_criados,
  COUNT(*) FILTER (WHERE e.tipo = 'entrada' AND EXISTS (
    SELECT 1 FROM public.orcamentos o WHERE o.entrada_id = e.id AND o.status = 'convertido'
  )) AS orcamentos_convertidos,
  ROUND(
    COUNT(*) FILTER (WHERE e.tipo = 'entrada' AND EXISTS (
      SELECT 1 FROM public.orcamentos o WHERE o.entrada_id = e.id AND o.status = 'convertido'
    ))::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE e.tipo = 'orcamento'), 0) * 100,
    2
  ) AS taxa_conversao_percentual,
  COUNT(*) FILTER (WHERE e.tipo = 'orcamento' AND EXISTS (
    SELECT 1 FROM public.orcamentos o WHERE o.entrada_id = e.id AND o.status = 'expirado'
  )) AS orcamentos_expirados
FROM public.entradas e
WHERE e.criado_em >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', e.criado_em)
ORDER BY mes DESC;

-- View 6: Status das Entradas
CREATE OR REPLACE VIEW vw_status_entradas AS
SELECT
  e.status,
  COUNT(*) AS quantidade,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) AS percentual,
  AVG(e.progresso) AS progresso_medio,
  AVG(
    CASE
      WHEN e.status = 'concluido' AND e.data_entrada IS NOT NULL AND e.data_entrega IS NOT NULL
      THEN EXTRACT(EPOCH FROM (e.data_entrega - e.data_entrada)) / 86400
      ELSE NULL
    END
  ) AS dias_medio_conclusao
FROM public.entradas e
WHERE e.tipo = 'entrada'
GROUP BY e.status
ORDER BY quantidade DESC;

-- View 7: Status de Entrega
CREATE OR REPLACE VIEW vw_status_entrega AS
SELECT
  e.status_entrega,
  COUNT(*) AS quantidade,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) AS percentual,
  AVG(
    CASE
      WHEN e.status_entrega = 'entregue' AND e.data_entrega IS NOT NULL AND e.data_entrada IS NOT NULL
      THEN EXTRACT(EPOCH FROM (e.data_entrega - e.data_entrada)) / 86400
      ELSE NULL
    END
  ) AS dias_medio_entrega
FROM public.entradas e
WHERE e.tipo = 'entrada' AND e.status = 'concluido'
GROUP BY e.status_entrega
ORDER BY quantidade DESC;

-- View 8: Atividades por Período
CREATE OR REPLACE VIEW vw_atividades_periodo AS
SELECT
  DATE_TRUNC('day', h.criado_em) AS dia,
  h.acao,
  h.entidade_tipo,
  COUNT(*) AS quantidade
FROM public.historico_atividades h
WHERE h.criado_em >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', h.criado_em), h.acao, h.entidade_tipo
ORDER BY dia DESC, quantidade DESC;

-- View 9: Faturamento por Cliente (Detalhado)
CREATE OR REPLACE VIEW vw_faturamento_cliente_detalhado AS
SELECT
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  e.id AS entrada_id,
  e.criado_em AS data_entrada,
  m.modelo AS moto_modelo,
  m.placa,
  e.status,
  e.valor_cobrado,
  e.frete
FROM public.clientes c
JOIN public.entradas e ON c.id = e.cliente_id
JOIN public.motos m ON e.moto_id = m.id
WHERE e.tipo = 'entrada'
ORDER BY c.nome, e.criado_em DESC;

-- View 10: Serviços Personalizados Mais Comuns
CREATE OR REPLACE VIEW vw_servicos_personalizados_comuns AS
SELECT
  sp.nome AS servico_personalizado,
  COUNT(*) AS quantidade_entradas,
  SUM(sp.quantidade) AS total_execucoes,
  AVG(sp.valor) AS valor_medio,
  SUM(sp.valor * sp.quantidade) AS faturamento_total
FROM public.servicos_personalizados sp
JOIN public.entradas e ON sp.entrada_id = e.id
WHERE e.tipo = 'entrada'
GROUP BY sp.nome
ORDER BY faturamento_total DESC;

-- View 11: Resumo Diário de Operações
CREATE OR REPLACE VIEW vw_resumo_diario AS
SELECT
  DATE(COALESCE(e.data_entrada, e.criado_em)) AS data,
  COUNT(*) FILTER (WHERE e.tipo = 'entrada') AS novas_entradas,
  COUNT(*) FILTER (WHERE e.tipo = 'orcamento') AS novos_orcamentos,
  COUNT(*) FILTER (WHERE e.status = 'concluido') AS concluidos,
  COUNT(*) FILTER (WHERE e.status = 'alinhando') AS em_andamento,
  COUNT(*) FILTER (WHERE e.status_entrega = 'entregue') AS entregues,
  SUM(e.valor_cobrado) FILTER (WHERE e.status = 'concluido') AS faturamento_dia,
  SUM(e.frete) AS frete_dia
FROM public.entradas e
WHERE COALESCE(e.data_entrada, e.criado_em) >= NOW() - INTERVAL '90 days'
GROUP BY DATE(COALESCE(e.data_entrada, e.criado_em))
ORDER BY data DESC;

-- View 12: Distribuição por Categoria de Serviço
CREATE OR REPLACE VIEW vw_distribuicao_categoria AS
SELECT
  ts.categoria,
  COUNT(DISTINCT ts.id) AS tipos_servico,
  COUNT(DISTINCT ets.entrada_id) AS entradas_afetadas,
  SUM(ets.quantidade) AS total_execucoes,
  SUM(
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
  ) AS faturamento_categoria,
  ROUND(
    SUM(
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
    )::NUMERIC / NULLIF(
      (
        SELECT SUM(
          CASE
            WHEN ts2.categoria = 'alinhamento' THEN
              CASE
                WHEN ets2.com_oleo = true THEN
                  COALESCE(ts2.preco_oficina_com_oleo, ts2.preco_oficina, 0)
                ELSE
                  COALESCE(ts2.preco_oficina_sem_oleo, ts2.preco_oficina, 0)
              END
            ELSE
              COALESCE(ts2.preco_oficina, 0)
          END * ets2.quantidade
        )
        FROM public.tipos_servico ts2
        LEFT JOIN public.entradas_tipos_servico ets2 ON ts2.id = ets2.tipo_servico_id
        LEFT JOIN public.entradas e2 ON ets2.entrada_id = e2.id AND e2.tipo = 'entrada'
      ),
      0
    ) * 100,
    2
  ) AS percentual
FROM public.tipos_servico ts
LEFT JOIN public.entradas_tipos_servico ets ON ts.id = ets.tipo_servico_id
LEFT JOIN public.entradas e ON ets.entrada_id = e.id AND e.tipo = 'entrada'
GROUP BY ts.categoria
ORDER BY faturamento_categoria DESC;

-- View 13: Novos Clientes por Período
CREATE OR REPLACE VIEW vw_novos_clientes_periodo AS
SELECT
  DATE_TRUNC('month', c.criado_em) AS mes,
  COUNT(*) AS novos_clientes,
  COUNT(DISTINCT e.cliente_id) AS clientes_com_servico,
  ROUND(
    COUNT(DISTINCT e.cliente_id)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS taxa_conversao_percentual
FROM public.clientes c
LEFT JOIN public.entradas e ON c.id = e.cliente_id AND e.tipo = 'entrada'
GROUP BY DATE_TRUNC('month', c.criado_em)
ORDER BY mes DESC;

-- View 14: Métricas de Performance
CREATE OR REPLACE VIEW vw_metricas_performance AS
SELECT
  COUNT(*) FILTER (WHERE e.tipo = 'entrada') AS total_entradas,
  COUNT(*) FILTER (WHERE e.tipo = 'orcamento') AS total_orcamentos,
  COUNT(*) FILTER (WHERE e.status = 'pendente') AS pendentes,
  COUNT(*) FILTER (WHERE e.status = 'alinhando') AS alinhando,
  COUNT(*) FILTER (WHERE e.status = 'concluido') AS concluidos,
  COUNT(*) FILTER (WHERE e.status_entrega = 'pendente') AS entrega_pendente,
  COUNT(*) FILTER (WHERE e.status_entrega = 'entregue') AS entregues,
  COUNT(*) FILTER (WHERE e.status_entrega = 'retirado') AS retirados,
  SUM(e.valor_cobrado) FILTER (WHERE e.status = 'concluido') AS faturamento_total,
  AVG(e.valor_cobrado) FILTER (WHERE e.tipo = 'entrada') AS ticket_medio_geral,
  COUNT(DISTINCT e.cliente_id) AS clientes_unicos,
  COUNT(DISTINCT e.moto_id) AS motos_unicas
FROM public.entradas e;

-- View 15: Fotos por Tipo e Período
CREATE OR REPLACE VIEW vw_fotos_periodo AS
SELECT
  DATE_TRUNC('month', f.criado_em) AS mes,
  f.tipo,
  COUNT(*) AS quantidade_fotos,
  COUNT(DISTINCT f.entrada_id) AS entradas_com_fotos
FROM public.fotos f
WHERE f.criado_em >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', f.criado_em), f.tipo
ORDER BY mes DESC, f.tipo;
