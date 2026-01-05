-- Migration: Adicionar trigger set_user_id para tipos_servico
-- Descrição: Garante que o user_id seja definido automaticamente ao criar tipos de serviço

-- Adiciona o trigger se ainda não existir
CREATE TRIGGER set_tipos_servico_user_id
  BEFORE INSERT ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();



