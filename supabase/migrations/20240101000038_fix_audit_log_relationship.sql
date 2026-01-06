-- Migration: Corrigir relacionamento do histórico com usuários
-- Descrição: Altera a FK de user_id para referenciar public.usuarios em vez de auth.users

-- 1. Remover a FK antiga
ALTER TABLE public.historico_atividades
DROP CONSTRAINT IF EXISTS historico_atividades_user_id_fkey;

-- 2. Adicionar a nova FK referenciando public.usuarios
-- Isso permite que o PostgREST encontre o relacionamento para o join automático
ALTER TABLE public.historico_atividades
ADD CONSTRAINT historico_atividades_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- 3. Garantir que o cache do PostgREST seja atualizado (opcional, mas bom)
NOTIFY pgrst, 'reload schema';
