-- Migration: Adicionar trigger para definir user_id em configuracoes_frete
-- Descrição: Garante que o user_id seja definido automaticamente na inserção

-- Remove o trigger se já existir (para permitir reexecução da migration)
DROP TRIGGER IF EXISTS set_configuracoes_frete_user_id ON public.configuracoes_frete;

-- Trigger para definir user_id automaticamente
CREATE TRIGGER set_configuracoes_frete_user_id
  BEFORE INSERT ON public.configuracoes_frete
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

