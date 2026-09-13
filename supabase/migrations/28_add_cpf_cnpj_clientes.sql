-- Adicionar documento (CPF/CNPJ) ao cadastro de clientes
-- Campo OPCIONAL: nem todo cliente informa. Quando preenchido, sai
-- impresso no bloco "Dados do Cliente" da OS.
-- A validação de dígito verificador fica na aplicação (src/utils/cpfCnpj.ts),
-- não no banco, para não travar dados legados já existentes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

COMMENT ON COLUMN public.clientes.cpf_cnpj IS 'CPF ou CNPJ do cliente (opcional, somente dígitos)';
