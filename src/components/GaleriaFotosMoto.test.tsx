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
import { _clearUrlCache } from "@/infrastructure/storage/urlCache";

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
  _clearUrlCache();
});

describe("GaleriaFotosMoto", () => {
  it("chama createSignedUrl com (path, 3600) — sem opções de transform", async () => {
    const { createSignedUrl } = buildBucket();

    render(<GaleriaFotosMoto fotos={["user/entrada/moto/foto.jpg"]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/foto.jpg",
      3600
    );
    expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
  });

  it("aponta para o bucket 'fotos' do Supabase", async () => {
    const { createSignedUrl } = buildBucket();

    render(<GaleriaFotosMoto fotos={["user/entrada/moto/foto.jpg"]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(mockedFrom).toHaveBeenCalledWith("fotos");
  });

  it("não chama createSignedUrl quando a URL já é completa (começa com http)", async () => {
    const { createSignedUrl } = buildBucket();

    render(
      <GaleriaFotosMoto
        fotos={["https://already-signed.example/foto.jpg"]}
      />
    );

    // Aguarda o useEffect rodar. `createSignedUrl` não deve ser invocado
    // para URLs que já começam com "http" — o `startsWith("http")` é a
    // salvaguarda que evita tentar assinar uma URL já assinada.
    await waitFor(() => {
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });
});
