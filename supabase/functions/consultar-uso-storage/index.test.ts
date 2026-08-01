import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0";

import { handler } from "./index.ts";
import {
  bootstrap,
  cleanupTestUser,
  createTestUser,
  insertStorageObject,
  type TestContext,
} from "../_test/helpers.ts";

/**
 * Pré-requisitos:
 *   1. `supabase start` rodando (Postgres local + migrations aplicadas)
 *   2. Variáveis de ambiente no shell que rodou `deno test`:
 *        SUPABASE_URL=http://127.0.0.1:54321
 *        SUPABASE_ANON_KEY=<saída de `supabase status`>
 *        SUPABASE_SERVICE_ROLE_KEY=<saída de `supabase status`>
 *
 *   Dica: `eval "$(supabase status --output env)"` carrega tudo antes do test.
 */

const ctx = await bootstrap();

Deno.test("consultar-uso-storage — OPTIONS preflight retorna 204 sem auth", async () => {
  const req = new Request("http://localhost/consultar-uso-storage", {
    method: "OPTIONS",
  });

  const res = await handler(req);

  assertEquals(res.status, 204);
  // CORS preflight deve devolver os headers esperados
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("consultar-uso-storage — 401 sem header de autorização", async () => {
  const req = new Request("http://localhost/consultar-uso-storage", {
    method: "POST",
  });

  const res = await handler(req);

  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Token de autenticação não fornecido");
});

Deno.test("consultar-uso-storage — 401 com JWT inválido", async () => {
  const req = new Request("http://localhost/consultar-uso-storage", {
    method: "POST",
    headers: { authorization: "Bearer token-invalido-aqui" },
  });

  const res = await handler(req);

  assertEquals(res.status, 401);
});

Deno.test({
  name:
    "consultar-uso-storage — happy path: agrega bytes/quantidade por usuário",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      // 3 arquivos do user, totalizando 6000 bytes
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-1/moto/foto1.jpg`,
        sizeBytes: 2000,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
      });
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-1/moto/foto2.jpg`,
        sizeBytes: 3000,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
      });
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-2/status/foto3.jpg`,
        sizeBytes: 1000,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
      });

      const req = new Request("http://localhost/consultar-uso-storage", {
        method: "POST",
        headers: { authorization: `Bearer ${user.accessToken}` },
      });

      const res = await handler(req);

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.espacoUsadoBytes, 6000);
      assertEquals(body.totalArquivos, 3);
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "consultar-uso-storage — isola arquivos de outros usuários (RLS via SECURITY DEFINER)",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const userA = await createTestUser(ctx);
    const userB = await createTestUser(ctx);

    try {
      // User A: 1 arquivo de 100 bytes
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${userA.userId}/foto-a.jpg`,
        sizeBytes: 100,
        mimetype: "image/jpeg",
        ownerUserId: userA.userId,
      });
      // User B: 5 arquivos de 500 bytes = 2500 total
      for (let i = 0; i < 5; i++) {
        await insertStorageObject(ctx, {
          bucketId: "fotos",
          path: `${userB.userId}/foto-${i}.jpg`,
          sizeBytes: 500,
          mimetype: "image/jpeg",
          ownerUserId: userB.userId,
        });
      }

      // User A consulta — deve ver SÓ seus próprios arquivos
      const reqA = new Request("http://localhost/consultar-uso-storage", {
        method: "POST",
        headers: { authorization: `Bearer ${userA.accessToken}` },
      });
      const resA = await handler(reqA);
      assertEquals(resA.status, 200);
      const bodyA = await resA.json();
      assertEquals(bodyA.espacoUsadoBytes, 100);
      assertEquals(bodyA.totalArquivos, 1);
    } finally {
      await cleanupTestUser(ctx, userA.userId);
      await cleanupTestUser(ctx, userB.userId);
    }
  },
});

Deno.test("consultar-uso-storage — retorna zeros quando user não tem arquivos", async () => {
  const user = await createTestUser(ctx);

  try {
    const req = new Request("http://localhost/consultar-uso-storage", {
      method: "POST",
      headers: { authorization: `Bearer ${user.accessToken}` },
    });

    const res = await handler(req);

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.espacoUsadoBytes, 0);
    assertEquals(body.totalArquivos, 0);
  } finally {
    await cleanupTestUser(ctx, user.userId);
  }
});