-- ============================================================================
-- seed.sql — issue #4 / ciclo 4
-- ----------------------------------------------------------------------------
-- Popula o Supabase local com dados fake suficientes para validar os
-- relatórios ponta-a-ponta:
--   * >= 100 entradas concluídas (status = 'concluido', tipo = 'entrada')
--   * Clientes e motos fake, 1-para-1 com as entradas
--   * Distribuição ao longo de >= 12 meses para validar séries temporais
--   * Tipos de serviço consumidos via entradas_tipos_servico, com
--     preco_oficina, para a RPC fn_relatorio_por_periodo retornar
--     Valor Serviço / Frete / Total coerentes
--   * Algumas entradas com status_pagamento, forma_pagamento e
--     status_entrega variados para validar shape da RPC
--
-- Idempotente: usa ON CONFLICT DO NOTHING em todas as inserções baseadas em
-- chaves determinísticas (UUIDs fixos) e em generate_series com offsets
-- fixos. Pode ser re-executado a qualquer momento.
--
-- Sem BEGIN/COMMIT: a função seed_ensure_usuario precisa estar visível
-- desde a primeira chamada, e o supabase db reset invoca o seed como um
-- único batch onde COMMITs intermediários não estabelecem visibilidade
-- para comandos posteriores no mesmo batch.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Usuário em auth.users + public.usuarios
--    Necessário porque a FK de clientes/motos/entradas para auth.users.id
--    exige entrada real em auth.users. Sem BEGIN/COMMIT e sem função
--    helper: o `supabase db reset` envia o seed em batch único e funções
--    criadas no mesmo batch não ficam visíveis para SELECTs posteriores;
--    inline `INSERT ... ON CONFLICT DO NOTHING` evita esse problema e é
--    trivialmente idempotente.
--
--    Credenciais pra login manual via UI: `seed+e2e@samurai.local` /
--    `samurai123`. Antes era `'seed-password-not-used'` (placeholder
--    que não servia pra login) — o que obrigava o dev a criar um user
--    à mão no Studio. Os testes E2E (tests/e2e/setup.ts e
--    supabase/functions/_test/helpers.ts) NÃO dependem dessa senha
--    (criam user próprio por teste), então a mudança é segura.
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token,
  email_change, email_change_token_new, recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'seed+e2e@samurai.local',
  crypt('samurai123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  NOW(), NOW(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios (id, email, nome, permissao, ativo, criado_em, atualizado_em)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'seed+e2e@samurai.local',
  'seed-e2e',
  'admin',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1. Tipos de serviço (seed mínimo). Categoria 'padrao' com preco_oficina > 0
--    para que a RPC fn_relatorio_por_periodo retorne Valor Serviço > 0.
--    (A coluna `ativo` não existe em tipos_servico — usamos apenas
--    categoria + preco_*.)
-- ----------------------------------------------------------------------------
INSERT INTO public.tipos_servico (id, nome, categoria, preco_oficina, preco_particular, preco_oficina_com_oleo, preco_oficina_sem_oleo, preco_particular_com_oleo, preco_particular_sem_oleo, user_id, criado_em, atualizado_em)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Alinhamento',       'alinhamento', 120.00, 180.00, 150.00, 110.00, 220.00, 170.00, '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'Balanceamento',     'padrao',       80.00, 120.00,  NULL,  NULL,   NULL,  NULL,    '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'Troca de Oleo',     'padrao',       60.00,  90.00,  NULL,  NULL,   NULL,  NULL,    '00000000-0000-0000-0000-000000000001', NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000004', 'Mao de Obra Geral', 'padrao',      150.00, 220.00,  NULL,  NULL,   NULL,  NULL,    '00000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Configuração de frete (uma linha por user_id — unique em user_id)
-- ----------------------------------------------------------------------------
INSERT INTO public.configuracoes_frete (id, cep_origem, valor_por_km, user_id, criado_em, atualizado_em)
VALUES (gen_random_uuid(), '01000-000', 2.50, '00000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Clientes fake (120 clientes) e suas motos (1-para-1 com as entradas)
-- ----------------------------------------------------------------------------
INSERT INTO public.clientes (id, nome, telefone, email, endereco, cep, user_id, criado_em, atualizado_em)
SELECT
  ('20000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  'Cliente E2E ' || g,
  '(11) 9' || LPAD((1000 + g)::text, 4, '0') || '-' || LPAD((1000 + g * 3)::text, 4, '0'),
  'cliente' || g || '@samurai-e2e.local',
  'Rua E2E ' || g || ', 100',
  '01000-00' || LPAD((g % 100)::text, 2, '0'),
  '00000000-0000-0000-0000-000000000001',
  NOW() - ((g % 12) || ' months')::interval - ((g % 28) || ' days')::interval,
  NOW() - ((g % 12) || ' months')::interval
FROM generate_series(1, 120) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.motos (id, cliente_id, modelo, placa, marca, ano, cilindrada, user_id, criado_em, atualizado_em)
SELECT
  ('30000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  ('20000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  CASE g % 4 WHEN 0 THEN 'Honda CG 160' WHEN 1 THEN 'Yamaha Factor 150' WHEN 2 THEN 'Honda Biz 125' ELSE 'Honda PCX 160' END,
  'E2E-' || LPAD(g::text, 4, '0'),
  CASE g % 3 WHEN 0 THEN 'Honda' WHEN 1 THEN 'Yamaha' ELSE 'Shineray' END,
  '20' || (15 + (g % 10))::text,
  CASE g % 3 WHEN 0 THEN '160cc' WHEN 1 THEN '150cc' ELSE '125cc' END,
  '00000000-0000-0000-0000-000000000001',
  NOW() - ((g % 12) || ' months')::interval,
  NOW() - ((g % 12) || ' months')::interval
FROM generate_series(1, 120) AS g
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. 120 entradas distribuídas nos últimos 14 meses
--    - tipo = 'entrada'
--    - status = 'concluido' (entra na vw_relatorio_excel e na RPC)
--    - data_entrada espalhada: 1 entrada por (mês, dia) cobrindo 14 meses
--    - data_entrega = data_entrada + 2..5 dias
--    - valor_cobrado, frete, forma_pagamento, status_pagamento e
--      status_entrega variados para exercitar a shape da RPC
-- ----------------------------------------------------------------------------
INSERT INTO public.entradas (
  id, tipo, cliente_id, moto_id, endereco, cep, frete, descricao,
  status, progresso, criado_em, atualizado_em, user_id,
  telefone, valor_cobrado, data_orcamento, data_entrada, data_entrega,
  status_entrega, observacoes, os_assinada_url, fotos_status,
  final_numero_quadro, data_conclusao, forma_pagamento, status_pagamento, data_pagamento,
  tipo_preco
)
SELECT
  ('40000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  'entrada',
  ('20000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  ('30000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  'Rua E2E ' || g || ', 100',
  '01000-00' || LPAD((g % 100)::text, 2, '0'),
  (10 + (g % 5) * 5)::numeric(10,2),
  'Serviço E2E #' || g,
  'concluido',
  100,
  (NOW() - ((13 - (g % 14)) || ' months')::interval - ((g % 27) || ' days')::interval - ((g % 23) || ' hours')::interval),
  (NOW() - ((13 - (g % 14)) || ' months')::interval - ((g % 27) || ' days')::interval),
  '00000000-0000-0000-0000-000000000001',
  '(11) 9' || LPAD((1000 + g)::text, 4, '0') || '-' || LPAD((1000 + g * 3)::text, 4, '0'),
  ((150 + (g % 9) * 35))::numeric(10,2),
  (NOW() - ((13 - (g % 14)) || ' months')::interval - ((g % 27) || ' days')::interval - '7 days'::interval),
  (NOW() - ((13 - (g % 14)) || ' months')::interval - ((g % 27) || ' days')::interval),
  (NOW() - ((13 - (g % 14)) || ' months')::interval - ((g % 27) - 2 || ' days')::interval),
  -- Variação entregue/retirado apenas — `pendente` foi removido porque
  -- todas as entradas deste bloco têm `status = 'concluido'` (acima) e
  -- a UI usa `status_entrega = 'pendente'` como filtro da aba "Em
  -- Andamento" (issue #11 ciclo 9). Manter `pendente` aqui criava
  -- ~40 entradas "concluídas" aparecendo em "Em Andamento" com
  -- botões incoerentes (Reabrir / Gerar OS).
  CASE g % 2 WHEN 0 THEN 'entregue' ELSE 'retirado' END,
  'Concluido via seed E2E #' || g,
  'https://example.com/os/' || g || '.pdf',
  '[]'::jsonb,
  'CH' || LPAD(g::text, 9, '0'),
  (NOW() - ((13 - (g % 14)) || ' months')::interval - ((g % 27) - 2 || ' days')::interval),
  CASE g % 4 WHEN 0 THEN 'pix' WHEN 1 THEN 'credito' WHEN 2 THEN 'debito' ELSE 'boleto' END,
  CASE g % 5 WHEN 0 THEN 'pendente' ELSE 'pago' END,
  (NOW() - ((13 - (g % 14)) || ' months')::interval - ((g % 27) - 3 || ' days')::interval),
  CASE g % 10 WHEN 0 THEN 'particular' ELSE 'oficina' END
FROM generate_series(1, 120) AS g
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. entradas_tipos_servico — alimenta o cálculo de valor_cobrado e a
--    view vw_faturamento_por_servico. (Sem coluna user_id.)
-- ----------------------------------------------------------------------------
INSERT INTO public.entradas_tipos_servico (id, entrada_id, tipo_servico_id, quantidade, com_oleo, criado_em)
SELECT
  ('50000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  ('40000000-0000-0000-0000-' || LPAD(g::text, 12, '0'))::uuid,
  CASE g % 4
    WHEN 0 THEN '10000000-0000-0000-0000-000000000001'::uuid
    WHEN 1 THEN '10000000-0000-0000-0000-000000000002'::uuid
    WHEN 2 THEN '10000000-0000-0000-0000-000000000003'::uuid
    ELSE        '10000000-0000-0000-0000-000000000004'::uuid
  END,
  1 + (g % 3),
  (g % 2 = 0),
  NOW()
FROM generate_series(1, 120) AS g
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- GRANTs para service_role em todas as tabelas e views públicas
-- ----------------------------------------------------------------------------
-- Necessário para que o cliente `supabase-js` autenticado com a service
-- role (usado em testes E2E / scripts de backfill) consiga SELECT/INSERT/
-- UPDATE/DELETE sem cair em `permission denied for table X`. A migration
-- 22 original só cobre `authenticated` e `anon`; aqui estendemos para
-- `service_role` (incluindo views, que precisam de GRANT próprio).
--
-- Idempotente: re-aplicar é seguro (GRANT é acumulativo).
-- ============================================================================
DO $$
DECLARE
  relname text;
BEGIN
  FOR relname IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'v', 'm')
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role',
      relname
    );
  END LOOP;
END $$;

-- ============================================================================
-- Verificações rápidas (opcional, emitem NOTICE para inspeção):
-- ============================================================================
DO $$
DECLARE
  v_entradas integer;
  v_concluidas integer;
  v_clientes integer;
  v_motos integer;
  v_meses integer;
BEGIN
  SELECT COUNT(*) INTO v_entradas FROM public.entradas WHERE tipo = 'entrada';
  SELECT COUNT(*) INTO v_concluidas FROM public.entradas WHERE tipo = 'entrada' AND status = 'concluido';
  SELECT COUNT(*) INTO v_clientes FROM public.clientes;
  SELECT COUNT(*) INTO v_motos FROM public.motos;
  SELECT COUNT(DISTINCT date_trunc('month', data_entrada)) INTO v_meses
    FROM public.entradas WHERE tipo = 'entrada' AND status = 'concluido';

  RAISE NOTICE 'seed.sql: entradas=% concluidas=% clientes=% motos=% meses_distintos=%',
    v_entradas, v_concluidas, v_clientes, v_motos, v_meses;
END $$;
