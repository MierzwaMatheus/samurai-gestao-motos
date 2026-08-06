import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";

import GaleriaFotos from "@/components/GaleriaFotos";
import type { FotoStatus } from "@shared/types";

// Mock do cliente Supabase: precisamos controlar o retorno de
// `storage.from("fotos")` para observar os argumentos de `getPublicUrl`
// (ciclo 3: status usa public URL via `obterUrlParaFoto`).
vi.mock("@/infrastructure/supabase/client", () => {
  const from = vi.fn();
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      storage: { from },
    },
  };
});

import { supabase } from "@/infrastructure/supabase/client";
import { _clearUrlCache } from "@/infrastructure/storage/urlCache";

const mockedFrom = vi.mocked(supabase.storage.from);

/**
 * Monta o duplo de teste do bucket, expondo os spies de `getPublicUrl`
 * (moto/status → public) e `createSignedUrl` (documento → signed).
 */
const buildBucket = () => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.example/thumb.jpg" },
    error: null,
  });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://public.example/${path}` },
  }));

  mockedFrom.mockReturnValue({ createSignedUrl, getPublicUrl } as never);

  return { createSignedUrl, getPublicUrl };
};

/**
 * Constrói uma FotoStatus mínima para uso nos testes. Recebe thumbPath
 * opcional para cobrir o fallback para url quando thumbPath é null.
 */
const buildFoto = (params: {
  url: string;
  thumbPath?: string | null;
  observacao?: string;
}): FotoStatus => ({
  url: params.url,
  thumbPath: params.thumbPath ?? null,
  fullPath: null,
  data: new Date("2025-01-01T12:00:00Z"),
  progresso: 50,
  ...(params.observacao ? { observacao: params.observacao } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  _clearUrlCache();
});

describe("GaleriaFotos — ciclo 3 (obterUrlParaFoto com public URL)", () => {
  it("chama getPublicUrl(thumbPath) quando thumbPath existe — status usa bucket público", async () => {
    const { createSignedUrl, getPublicUrl } = buildBucket();

    const fotos: FotoStatus[] = [
      buildFoto({
        url: "user/entrada/status/full.jpg",
        thumbPath: "user/entrada/status/thumb.jpg",
      }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(getPublicUrl).toHaveBeenCalledTimes(1);
    });

    expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/status/thumb.jpg");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("cai no url (public URL) quando thumbPath é null — fallback para fotos legadas", async () => {
    // Cobre o ramo CRÍTICO do `thumbPath ?? url` quando thumbPath é null.
    const { createSignedUrl, getPublicUrl } = buildBucket();

    const fotos: FotoStatus[] = [
      buildFoto({
        url: "user/entrada/status/legada.jpg",
        thumbPath: null,
      }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(getPublicUrl).toHaveBeenCalledTimes(1);
    });

    expect(getPublicUrl).toHaveBeenCalledWith("user/entrada/status/legada.jpg");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("não chama getPublicUrl/createSignedUrl quando thumbPath é uma URL completa (já resolvida)", async () => {
    const { createSignedUrl, getPublicUrl } = buildBucket();

    const fotos: FotoStatus[] = [
      buildFoto({
        url: "user/entrada/status/full.jpg",
        thumbPath: "https://already-public.example/thumb.jpg",
      }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(getPublicUrl).not.toHaveBeenCalled();
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });
});

describe("GaleriaFotos — gate final (issue #13): robustez do resolver de URLs", () => {
  /**
   * Stryker sobrevivia em alguns mutantes CRÍTICOS do resolver de URLs
   * da GaleriaFotos por testes não cobrirem todas as combinações:
   *
   *   L42 ConditionalExpression `if (r.status === "fulfilled")` —
   *       branch do Promise.allSettled (rejeição vs sucesso).
   *   L53 EqualityOperator `fotos.length > 0` — boundary com lista vazia.
   *   L68 ArithmeticOperator `index + 1` no alt da imagem — referência
   *       textual visível ao usuário.
   *   L85 ConditionalExpression `urls[index]` (truthy vs falsy) —
   *       carregando vs resolvido.
   */

  it("NÃO chama carregarUrls (Promise.allSettled) quando a lista de fotos é vazia", async () => {
    // Mata o mutante ConditionalExpression `if (fotos.length > 0)`
    // → `if (true)` (sempre tentaria resolver mesmo com lista vazia).
    const { getPublicUrl } = buildBucket();
    render(<GaleriaFotos fotos={[]} />);

    // Aguarda ciclo do React para garantir que o useEffect rodou.
    await new Promise(r => setTimeout(r, 50));

    expect(getPublicUrl).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("renderiza placeholder 'Carregando...' antes da URL resolver (urls[index] falsy)", async () => {
    // Mata o mutante ConditionalExpression `urls[index] ? <img> : <Carregando>`
    // → `if (false)` (nunca mostraria o placeholder).
    // Não mockamos `getPublicUrl` para que a promise fique pendurada —
    // assim `urls[index]` permanece undefined e o placeholder aparece.
    mockedFrom.mockReturnValue({
      getPublicUrl: vi.fn(() => new Promise(() => {})) as never,
    } as never);

    const fotos: FotoStatus[] = [
      buildFoto({ url: "u/s/pendente.jpg", thumbPath: "u/s/t.jpg" }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renderiza contador de progresso (index + 1) corretamente para múltiplas fotos", async () => {
    // Mata o mutante ALTO ArithmeticOperator `index + 1` → `index - 1`
    // (mutação troca o `+` por `-` e o alt textual ficaria errado).
    // O alt da foto índice 0 deve ser "Status 1", índice 1 = "Status 2" etc.
    buildBucket();
    const fotos: FotoStatus[] = [
      buildFoto({ url: "u/s/1.jpg", thumbPath: "u/s/t1.jpg" }),
      buildFoto({ url: "u/s/2.jpg", thumbPath: "u/s/t2.jpg" }),
      buildFoto({ url: "u/s/3.jpg", thumbPath: "u/s/t3.jpg" }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(screen.getAllByRole("img")).toHaveLength(3);
    });

    expect(screen.getByAltText("Status 1")).toBeInTheDocument();
    expect(screen.getByAltText("Status 2")).toBeInTheDocument();
    expect(screen.getByAltText("Status 3")).toBeInTheDocument();
  });
});

describe("GaleriaFotos — ciclo 4 (atributos de performance em <img>)", () => {
  /**
   * Ciclo 4 (issue #13): reduzir egress do storage exige que o browser
   * adie requests de thumbs fora da viewport. Os atributos nativos
   * `loading="lazy"` e `decoding="async"` evitam bloquear o main thread;
   * `fetchpriority="high"` é exclusivo do primeiro thumb (acima da fold).
   *
   * RED: hoje o componente só seta `loading="lazy"` — falta
   * `decoding="async"` e `fetchpriority="high"` no primeiro thumb.
   * Estes testes falham até a GREEN adicionar esses atributos.
   */
  it("todas as <img> têm loading=lazy e decoding=async", async () => {
    buildBucket();
    const fotos: FotoStatus[] = [
      buildFoto({ url: "u/s/1.jpg", thumbPath: "u/s/t1.jpg" }),
      buildFoto({ url: "u/s/2.jpg", thumbPath: "u/s/t2.jpg" }),
      buildFoto({ url: "u/s/3.jpg", thumbPath: "u/s/t3.jpg" }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(screen.getAllByRole("img")).toHaveLength(3);
    });

    const imgs = screen.getAllByRole("img");
    imgs.forEach(img => {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("decoding", "async");
    });
  });

  it("apenas o primeiro <img> recebe fetchpriority=high", async () => {
    buildBucket();
    const fotos: FotoStatus[] = [
      buildFoto({ url: "u/s/1.jpg", thumbPath: "u/s/t1.jpg" }),
      buildFoto({ url: "u/s/2.jpg", thumbPath: "u/s/t2.jpg" }),
      buildFoto({ url: "u/s/3.jpg", thumbPath: "u/s/t3.jpg" }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(screen.getAllByRole("img")).toHaveLength(3);
    });

    const imgs = screen.getAllByRole("img");
    expect(imgs[0]).toHaveAttribute("fetchpriority", "high");
    expect(imgs[1]).not.toHaveAttribute("fetchpriority");
    expect(imgs[2]).not.toHaveAttribute("fetchpriority");
  });
});