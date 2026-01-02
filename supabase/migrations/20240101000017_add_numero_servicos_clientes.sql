-- Migration: Adicionar coluna numero_servicos na tabela clientes
-- Descrição: Adiciona contador de serviços realizados por cliente e triggers para atualização automática

-- Adiciona a coluna numero_servicos se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clientes' 
    AND column_name = 'numero_servicos'
  ) THEN
    ALTER TABLE public.clientes 
    ADD COLUMN numero_servicos INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Atualiza o numero_servicos para todos os clientes existentes
UPDATE public.clientes
SET numero_servicos = (
  SELECT COUNT(*)
  FROM public.entradas
  WHERE entradas.cliente_id = clientes.id
);

-- Função para atualizar numero_servicos quando uma entrada é criada ou deletada
CREATE OR REPLACE FUNCTION atualizar_numero_servicos_cliente()
RETURNS TRIGGER AS $$
DECLARE
  cliente_id_uuid UUID;
BEGIN
  -- Determina o cliente_id baseado no tipo de trigger (INSERT ou DELETE)
  IF TG_OP = 'DELETE' THEN
    cliente_id_uuid := OLD.cliente_id;
  ELSE
    cliente_id_uuid := NEW.cliente_id;
  END IF;

  -- Atualiza o numero_servicos do cliente
  UPDATE public.clientes
  SET numero_servicos = (
    SELECT COUNT(*)
    FROM public.entradas
    WHERE cliente_id = cliente_id_uuid
  )
  WHERE id = cliente_id_uuid;

  -- Retorna o registro apropriado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Remove triggers existentes se houver (para evitar duplicação)
DROP TRIGGER IF EXISTS atualizar_numero_servicos_ao_criar_entrada ON public.entradas;
DROP TRIGGER IF EXISTS atualizar_numero_servicos_ao_deletar_entrada ON public.entradas;

-- Trigger para atualizar numero_servicos quando uma entrada é criada
CREATE TRIGGER atualizar_numero_servicos_ao_criar_entrada
  AFTER INSERT ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_numero_servicos_cliente();

-- Trigger para atualizar numero_servicos quando uma entrada é deletada
CREATE TRIGGER atualizar_numero_servicos_ao_deletar_entrada
  AFTER DELETE ON public.entradas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_numero_servicos_cliente();


