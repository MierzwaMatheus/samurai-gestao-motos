-- Migration: Corrigir política RLS e adicionar trigger para servicos_personalizados
-- Descrição: Remove verificação de user_id na política INSERT (será definido pelo trigger) e adiciona o trigger

-- Remover política antiga
DROP POLICY IF EXISTS "Usuários podem criar serviços personalizados para suas entradas" ON public.servicos_personalizados;

-- Criar política corrigida (sem verificar user_id, pois será definido pelo trigger)
CREATE POLICY "Usuários podem criar serviços personalizados para suas entradas"
  ON public.servicos_personalizados
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.entradas
      WHERE entradas.id = servicos_personalizados.entrada_id
      AND entradas.user_id = auth.uid()
    )
  );

-- Adicionar trigger para definir user_id automaticamente (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_servicos_personalizados_user_id'
  ) THEN
    CREATE TRIGGER set_servicos_personalizados_user_id
      BEFORE INSERT ON public.servicos_personalizados
      FOR EACH ROW
      EXECUTE FUNCTION set_user_id();
  END IF;
END $$;

