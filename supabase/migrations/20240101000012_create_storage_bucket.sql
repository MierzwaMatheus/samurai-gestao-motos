-- Migration: Criar bucket de storage para fotos
-- Descrição: Cria o bucket "fotos" no Supabase Storage com políticas RLS

-- Criar bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos',
  'fotos',
  false, -- Bucket privado (não público)
  5242880, -- 5MB limite por arquivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

