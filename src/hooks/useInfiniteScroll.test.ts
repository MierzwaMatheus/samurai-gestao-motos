import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useInfiniteScroll } from "./useInfiniteScroll";

/**
 * Mock do `IntersectionObserver` global.
 *
 * Cada instância captura o `callback` recebido e expõe
 * um helper `__trigger()` para simular interseções nos testes.
 * Isso permite disparar a callback manualmente sem depender
 * do navegador / jsdom (que não implementa IntersectionObserver).
 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(target: Element): void {
    this.observed = this.observed.filter((t) => t !== target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  // Helper específico do mock — não existe no IntersectionObserver real.
  __trigger(entries: Array<Partial<IntersectionObserverEntry>>): void {
    this.callback(entries as IntersectionObserverEntry[], this);
  }
}

const installIntersectionObserverMock = () => {
  MockIntersectionObserver.instances = [];
  // Substitui o construtor global; qualquer `new IntersectionObserver(...)`
  // dentro do hook retorna uma `MockIntersectionObserver`.
  (
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
};

const restoreIntersectionObserver = () => {
  delete (
    globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver }
  ).IntersectionObserver;
};

beforeEach(() => {
  installIntersectionObserverMock();
});

afterEach(() => {
  restoreIntersectionObserver();
});

const makeSentinel = () => document.createElement("div");

describe("useInfiniteScroll — ciclo 7 (IntersectionObserver)", () => {
  it("NÃO dispara onIntersect quando hasMore=false (mesmo com interseção)", () => {
    const onIntersect = vi.fn();
    const sentinel = makeSentinel();

    renderHook(() =>
      useInfiniteScroll(
        { current: sentinel },
        { onIntersect, hasMore: false, loading: false }
      )
    );

    const observer = MockIntersectionObserver.instances.at(-1);
    expect(observer).toBeDefined();
    observer!.__trigger([{ isIntersecting: true }]);

    expect(onIntersect).not.toHaveBeenCalled();
  });

  it("NÃO dispara onIntersect quando loading=true (mesmo com interseção e hasMore=true)", () => {
    const onIntersect = vi.fn();
    const sentinel = makeSentinel();

    renderHook(() =>
      useInfiniteScroll(
        { current: sentinel },
        { onIntersect, hasMore: true, loading: true }
      )
    );

    const observer = MockIntersectionObserver.instances.at(-1);
    observer!.__trigger([{ isIntersecting: true }]);

    expect(onIntersect).not.toHaveBeenCalled();
  });

  it("dispara onIntersect quando sentinel intersecta, hasMore=true e loading=false", () => {
    const onIntersect = vi.fn();
    const sentinel = makeSentinel();

    renderHook(() =>
      useInfiniteScroll(
        { current: sentinel },
        { onIntersect, hasMore: true, loading: false }
      )
    );

    const observer = MockIntersectionObserver.instances.at(-1);
    observer!.__trigger([{ isIntersecting: true }]);

    expect(onIntersect).toHaveBeenCalledTimes(1);
  });

  it("NÃO dispara onIntersect quando isIntersecting=false (mesmo com hasMore && !loading)", () => {
    const onIntersect = vi.fn();
    const sentinel = makeSentinel();

    renderHook(() =>
      useInfiniteScroll(
        { current: sentinel },
        { onIntersect, hasMore: true, loading: false }
      )
    );

    const observer = MockIntersectionObserver.instances.at(-1);
    observer!.__trigger([{ isIntersecting: false }]);

    expect(onIntersect).not.toHaveBeenCalled();
  });

  it("chama observer.disconnect() ao desmontar o hook", () => {
    const onIntersect = vi.fn();
    const sentinel = makeSentinel();

    const { unmount } = renderHook(() =>
      useInfiniteScroll(
        { current: sentinel },
        { onIntersect, hasMore: true, loading: false }
      )
    );

    const observer = MockIntersectionObserver.instances.at(-1);
    expect(observer!.disconnected).toBe(false);

    unmount();

    expect(observer!.disconnected).toBe(true);
  });

  it("passa rootMargin opcional para o IntersectionObserver", () => {
    const onIntersect = vi.fn();
    const sentinel = makeSentinel();

    renderHook(() =>
      useInfiniteScroll(
        { current: sentinel },
        { onIntersect, hasMore: true, loading: false, rootMargin: "200px" }
      )
    );

    const observer = MockIntersectionObserver.instances.at(-1);
    expect(observer!.options?.rootMargin).toBe("200px");
  });

  it("observa o sentinel recebido via ref", () => {
    const onIntersect = vi.fn();
    const sentinel = makeSentinel();

    renderHook(() =>
      useInfiniteScroll(
        { current: sentinel },
        { onIntersect, hasMore: true, loading: false }
      )
    );

    const observer = MockIntersectionObserver.instances.at(-1);
    expect(observer!.observed).toContain(sentinel);
  });
});
