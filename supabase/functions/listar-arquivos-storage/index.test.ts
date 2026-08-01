import { assertEquals } from "jsr:@std/assert@^1.0.0";

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
 *   1. `supabase start` rodando
 *   2. Variáveis de ambiente carregadas (ver `consultar-uso-storage/index.test.ts`)
 */

const ctx = await bootstrap();

Deno.test("listar-arquivos-storage — OPTIONS preflight retorna 204", async () => {
  const req = new Request("http://localhost/listar-arquivos-storage", {
    method: "OPTIONS",
  });

  const res = await handler(req);

  assertEquals(res.status, 204);
});

Deno.test("listar-arquivos-storage — 401 sem header de autorização", async () => {
  const req = new Request("http://localhost/listar-arquivos-storage", {
    method: "POST",
    body: JSON.stringify({ dataInicio: "2026-01-01T00:00:00Z", dataFim: "2026-12-31T23:59:59Z" }),
  });

  const res = await handler(req);

  assertEquals(res.status, 401);
});

Deno.test("listar-arquivos-storage — 400 com body JSON inválido", async () => {
  const user = await createTestUser(ctx);

  try {
    const req = new Request("http://localhost/listar-arquivos-storage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        "content-type": "application/json",
      },
      body: "{json mal formado",
    });

    const res = await handler(req);

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "Body da requisição inválido");
  } finally {
    await cleanupTestUser(ctx, user.userId);
  }
});

Deno.test("listar-arquivos-storage — 400 sem dataInicio/dataFim", async () => {
  const user = await createTestUser(ctx);

  try {
    const req = new Request("http://localhost/listar-arquivos-storage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${user.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await handler(req);

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "dataInicio e dataFim são obrigatórios");
  } finally {
    await cleanupTestUser(ctx, user.userId);
  }
});

Deno.test({
  name:
    "listar-arquivos-storage — happy path: lista arquivos no intervalo e mapeia shape",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      // 1 arquivo dentro do intervalo (julho/2026)
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-1/moto/foto.jpg`,
        sizeBytes: 2048,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
        createdAt: "2026-07-15T10:00:00+00:00",
      });
      // 1 arquivo fora do intervalo (janeiro/2026)
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/entrada-2/moto/antiga.jpg`,
        sizeBytes: 1024,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
        createdAt: "2026-01-15T10:00:00+00:00",
      });

      const req = new Request("http://localhost/listar-arquivos-storage", {
        method: "POST",
        headers: {
          authorization: `Bearer ${user.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dataInicio: "2026-07-01T00:00:00.000Z",
          dataFim: "2026-07-31T23:59:59.999Z",
        }),
      });

      const res = await handler(req);

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.arquivos.length, 1);
      assertEquals(body.arquivos[0].caminho, `${user.userId}/entrada-1/moto/foto.jpg`);
      assertEquals(body.arquivos[0].nome, "foto.jpg");
      assertEquals(body.arquivos[0].tamanhoBytes, 2048);
      assertEquals(body.arquivos[0].tipo, "image/jpeg");
      // dataCriacao deve ser ISO string parseável
      const dataCriacao = new Date(body.arquivos[0].dataCriacao);
      assertEquals(dataCriacao.toISOString(), "2026-07-15T10:00:00.000Z");
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name:
    "listar-arquivos-storage — retorna [] quando não há arquivos no intervalo",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = await createTestUser(ctx);

    try {
      // Arquivo em janeiro — fora do intervalo de julho
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${user.userId}/foto-antiga.jpg`,
        sizeBytes: 500,
        mimetype: "image/jpeg",
        ownerUserId: user.userId,
        createdAt: "2026-01-01T00:00:00+00:00",
      });

      const req = new Request("http://localhost/listar-arquivos-storage", {
        method: "POST",
        headers: {
          authorization: `Bearer ${user.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dataInicio: "2026-07-01T00:00:00.000Z",
          dataFim: "2026-07-31T23:59:59.999Z",
        }),
      });

      const res = await handler(req);

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.arquivos, []);
    } finally {
      await cleanupTestUser(ctx, user.userId);
    }
  },
});

Deno.test({
  name: "listar-arquivos-storage — isola arquivos de outros usuários",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const userA = await createTestUser(ctx);
    const userB = await createTestUser(ctx);

    try {
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${userA.userId}/foto-a.jpg`,
        sizeBytes: 100,
        mimetype: "image/jpeg",
        ownerUserId: userA.userId,
        createdAt: "2026-07-15T10:00:00+00:00",
      });
      await insertStorageObject(ctx, {
        bucketId: "fotos",
        path: `${userB.userId}/foto-b.jpg`,
        sizeBytes: 200,
        mimetype: "image/jpeg",
        ownerUserId: userB.userId,
        createdAt: "2026-07-15T10:00:00+00:00",
      });

      const reqA = new Request("http://localhost/listar-arquivos-storage", {
        method: "POST",
        headers: {
          authorization: `Bearer ${userA.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dataInicio: "2026-07-01T00:00:00.000Z",
          dataFim: "2026-07-31T23:59:59.999Z",
        }),
      });

      const resA = await handler(reqA);
      assertEquals(resA.status, 200);
      const bodyA = await resA.json();
      // User A só vê o próprio arquivo, não o do User B
      assertEquals(bodyA.arquivos.length, 1);
      assertEquals(bodyA.arquivos[0].caminho, `${userA.userId}/foto-a.jpg`);
    } finally {
      await cleanupTestUser(ctx, userA.userId);
      await cleanupTestUser(ctx, userB.userId);
    }
  },
});