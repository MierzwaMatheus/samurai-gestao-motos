import { createClient } from "jsr:@supabase/supabase-js@2";
import pg from "npm:pg@^8.13.0";

/**
 * Helper para testes integration contra `supabase start` local.
 *
 * Lê `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
 * do ambiente. Para inserts em `storage.objects` (que não está exposta
 * no schema cache do PostgREST por padrão), usa o driver `pg` direto.
 */

export interface TestContext {
  /** URL base do Supabase local (ex: http://127.0.0.1:54321). */
  supabaseUrl: string;
  /** Service role key — bypassa RLS, use APENAS para setup de teste. */
  serviceRoleKey: string;
  /** Anon key — usada pelo Edge Function em produção. */
  anonKey: string;
  /** Client admin (service_role) — bypassa RLS. */
  admin: ReturnType<typeof createClient>;
  /** Pool de conexões pg (postgres://postgres:postgres@127.0.0.1:54322/postgres). */
  pgPool: pg.Pool;
}

export async function bootstrap(): Promise<TestContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      "Variáveis de ambiente faltando. Garanta que `supabase start` está rodando."
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Conexão direta ao Postgres local via TCP — bypassa PostgREST e schema cache.
  // Default: postgres:postgres@127.0.0.1:54322/postgres (ver `supabase status`).
  const dbHost = Deno.env.get("SUPABASE_DB_HOST") ?? "127.0.0.1";
  const dbPort = Number(Deno.env.get("SUPABASE_DB_PORT") ?? "54322");
  const pgPool = new pg.Pool({
    host: dbHost,
    port: dbPort,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  });

  return { supabaseUrl, serviceRoleKey, anonKey, admin, pgPool };
}

/**
 * Fecha o pool pg. Chamar no `globalTeardown` se for usar `Deno.test` com setup global.
 */
export async function teardown(ctx: TestContext): Promise<void> {
  await ctx.pgPool.end();
}

/**
 * Cria um user de teste, retorna `userId` + `accessToken` (JWT) prontos
 * pra usar no header `Authorization: Bearer <accessToken>`.
 *
 * Limpa o user no `finally` via `admin.deleteUser`.
 */
export async function createTestUser(
  ctx: TestContext
): Promise<{ userId: string; accessToken: string; email: string }> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const senha = "test-password-123";

  const { data: created, error } = await ctx.admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (error || !created.user) {
    throw new Error(`Falha ao criar user de teste: ${error?.message}`);
  }

  const userId = created.user.id;

  try {
    // Login pra obter accessToken
    const { data: signIn, error: signInError } =
      await ctx.admin.auth.signInWithPassword({ email, password: senha });

    if (signInError || !signIn.session) {
      throw new Error(
        `Falha ao fazer login do user de teste: ${signInError?.message}`
      );
    }

    return { userId, accessToken: signIn.session.access_token, email };
  } catch (err) {
    await ctx.admin.auth.admin.deleteUser(userId);
    throw err;
  }
}

/** Deleta user de teste. Tolerante a user já inexistente. */
export async function cleanupTestUser(
  ctx: TestContext,
  userId: string
): Promise<void> {
  const { error } = await ctx.admin.auth.admin.deleteUser(userId);
  if (error && !error.message.includes("not found")) {
    console.warn(`Falha ao deletar user ${userId}: ${error.message}`);
  }
}

/**
 * Insere arquivo fake em `storage.objects` принадлежащий ao user. Usa `pg`
 * direto porque PostgREST não cachea `storage.objects` por padrão.
 */
export async function insertStorageObject(
  ctx: TestContext,
  args: {
    bucketId: string;
    path: string;
    sizeBytes: number;
    mimetype: string;
    ownerUserId: string;
    createdAt?: string;
  }
): Promise<void> {
  await ctx.pgPool.query(
    `INSERT INTO storage.objects (bucket_id, name, metadata, owner, created_at)
     VALUES ($1, $2, $3::jsonb, $4, COALESCE($5::timestamptz, NOW()))`,
    [
      args.bucketId,
      args.path,
      JSON.stringify({ size: args.sizeBytes, mimetype: args.mimetype }),
      args.ownerUserId,
      args.createdAt ?? null,
    ]
  );
}

/** Helper que constrói `Request` pra chamar o handler da Edge Function direto. */
export function buildRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Request {
  return new Request(url, {
    method: init.method ?? "POST",
    headers: init.headers ?? {},
    body: init.body,
  });
}