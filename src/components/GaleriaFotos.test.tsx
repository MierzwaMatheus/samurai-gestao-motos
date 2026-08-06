import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

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