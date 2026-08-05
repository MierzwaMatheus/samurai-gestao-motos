-- ============================================================================
-- 25 — Backfill: alinha status_entrega com status para entradas já concluídas
-- ----------------------------------------------------------------------------
-- Contexto: a Oficina usa dois toggles independentes (status da OS + status
-- de entrega). A coluna status_entrega foi adicionada na migration 06 com
-- DEFAULT 'pendente'. Em produção, nenhuma entrada tinha status_entrega
-- alterada manualmente para 'entregue'/'retirado', então a aba "Concluídos"
-- (filtro server-side por status_entrega IN ('entregue','retirado'),
-- SupabaseEntradaRepository.buscarPagina:159) sempre retornava lista vazia.
--
-- Esta migration finaliza entradas antigas onde status='concluido' mas
-- status_entrega ainda está 'pendente', marcando como 'entregue'. Split
-- (entregue vs retirado) intencionalmente não é aplicado agora — primeiro
-- MVP exige alinhar com 'entregue'; refinamento se faz via UI em seguida.
--
-- Idempotente: WHERE filtra exatamente o conjunto a migrar; após a 1ª
-- execução, zero rows batem na cláusula e rodadas subsequentes são no-op.
-- ============================================================================
UPDATE public.entradas
SET status_entrega = 'entregue'
WHERE status = 'concluido'
  AND status_entrega = 'pendente'
  AND tipo = 'entrada';
