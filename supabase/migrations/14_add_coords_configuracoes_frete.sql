-- Adicionar colunas de latitude e longitude na tabela configuracoes_frete
-- Para cache de coordenadas do CEP de origem e evitar requisições repetidas

ALTER TABLE configuracoes_frete 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Adicionar comentários
COMMENT ON COLUMN configuracoes_frete.latitude IS 'Latitude do CEP de origem (cache para evitar requisições externas)';
COMMENT ON COLUMN configuracoes_frete.longitude IS 'Longitude do CEP de origem (cache para evitar requisições externas)';
