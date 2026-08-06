/* eslint-disable */
/**
 * Service Worker — issue #13, ciclo 4
 *
 * Estratégia: stale-while-revalidate para fotos do bucket público
 * `fotos` do Supabase Storage (`/storage/v1/object/public/fotos/**`).
 *
 * Por quê SWR:
 *   - bucket público + Cache-Control: public, max-age=31536000, immutable
 *     garante que o objeto é estável por 1 ano; a resposta cacheada pode
 *     ser servida imediatamente (latência ~0).
 *   - o `revalidate` em background só dispara fetch novo caso o
 *     navegador decida atualizar o cache (cache eviction). Para SWR
 *     "puro", sempre disparamos o revalidate, mas o `clone()` garante
 *     que o caller recebe a resposta cacheada IMEDIATAMENTE sem esperar
 *     a rede.
 *
 * Por que isso reduz egress:
 *   - sem SW: cada reload da página baixa todas as thumbs visíveis do
 *     servidor (Supabase conta cada GET como egress).
 *   - com SW: a primeira visita baixa e cacheia; visitas subsequentes
 *     vêm do cache. Apenas o `revalidate` (que pode ser cancelado pelo
 *     browser antes mesmo de chegar no servidor) toca a rede.
 *
 * Restrições:
 *   - Service workers clássicos NÃO suportam `import`/`export`.
 *   - Só intercepta rotas do bucket público de fotos; todo o resto vai
 *     direto pra rede (sem cache).
 *   - Em dev (vite dev server), o SW não é registrado (ver main.tsx).
 *
 * Versionamento: incrementar `CACHE_VERSION` invalida caches antigos
 * automaticamente (limpeza feita no `activate`).
 */

const CACHE_VERSION = "fotos-v1";
const STORAGE_CACHE = `cache-${CACHE_VERSION}`;

/**
 * Padrões de URL que devem passar pelo cache SWR. Apenas o bucket
 * público `fotos` do Supabase Storage — qualquer outro recurso cai
 * no `fetch(event.request)` puro.
 */
const STORAGE_PATH_PREFIX = "/storage/v1/object/public/fotos/";

function isCacheableRequest(url) {
  return url.pathname.startsWith(STORAGE_PATH_PREFIX);
}

self.addEventListener("install", event => {
  // takeOver() acelera a ativação em páginas já controladas pelo SW
  // anterior — evita o "waiting" service worker no DevTools.
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      // Limpa caches antigos quando CACHE_VERSION muda.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== STORAGE_CACHE).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;

  // Apenas intercepta GETs do bucket público de fotos.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return; // URL inválida — não intercepta
  }

  if (!isCacheableRequest(url)) {
    return; // deixa passar pra rede sem cache
  }

  event.respondWith(staleWhileRevalidate(request));
});

/**
 * stale-while-revalidate:
 *   1. devolve imediatamente o cache (se existir) — latência ~0
 *   2. em paralelo, dispara fetch pra atualizar o cache
 *   3. se não há cache, espera a rede
 *
 * Importante: o caller SEMPRE recebe a resposta mais rápida disponível.
 * O `revalidate` é "fire and forget" — se falhar, mantém o cache antigo.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STORAGE_CACHE);
  const cached = await cache.match(request);

  // Dispara o revalidate em background; mas só quando há cache (pra
  // servir imediatamente). Se não há cache, retorna a própria promise
  // do fetch — first-load paga a latência da rede.
  const networkPromise = fetch(request)
    .then(response => {
      // Só cacheia respostas válidas (status 200) e opacas (cross-origin
      // sem CORS — Supabase retorna `opaque` para requests sem ACAO).
      if (
        response &&
        (response.status === 200 || response.type === "opaque")
      ) {
        // `put` é assíncrono mas não bloqueia o caller.
        cache.put(request, response.clone()).catch(() => {
          // Ignora falhas de quota — degrada gracefully.
        });
      }
      return response;
    })
    .catch(() => {
      // Erro de rede no revalidate: mantém o cache antigo (se houver).
      // Sem cache, propaga a rejeição pro caller.
      return cached || Promise.reject(new Error("network error"));
    });

  return cached || networkPromise;
}