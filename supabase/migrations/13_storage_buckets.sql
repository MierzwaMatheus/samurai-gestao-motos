-- Configuração do Storage para fotos
-- Criar bucket para armazenar as fotos do sistema

-- Inserir bucket para fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos',
  'fotos',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket de fotos
-- Usuários autenticados podem fazer upload
CREATE POLICY "Usuários autenticados podem fazer upload de fotos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fotos' AND 
  auth.role() = 'authenticated'
);

-- Usuários podem ver as fotos que fizeram upload
CREATE POLICY "Usuários podem ver suas fotos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'fotos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuários podem atualizar suas próprias fotos
CREATE POLICY "Usuários podem atualizar suas fotos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'fotos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuários podem deletar suas próprias fotos
CREATE POLICY "Usuários podem deletar suas fotos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'fotos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Função para garantir que o nome do arquivo inclua o ID do usuário
CREATE OR REPLACE FUNCTION public.storage_filename()
RETURNS TRIGGER AS $$
BEGIN
  -- Garante que o nome do arquivo comece com o ID do usuário
  IF NOT (NEW.name LIKE auth.uid()::text || '/%') THEN
    NEW.name = auth.uid()::text || '/' || NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para automaticamente adicionar o ID do usuário ao nome do arquivo
DROP TRIGGER IF EXISTS storage_filename_trigger ON storage.objects;
CREATE TRIGGER storage_filename_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.storage_filename();
