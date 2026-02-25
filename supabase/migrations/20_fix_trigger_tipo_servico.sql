-- Corrigir função que atualiza valor cobrado ao atualizar tipo de serviço
-- A função estava referenciando 'valor' que não existe na tabela 'tipos_servico'

CREATE OR REPLACE FUNCTION public.atualizar_valor_cobrado_ao_atualizar_tipo_servico()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.preco_oficina IS DISTINCT FROM NEW.preco_oficina
     OR OLD.preco_particular IS DISTINCT FROM NEW.preco_particular
     OR OLD.preco_oficina_com_oleo IS DISTINCT FROM NEW.preco_oficina_com_oleo
     OR OLD.preco_oficina_sem_oleo IS DISTINCT FROM NEW.preco_oficina_sem_oleo
     OR OLD.preco_particular_com_oleo IS DISTINCT FROM NEW.preco_particular_com_oleo
     OR OLD.preco_particular_sem_oleo IS DISTINCT FROM NEW.preco_particular_sem_oleo
  THEN
    UPDATE public.entradas
    SET valor_cobrado = public.calcular_valor_total_servicos(id)
    WHERE id IN (
      SELECT DISTINCT entrada_id
      FROM public.entradas_tipos_servico
      WHERE tipo_servico_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
