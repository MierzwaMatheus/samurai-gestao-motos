-- GRANTs para `authenticated` e `anon` em todas as tabelas públicas.
--
-- Necessário porque o Supabase local (e algumas configurações de prod)
-- não concedem automaticamente permissões de DML ao role `authenticated`
-- após `supabase start`. Sem esses GRANTs, queries RLS-enabled retornam
-- "permission denied for table X" mesmo com policies `qual = true`.
--
-- As RLS policies existentes (ver migration 01-19) já filtram por
-- `auth.role() = 'authenticated'`, então este GRANT só efetiva quando o
-- request vem de um JWT válido.
--
-- Idempotente: re-aplicar é seguro.

DO $$
DECLARE
  tabela text;
BEGIN
  FOR tabela IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, anon',
      tabela
    );
  END LOOP;
END $$;