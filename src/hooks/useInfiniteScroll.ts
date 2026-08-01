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
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
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

    return () => {
      observer.disconnect();
    };
    // O observer é criado uma única vez por mount; `rootMargin` raramente
    // muda em runtime, então aceitamos re-criar o observer nessa caso.
  }, [sentinelRef, rootMargin]);
}
