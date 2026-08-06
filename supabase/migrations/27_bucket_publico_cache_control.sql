-- ============================================================================
-- 27 — Bucket `fotos` público + Cache-Control imutável em todos os objetos
-- ----------------------------------------------------------------------------
-- Contexto (issue #13): storage egress = 86.6% do total (357 MB em 2
-- dias). O bucket `fotos` foi tornado público manualmente via Dashboard
-- (drift vs migration 13_storage_buckets.sql que ainda tem public=false).
-- Esta migration reflete a config real no schema e adiciona o header
-- `Cache-Control: public, max-age=31536000, immutable` em todos os
-- objetos existentes via UPDATE em `storage.objects.metadata` — esta
-- versão do schema NÃO tem coluna `cache_control` em `storage.buckets`,
-- então o header vai por metadata dos objetos (lido pelo Supabase
-- Storage ao servir a URL pública).
--
-- Restrições da casa (issue frontmatter, aplicáveis a TODA migration):
--   1. ZERO DELETE / DROP / TRUNCATE em qualquer migration.
--   2. Idempotência obrigatória (re-aplicar = no-op).
--   3. Gate final exige verificação de contagem pré/pós em
--      storage.objects e tabelas principais.
--
-- Idempotência aplicada:
--   - Bucket: WHERE public = false → só atualiza se ainda for privado.
--   - Objects: WHERE metadata->>'cacheControl' IS NULL → só preenche
--     onde ainda não tem. `metadata || '{...}'::jsonb` preserva chaves
--     existentes (size, mimetype, etc).
--
-- Logs: o bloco DO imprime a contagem antes/depois para o gate final
-- comparar byte-a-byte contra o snapshot pré-deploy.
-- ============================================================================

DO $$
DECLARE
  v_total_objects      int;
  v_without_cache_pre  int;
  v_bucket_public_pre  boolean;
  v_objects_updated    int;
BEGIN
  -- -------------------------------------------------------------------------
  -- Snapshot pré-update (para o gate final comparar com o snapshot pré-deploy)
  -- -------------------------------------------------------------------------
  SELECT COUNT(*)::int INTO v_total_objects
    FROM storage.objects WHERE bucket_id = 'fotos';

  SELECT COUNT(*)::int INTO v_without_cache_pre
    FROM storage.objects
    WHERE bucket_id = 'fotos'
      AND (metadata->>'cacheControl') IS NULL;

  SELECT public INTO v_bucket_public_pre
    FROM storage.buckets WHERE id = 'fotos';

  RAISE NOTICE '[migration 27] pré-update: bucket_public=%, total_objects=%, sem_cache_control=%',
    v_bucket_public_pre, v_total_objects, v_without_cache_pre;

  -- -------------------------------------------------------------------------
  -- 1. Bucket `fotos` → public = true (idempotente: WHERE public = false)
  -- -------------------------------------------------------------------------
  UPDATE storage.buckets
     SET public = true
   WHERE id = 'fotos'
     AND public = false;

  -- -------------------------------------------------------------------------
  -- 2. Cache-Control imutável em todos os objetos sem header
  --    (idempotente: WHERE metadata->>'cacheControl' IS NULL)
  --    `metadata || jsonb` preserva chaves existentes (size, mimetype).
  -- -------------------------------------------------------------------------
  UPDATE storage.objects
     SET metadata = metadata
                  || jsonb_build_object('cacheControl',
                                       'public, max-age=31536000, immutable')
   WHERE bucket_id = 'fotos'
     AND (metadata->>'cacheControl') IS NULL;

  GET DIAGNOSTICS v_objects_updated = ROW_COUNT;

  -- -------------------------------------------------------------------------
  -- Snapshot pós-update (comparar com snapshot pré-deploy no gate final)
  -- -------------------------------------------------------------------------
  RAISE NOTICE '[migration 27] pós-update: bucket_public=true, objects_atualizados=%, total_objects=% (deve ser igual ao pré)',
    v_objects_updated, v_total_objects;
END $$;