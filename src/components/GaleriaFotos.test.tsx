import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import GaleriaFotos from "@/components/GaleriaFotos";
import type { FotoStatus } from "@shared/types";

// Mock do cliente Supabase: precisamos controlar o retorno de
// `storage.from("fotos")` para observar os argumentos de `createSignedUrl`.
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
 * Monta o duplo de teste do bucket. Retorna o spy de `createSignedUrl` para
 * que cada teste observe exatamente os argumentos recebidos.
 */
const buildBucket = () => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.example/thumb.jpg" },
    error: null,
  });

  mockedFrom.mockReturnValue({ createSignedUrl } as never);

  return { createSignedUrl };
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

describe("GaleriaFotos", () => {
  it("chama createSignedUrl com (thumbPath, 3600) quando thumbPath existe", async () => {
    const { createSignedUrl } = buildBucket();

    const fotos: FotoStatus[] = [
      buildFoto({
        url: "user/entrada/status/full.jpg",
        thumbPath: "user/entrada/status/thumb.jpg",
      }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/status/thumb.jpg",
      3600
    );
    expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
  });

  it("cai no url (signed) quando thumbPath é null — fallback para fotos legadas", async () => {
    // Cobre o ramo CRÍTICO do `thumbPath ?? url` quando thumbPath é null.
    const { createSignedUrl } = buildBucket();

    const fotos: FotoStatus[] = [
      buildFoto({
        url: "user/entrada/status/legada.jpg",
        thumbPath: null,
      }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/status/legada.jpg",
      3600
    );
  });

  it("não chama createSignedUrl quando thumbPath é uma URL completa (já assinada)", async () => {
    const { createSignedUrl } = buildBucket();

    const fotos: FotoStatus[] = [
      buildFoto({
        url: "user/entrada/status/full.jpg",
        thumbPath: "https://already-signed.example/thumb.jpg",
      }),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });
});