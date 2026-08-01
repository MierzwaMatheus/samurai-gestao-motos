-- Funções SECURITY DEFINER para agregar/listar objetos no bucket `fotos`
-- sem disparar a listagem recursiva via Storage API.
--
-- O filtro por usuário reaplica a mesma condição da RLS policy do bucket
-- (auth.uid()::text = (storage.foldername(name))[1]) — necessário porque
-- SECURITY DEFINER bypassa RLS mas mantém o auth.uid() do requester.
--
-- Edge Functions consomem via `supabase.rpc(...)`.

-- ----------------------------------------------------------------------------
-- aggregate_storage_usage: total de bytes e quantidade de objetos do usuário
-- no bucket informado. Substitui a recursão de listagem em
-- SupabaseStorageApi.consultarEspacoBucket().
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aggregate_storage_usage(p_bucket text)
RETURNS TABLE (
  espaco_usado_bytes bigint,
  total_arquivos bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS espaco_usado_bytes,
    COUNT(*)::bigint AS total_arquivos
  FROM storage.objects
  WHERE bucket_id = p_bucket
    AND auth.uid()::text = (storage.foldername(name))[1];
$$;

-- ----------------------------------------------------------------------------
-- list_storage_objects_in_period: objetos do bucket dentro do intervalo
-- [p_inicio, p_fim] para o usuário corrente. Substitui a recursão em
-- SupabaseStorageApi.listarArquivosPorPeriodo().
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_storage_objects_in_period(
  p_bucket text,
  p_inicio timestamptz,
  p_fim timestamptz
)
RETURNS TABLE (
  caminho text,
  nome text,
  tamanho_bytes bigint,
  data_criacao timestamptz,
  tipo text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    name AS caminho,
    split_part(name, '/', array_length(string_to_array(name, '/'), 1)) AS nome,
    COALESCE((metadata->>'size')::bigint, 0)::bigint AS tamanho_bytes,
    created_at AS data_criacao,
    COALESCE(metadata->>'mimetype', 'unknown') AS tipo
  FROM storage.objects
  WHERE bucket_id = p_bucket
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND created_at >= p_inicio
    AND created_at <= p_fim
  ORDER BY created_at DESC;
$$;

-- Permissões: Edge Function roda com `anon` role; GRANT explícito para que
-- a chamada via supabase.rpc() não falhe com "permission denied".
GRANT EXECUTE ON FUNCTION public.aggregate_storage_usage(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_storage_objects_in_period(text, timestamptz, timestamptz) TO anon, authenticated;