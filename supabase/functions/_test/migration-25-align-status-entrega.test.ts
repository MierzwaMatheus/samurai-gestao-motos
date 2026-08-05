import { assertEquals } from "jsr:@std/assert@^1.0.0";

import {
  bootstrap,
  cleanupTestUser,
  createTestUser,
  teardown,
} from "./helpers.ts";
import {
  cleanupEntradaFixture,
  createEntradaFixture,
  runMigration25,
} from "./migration-25-helpers.ts";

/**
 * Migration 25 — backfill status_entrega='entregue' para entradas
 * com status='concluido' e status_entrega='pendente'.
 *
 * Contexto: a aba "Concluídos" da Oficina filtra por
 * `status_entrega IN ('entregue','retirado')` via PostgREST. Em prod
 * (~312 entradas), 100% estavam com status_entrega='pendente' mesmo
 * quando status='concluido', deixando a aba Concluídos vazia.
 *
 * A migration roda automaticamente em `supabase start`. Os testes
 * abaixo re-criam fixtures em estado "pendente" (linhas que precisariam
 * de backfill) e re-executam o SQL da migration (idempotente) para
 * verificar o comportamento.
 *
 * Pré-requisitos:
 *   1. `supabase start` rodando (Postgres local + migrations 01–25)
 *   2. `pnpm test:deno` (env carregado a partir de `supabase status`)
 */

const ctx = await bootstrap();

Deno.test({
  name:
    "migration 25 — entrada tipo=entrada, status=concluido, status_entrega=pendente → vira 'entregue'",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      const fixture = await createEntradaFixture(ctx, {
        userId: user.userId,
        tipo: "entrada",
        status: "concluido",
        statusEntrega: "pendente",
      });

      const rowCount = await runMigration25(ctx);
      assertEquals(rowCount, 1, "migration deve atualizar 1 linha");

      const { rows } = await ctx.pgPool.query(
        `SELECT status_entrega FROM public.entradas WHERE id = $1`,
        [fixture.entradaId]
      );
      assertEquals(rows[0].status_entrega, "entregue");
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "migration 25 — entrada já com status_entrega='entregue' NÃO é sobrescrita",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      const fixture = await createEntradaFixture(ctx, {
        userId: user.userId,
        tipo: "entrada",
        status: "concluido",
        statusEntrega: "entregue",
      });

      const rowCount = await runMigration25(ctx);
      assertEquals(rowCount, 0, "WHERE filtra — não deve atualizar nada");

      const { rows } = await ctx.pgPool.query(
        `SELECT status_entrega FROM public.entradas WHERE id = $1`,
        [fixture.entradaId]
      );
      assertEquals(rows[0].status_entrega, "entregue");
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "migration 25 — entrada tipo=orcamento NÃO é migrada (filtro tipo=entrada)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      const fixture = await createEntradaFixture(ctx, {
        userId: user.userId,
        tipo: "orcamento",
        status: "concluido",
        statusEntrega: "pendente",
      });

      const rowCount = await runMigration25(ctx);
      assertEquals(rowCount, 0, "orçamentos ficam como 'pendente'");

      const { rows } = await ctx.pgPool.query(
        `SELECT status_entrega FROM public.entradas WHERE id = $1`,
        [fixture.entradaId]
      );
      assertEquals(rows[0].status_entrega, "pendente");

      await cleanupEntradaFixture(ctx, fixture.entradaId);
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "migration 25 — entrada Em Andamento (status=pendente) NÃO é migrada",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      const fixture = await createEntradaFixture(ctx, {
        userId: user.userId,
        tipo: "entrada",
        status: "pendente",
        statusEntrega: "pendente",
      });

      const rowCount = await runMigration25(ctx);
      assertEquals(rowCount, 0, "Em Andamento fica como 'pendente'");

      const { rows } = await ctx.pgPool.query(
        `SELECT status_entrega FROM public.entradas WHERE id = $1`,
        [fixture.entradaId]
      );
      assertEquals(rows[0].status_entrega, "pendente");
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name: "migration 25 — idempotente: rodar 2x não duplica nem quebra",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      const fixture = await createEntradaFixture(ctx, {
        userId: user.userId,
        tipo: "entrada",
        status: "concluido",
        statusEntrega: "pendente",
      });

      const firstRun = await runMigration25(ctx);
      assertEquals(firstRun, 1, "1ª run atualiza 1 linha");

      const secondRun = await runMigration25(ctx);
      assertEquals(secondRun, 0, "2ª run é no-op (WHERE não bate)");

      const { rows } = await ctx.pgPool.query(
        `SELECT status_entrega FROM public.entradas WHERE id = $1`,
        [fixture.entradaId]
      );
      assertEquals(rows[0].status_entrega, "entregue");
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "migration 25 — não conflita com status_entrega='retirado' (preservado)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      const fixture = await createEntradaFixture(ctx, {
        userId: user.userId,
        tipo: "entrada",
        status: "concluido",
        statusEntrega: "retirado",
      });

      const rowCount = await runMigration25(ctx);
      assertEquals(rowCount, 0, "retirado é finalidade válida, NÃO sobrescreve");

      const { rows } = await ctx.pgPool.query(
        `SELECT status_entrega FROM public.entradas WHERE id = $1`,
        [fixture.entradaId]
      );
      assertEquals(rows[0].status_entrega, "retirado");
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name: "migration 25 — teardown fecha pool pg",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    await teardown(ctx);
  },
});
