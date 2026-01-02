-- Trigger para definir user_id automaticamente nas tabelas
-- Descrição: Garante que o user_id seja sempre preenchido com o usuário autenticado

-- Função para definir user_id automaticamente
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger em todas as tabelas
CREATE TRIGGER set_clientes_user_id
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_motos_user_id
  BEFORE INSERT ON public.motos
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_entradas_user_id
  BEFORE INSERT ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_orcamentos_user_id
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_fotos_user_id
  BEFORE INSERT ON public.fotos
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_tipos_servico_user_id
  BEFORE INSERT ON public.tipos_servico
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

