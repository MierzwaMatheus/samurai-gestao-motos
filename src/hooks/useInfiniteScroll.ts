import { useEffect, useRef, type RefObject } from "react";

export interface UseInfiniteScrollOpts {
  onIntersect: () => void;
  hasMore: boolean;
  loading: boolean;
  rootMargin?: string;
}

/**
 * Hook de scroll infinito via `IntersectionObserver`.
 *
 * Observa o elemento `sentinelRef` e dispara `opts.onIntersect()` quando:
 *   - o sentinel entra em viewport (`isIntersecting: true`); E
 *   - `opts.hasMore === true`; E
 *   - `opts.loading === false`.
 *
 * O observer é criado uma única vez por mount; toggles de `hasMore` /
 * `loading` e alterações de `onIntersect` são propagadas via refs para
 * evitar re-criar o observer a cada render do caller. O observer é
 * desconectado (`disconnect()`) no unmount para evitar leaks.
 *
 * `rootMargin` é opcional e repassado integralmente para o
 * `IntersectionObserver` (padrão W3C: ex.: "200px", "0px 0px 100% 0px").
 */
export function useInfiniteScroll(
  sentinelRef: RefObject<Element | null>,
  opts: UseInfiniteScrollOpts
): void {
  const { onIntersect, hasMore, loading, rootMargin } = opts;

  // Mantém os valores dinâmicos acessíveis dentro do callback do observer
  // sem precisar recriar o observer quando eles mudam.
  const onIntersectRef = useRef(onIntersect);
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(loading);

  useEffect(() => {
    onIntersectRef.current = onIntersect;
    hasMoreRef.current = hasMore;
    loadingRef.current = loading;
  });

  useEffect(() => {
    // Cria o IntersectionObserver UMA ÚNICA VEZ por mount do hook. Re-criar
    // o observer a cada render (deps = []) causa dois bugs no Oficina:
    //   (1) "reload geral" — o disconnect() + observe() em sequência rápida
    //       faz o navegador disparar o callback imediatamente ao re-anexar,
    //       gerando requests duplicadas e resetando o estado de scroll;
    //   (2) loop de carga — depois de carregarMais() o estado muda, o
    //       useEffect recria o observer, o sentinel visível dispara a
    //       callback de novo, etc.
    //
    // Para o caso de o sentinel ainda não existir no primeiro render (carga
    // assíncrona dos primeiros itens), instalamos um MutationObserver no
    // document.body que dispara `tryAttach` assim que qualquer nó novo
    // for adicionado — barato e reativo, sem polling.
    let observer: IntersectionObserver | null = null;
    let mutationObs: MutationObserver | null = null;
    let cancelled = false;

    const tryAttach = () => {
      if (cancelled) return;
      if (observer) return; // já anexado
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting) return;
          if (!hasMoreRef.current) return;
          if (loadingRef.current) return;
          onIntersectRef.current();
        },
        rootMargin ? { rootMargin } : undefined
      );
      observer.observe(sentinel);
      // Já anexado — não precisamos mais do MutationObserver.
      if (mutationObs) {
        mutationObs.disconnect();
        mutationObs = null;
      }
    };

    tryAttach();

    // Se o sentinel ainda não estiver no DOM, observa o body para reagir
    // a adições de nós. Isso captura tanto o caso da carga assíncrona
    // inicial quanto mudanças de aba (forceMount mantém ambos os
    // TabsContent no DOM, mas o sentinel só aparece após a lista carregar).
    if (!observer && typeof MutationObserver !== "undefined") {
      mutationObs = new MutationObserver(() => {
        tryAttach();
      });
      mutationObs.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      if (mutationObs) mutationObs.disconnect();
      if (observer) observer.disconnect();
    };
    // refs são estáveis; rootMargin raramente muda em runtime.
  }, [sentinelRef, rootMargin]);
}
