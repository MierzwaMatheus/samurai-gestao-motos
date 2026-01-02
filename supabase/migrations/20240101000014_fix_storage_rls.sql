-- Migration: Corrigir políticas RLS do storage
-- Descrição: Remove e recria as políticas com a sintaxe correta

-- Remove políticas antigas
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem ver suas próprias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar suas próprias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar suas próprias fotos" ON storage.objects;

-- Política: Usuários autenticados podem fazer upload de fotos
CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários autenticados podem ver suas próprias fotos
CREATE POLICY "Usuários autenticados podem ver suas próprias fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários autenticados podem atualizar suas próprias fotos
CREATE POLICY "Usuários autenticados podem atualizar suas próprias fotos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários autenticados podem deletar suas próprias fotos
CREATE POLICY "Usuários autenticados podem deletar suas próprias fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

