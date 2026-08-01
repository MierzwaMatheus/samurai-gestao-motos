-- ============================================================================
-- 23 — Estende GRANTs para views e materializações
-- ----------------------------------------------------------------------------
-- A migration 22 usa `pg_tables` que cobre apenas relações do tipo 'r' (tabela
-- comum). Views ('v') e materializações ('m') herdam RLS das tabelas base, mas
-- precisam de GRANT próprio no role — sem isso, o PostgREST retorna 42501
-- (permission denied) ao consultar a view, mesmo que a tabela subjacente
-- esteja liberada.
--
-- Sintoma visto na issue #4 / ciclo 4 (testes E2E e UI manual): todas as
-- `vw_*` de relatórios que o `useRelatorioExcel` e os hooks de `useRelatorios`
-- consultam voltavam 403 para `service_role` (E2E) e `anon`/`authenticated`
-- (UI).
--
-- Idempotente: GRANT é acumulativo.
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
       AND c.relkind IN ('v', 'm')
  LOOP
    EXECUTE format(
      'GRANT SELECT ON public.%I TO anon, authenticated, service_role',
      relname
    );
  END LOOP;
END $$;
