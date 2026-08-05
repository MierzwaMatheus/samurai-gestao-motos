import pg from "npm:pg@^8.13.0";

import type { TestContext } from "./helpers.ts";

/**
 * Cria o conjunto mínimo (cliente + moto + entrada) para rodar a
 * migration 25, retornando o entradaId pra asserções.
 *
 * Usa `pg` direto porque `entradas` tem FKs `cliente_id`/`moto_id`
 * e trigger `set_user_id` (BEFORE INSERT) que exige `auth.uid()`
 * não-nulo — PostgREST via service_role passa RLS, mas a trigger
 * checa `auth.uid()` separadamente.
 */
export async function createEntradaFixture(
  ctx: TestContext,
  args: {
    userId: string;
    tipo: "entrada" | "orcamento";
    status: "pendente" | "alinhando" | "concluido";
    statusEntrega: "pendente" | "entregue" | "retirado";
  }
): Promise<{ clienteId: string; motoId: string; entradaId: string }> {
  const clienteId = crypto.randomUUID();
  const motoId = crypto.randomUUID();
  const entradaId = crypto.randomUUID();

  await ctx.pgPool.query(
    `INSERT INTO public.clientes (id, nome, telefone, user_id)
     VALUES ($1, $2, $3, $4)`,
    [clienteId, `cli-${clienteId.slice(0, 8)}`, "(11) 99999-9999", args.userId]
  );

  await ctx.pgPool.query(
    `INSERT INTO public.motos (id, cliente_id, modelo, user_id)
     VALUES ($1, $2, $3, $4)`,
    [motoId, clienteId, "Modelo Teste", args.userId]
  );

  // A trigger `trigger_log_entradas` (migration 06) insere em
  // `historico_atividades` com user_id = NEW.user_id. A FK dessa tabela
  // aponta para `public.usuarios(id)` (migration 11), então o usuário
  // precisa existir também em public.usuarios. `createTestUser` em
  // helpers.ts só cria em auth.users — precisamos do row espelhado aqui.
  await ctx.pgPool.query(
    `INSERT INTO public.usuarios (id, nome, email, permissao, ativo)
     VALUES ($1, $2, $3, 'admin', true)
     ON CONFLICT (id) DO NOTHING`,
    [args.userId, `admin-${args.userId.slice(0, 8)}`, `admin-${args.userId.slice(0, 8)}@test.local`]
  );

  await ctx.pgPool.query(
    `INSERT INTO public.entradas
       (id, tipo, cliente_id, moto_id, status, status_entrega, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entradaId,
      args.tipo,
      clienteId,
      motoId,
      args.status,
      args.statusEntrega,
      args.userId,
    ]
  );

  return { clienteId, motoId, entradaId };
}

/**
 * Deleta a fixture (cascateia foto/cliente/moto via FK).
 */
export async function cleanupEntradaFixture(
  ctx: TestContext,
  entradaId: string
): Promise<void> {
  await ctx.pgPool.query(`DELETE FROM public.entradas WHERE id = $1`, [
    entradaId,
  ]);
}

/**
 * SQL canônico da migration 25 — referência única pros testes.
 */
export const MIGRATION_25_SQL = `
  UPDATE public.entradas
  SET status_entrega = 'entregue'
  WHERE status = 'concluido'
    AND status_entrega = 'pendente'
    AND tipo = 'entrada';
`;

/**
 * Roda a migration SQL via pg direto. Retorna o rowCount do UPDATE.
 */
export async function runMigration25(ctx: TestContext): Promise<number> {
  const res = await ctx.pgPool.query(MIGRATION_25_SQL);
  return res.rowCount ?? 0;
}
