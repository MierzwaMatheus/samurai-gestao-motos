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
    data: { signedUrl: "https://signed.example/status.jpg" },
    error: null,
  });

  mockedFrom.mockReturnValue({ createSignedUrl } as never);

  return { createSignedUrl };
};

beforeEach(() => {
  vi.clearAllMocks();
  _clearUrlCache();
});

/**
 * Constrói uma FotoStatus mínima para uso nos testes.
 */
const buildFoto = (url: string, observacao?: string): FotoStatus => ({
  url,
  data: new Date("2025-01-01T12:00:00Z"),
  progresso: 50,
  ...(observacao ? { observacao } : {}),
});

describe("GaleriaFotos", () => {
  it("chama createSignedUrl com (path, 3600) — sem opções de transform", async () => {
    const { createSignedUrl } = buildBucket();

    const fotos: FotoStatus[] = [buildFoto("user/entrada/status/status.jpg")];
    render(<GaleriaFotos fotos={fotos} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/status/status.jpg",
      3600
    );
    expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
  });

  it("não chama createSignedUrl quando a URL já é completa (começa com http)", async () => {
    const { createSignedUrl } = buildBucket();

    const fotos: FotoStatus[] = [
      buildFoto("https://already-signed.example/status.jpg"),
    ];
    render(<GaleriaFotos fotos={fotos} />);

    // Aguarda o useEffect rodar. `createSignedUrl` não deve ser invocado
    // para URLs que já começam com "http" — o `startsWith("http")` é a
    // salvaguarda que evita tentar assinar uma URL já assinada.
    await waitFor(() => {
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });
});
