import { assertEquals } from "jsr:@std/assert@^1.0.0";

import {
  bootstrap,
  cleanupTestUser,
  createTestUser,
  insertStorageObject,
  type TestContext,
} from "./helpers.ts";

/**
 * Migration 27 — bucket `fotos` público + Cache-Control imutável em todos
 * os objetos existentes.
 *
 * Contexto (issue #13): storage egress = 86.6% do total. Bucket foi
 * tornado público manualmente no Dashboard (drift vs migration 13). Esta
 * migration:
 *   1. Reflete no schema a config real do bucket (`public = true`).
 *   2. Adiciona `Cache-Control: public, max-age=31536000, immutable` na
 *      metadata dos objetos (`storage.objects.metadata->cacheControl`)
 *      — coluna `cache_control` não existe nesta versão do schema,
 *      Cache-Control vai por metadata.
 *
 * Restrições da casa (issue frontmatter):
 *   - Zero DELETE/DROP/TRUNCATE.
 *   - Idempotência obrigatória (re-aplicar = no-op).
 *
 * Estratégia de teste (TDD isolation):
 *   - Cada teste reseta explicitamente o estado do bucket `fotos`
 *     (private + sem cacheControl) no `beforeEach` para garantir uma
 *     baseline limpa. O `reset` é via UPDATE (não DELETE), preservando
 *     a integridade dos dados — alinhado com a constraint de zero
 *     DELETE/DROP.
 *   - Aplica a migration, valida os pós-condições.
 *   - Verifica idempotência rodando 2x (sem mudanças entre runs).
 *
 * Pré-requisitos:
 *   1. `supabase start` rodando (Postgres local + migrations 01-26
 *      aplicadas, ou com 27 já aplicada — reset interno trata ambos)
 *   2. Env carregado (SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY)
 */

const ctx = await bootstrap();

// Carrega SQL da migration direto do arquivo. Se o arquivo não existir
// ou estiver vazio, o teste falha em bootstrap (RED antes mesmo do
// `Deno.test` rodar).
const migrationPath = new URL(
  "../../migrations/27_bucket_publico_cache_control.sql",
  import.meta.url,
);
const MIGRATION_27_SQL = await Deno.readTextFile(migrationPath);

if (!MIGRATION_27_SQL.trim()) {
  throw new Error(
    "migration 27 — arquivo vazio. Crie `supabase/migrations/27_bucket_publico_cache_control.sql`.",
  );
}

/** Roda o SQL da migration via pgPool. */
async function runMigration27(c: TestContext): Promise<void> {
  await c.pgPool.query(MIGRATION_27_SQL);
}

/**
 * Reseta o bucket `fotos` ao estado "pré-migration" (private + sem
 * cacheControl). Idempotente. Não deleta nada — só UPDATEs.
 *
 * Necessário porque a migration roda automaticamente em `supabase
 * start` (via supabase/migrations/), então sem reset os testes
 * assumem um estado inconsistente.
 */
async function resetBucketAndObjectsState(c: TestContext): Promise<void> {
  await c.pgPool.query(
    `UPDATE storage.buckets SET public = false WHERE id = 'fotos'`,
  );
  await c.pgPool.query(
    `UPDATE storage.objects
        SET metadata = metadata - 'cacheControl'
      WHERE bucket_id = 'fotos'
        AND metadata ? 'cacheControl'`,
  );
}

/** Lê `public` do bucket `fotos`. */
async function bucketIsPublic(c: TestContext): Promise<boolean> {
  const { rows } = await c.pgPool.query(
    `SELECT public FROM storage.buckets WHERE id = 'fotos'`,
  );
  return rows[0]?.public === true;
}

/** Conta objetos do bucket SEM `cacheControl` na metadata. */
async function countObjectsWithoutCacheControl(
  c: TestContext,
): Promise<number> {
  const { rows } = await c.pgPool.query(
    `SELECT COUNT(*)::int AS n
       FROM storage.objects
       WHERE bucket_id = 'fotos'
         AND (metadata->>'cacheControl') IS NULL`,
  );
  return rows[0]?.n ?? 0;
}

/** Conta total de objetos do bucket (sanity: zero DELETE/DROP). */
async function countObjectsInBucket(c: TestContext): Promise<number> {
  const { rows } = await c.pgPool.query(
    `SELECT COUNT(*)::int AS n FROM storage.objects WHERE bucket_id = 'fotos'`,
  );
  return rows[0]?.n ?? 0;
}

/** Lê metadata crua de um objeto específico. */
async function getObjectMetadata(
  c: TestContext,
  path: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await c.pgPool.query(
    `SELECT metadata FROM storage.objects WHERE bucket_id = 'fotos' AND name = $1`,
    [path],
  );
  return rows[0]?.metadata ?? null;
}

Deno.test({
  name:
    "migration 27 — GREEN: aplica migration → bucket `fotos` vira público",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    await resetBucketAndObjectsState(ctx);

    // Sanity pós-reset: bucket privado
    assertEquals(
      await bucketIsPublic(ctx),
      false,
      "Após reset, bucket deve estar privado.",
    );

    const totalBefore = await countObjectsInBucket(ctx);

    // Aplica migration
    await runMigration27(ctx);

    // Bucket público
    assertEquals(
      await bucketIsPublic(ctx),
      true,
      "Bucket `fotos` deve estar público após migration.",
    );

    // Sanity: contagem de objetos não mudou (zero DELETE/DROP)
    assertEquals(
      await countObjectsInBucket(ctx),
      totalBefore,
      "Migration não pode alterar a contagem de storage.objects.",
    );
  },
});

Deno.test({
  name:
    "migration 27 — GREEN: aplica migration → todos objetos do bucket ganham cacheControl imutável",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    await resetBucketAndObjectsState(ctx);
    const user = await createTestUser(ctx);

    try {
      // Setup: insere 2 objetos sem cacheControl explicitamente
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-cache-1/moto/foto-a.jpg`,
        sizeBytes: 1234,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
      });
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-cache-1/status/foto-b.png`,
        sizeBytes: 5678,
        mimetype: "image/png",
        ownerUserId: user.userId,
      });

      // Garante baseline sem cacheControl
      const withoutBefore = await countObjectsWithoutCacheControl(ctx);
      assertEquals(
        withoutBefore >= 2,
        true,
        `Esperava >=2 objetos sem cacheControl antes; encontrou ${withoutBefore}`,
      );

      // Aplica migration
      await runMigration27(ctx);

      // Pós: zero objetos sem cacheControl no bucket
      assertEquals(
        await countObjectsWithoutCacheControl(ctx),
        0,
        "Todos os objetos do bucket `fotos` devem ter cacheControl após migration.",
      );

      // Verifica valor canônico
      const metaA = await getObjectMetadata(
        ctx,
        `${user.userId}/entrada-cache-1/moto/foto-a.jpg`,
      );
      assertEquals(
        metaA?.cacheControl,
        "public, max-age=31536000, immutable",
        "metadata->>cacheControl deve ser `public, max-age=31536000, immutable`.",
      );

      // Sanity: chaves originais (size, mimetype) preservadas
      assertEquals(metaA?.size, 1234, "size original preservado");
      assertEquals(
        metaA?.mimetype,
        "image/jpeg",
        "mimetype original preservado",
      );
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "migration 27 — idempotente: rodar 2x não altera estado nem quebra nada",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    await resetBucketAndObjectsState(ctx);
    const user = await createTestUser(ctx);

    try {
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-idem/moto/foto-x.jpg`,
        sizeBytes: 999,
        mimetype: "image/webp",
        ownerUserId: user.userId,
      });

      // 1ª aplicação
      await runMigration27(ctx);
      const publicAfterFirst = await bucketIsPublic(ctx);
      const withoutCacheAfterFirst = await countObjectsWithoutCacheControl(ctx);
      const totalAfterFirst = await countObjectsInBucket(ctx);
      const metaAfterFirst = await getObjectMetadata(
        ctx,
        `${user.userId}/entrada-idem/moto/foto-x.jpg`,
      );

      // 2ª aplicação — deve ser no-op
      await runMigration27(ctx);

      assertEquals(
        await bucketIsPublic(ctx),
        publicAfterFirst,
        "public flag não muda entre runs",
      );
      assertEquals(
        await countObjectsWithoutCacheControl(ctx),
        withoutCacheAfterFirst,
        "Contagem sem cacheControl não muda entre runs",
      );
      assertEquals(
        await countObjectsInBucket(ctx),
        totalAfterFirst,
        "Total de objetos não muda entre runs (zero DELETE)",
      );

      // CacheControl preservado
      const metaAfterSecond = await getObjectMetadata(
        ctx,
        `${user.userId}/entrada-idem/moto/foto-x.jpg`,
      );
      assertEquals(
        metaAfterSecond?.cacheControl,
        metaAfterFirst?.cacheControl,
        "cacheControl preservado entre runs (sem duplicação, sem alteração).",
      );
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "migration 27 — não toca em outros buckets (defesa contra SQL sem WHERE)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    await resetBucketAndObjectsState(ctx);
    const user = await createTestUser(ctx);

    try {
      // Setup: cria um bucket privado temporário
      await ctx.pgPool.query(
        `INSERT INTO storage.buckets (id, name, public, file_size_limit)
         VALUES ('fotos-teste-outro', 'fotos-teste-outro', false, 1048576)
         ON CONFLICT (id) DO NOTHING`,
      );

      // Objeto no bucket "outro" sem cacheControl
      await insertStorageObject(ctx, {
        bucketId: "fotos-teste-outro",
        path: `${user.userId}/outro/foto.jpg`,
        sizeBytes: 500,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
      });

      await runMigration27(ctx);

      // Bucket `fotos` público
      assertEquals(await bucketIsPublic(ctx), true, "fotos público");

      // Bucket `fotos-teste-outro` segue privado
      const { rows } = await ctx.pgPool.query(
        `SELECT public FROM storage.buckets WHERE id = 'fotos-teste-outro'`,
      );
      assertEquals(
        rows[0]?.public,
        false,
        "Outro bucket NÃO pode virar público — WHERE id='fotos' obrigatório.",
      );

      // Objeto no bucket "outro" NÃO pode ter ganhado cacheControl
      const otherMeta = await getObjectMetadata(
        ctx,
        `${user.userId}/outro/foto.jpg`,
      );
      assertEquals(
        otherMeta?.cacheControl,
        undefined,
        "Objeto de outro bucket NÃO pode receber cacheControl — WHERE bucket_id='fotos' obrigatório.",
      );

      // NOTA: Supabase proíbe DELETE direto em storage.objects/buckets
      // (mensagem: "Direct deletion from storage tables is not allowed.
      // Use the Storage API instead"). O bucket `fotos-teste-outro`
      // persiste entre test runs — é inofensivo: o teste seguinte
      // sobrescreve via ON CONFLICT DO NOTHING, e o bucket extra não
      // interfere nos asserts de migration 27.
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name: "migration 27 — teardown fecha pool pg",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    // Fecha o pool só no fim de todos os testes; cleanupTestUser cuida
    // de cada user individualmente.
    await ctx.pgPool.end();
  },
});