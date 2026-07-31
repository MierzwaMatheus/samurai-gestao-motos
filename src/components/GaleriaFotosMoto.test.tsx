import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import GaleriaFotosMoto from "@/components/GaleriaFotosMoto";

// Isola do Dialog/Radix para que o teste foque apenas no callsite de storage.
// O modal é testado (ou virá a ser) em outro arquivo.
vi.mock("@/components/ModalVisualizacaoFoto", () => ({
  default: () => null,
}));

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

const mockedFrom = vi.mocked(supabase.storage.from);

/**
 * Monta o duplo de teste do bucket. Retorna o spy de `createSignedUrl` para
 * que cada teste observe exatamente os argumentos recebidos.
 */
const buildBucket = () => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.example/foto.jpg" },
    error: null,
  });

  mockedFrom.mockReturnValue({ createSignedUrl } as never);

  return { createSignedUrl };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GaleriaFotosMoto", () => {
  it("chama createSignedUrl com transformPorTipo('moto') no bucket 'fotos'", async () => {
    const { createSignedUrl } = buildBucket();

    render(<GaleriaFotosMoto fotos={["user/entrada/moto/foto.jpg"]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/foto.jpg",
      3600,
      {
        transform: {
          width: 400,
          height: 400,
          resize: "cover",
          quality: 70,
        },
      }
    );
  });

  it("aponta para o bucket 'fotos' do Supabase", async () => {
    const { createSignedUrl } = buildBucket();

    render(<GaleriaFotosMoto fotos={["user/entrada/moto/foto.jpg"]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(mockedFrom).toHaveBeenCalledWith("fotos");
  });

  it("não inclui o campo format no transform (WebP é servido automaticamente)", async () => {
    const { createSignedUrl } = buildBucket();

    render(<GaleriaFotosMoto fotos={["user/entrada/moto/foto.jpg"]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    // Captura explícita: garantir que `format: "webp"` (não existe na API)
    // nem `format: "origin"` (desligaria a otimização) jamais sejam
    // acrescentados.
    const call = createSignedUrl.mock.calls[0];
    const options = call[2] as { transform: Record<string, unknown> };
    expect(options.transform).not.toHaveProperty("format");
  });
});