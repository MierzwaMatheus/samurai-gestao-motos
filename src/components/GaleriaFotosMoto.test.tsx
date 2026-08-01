import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import GaleriaFotosMoto from "@/components/GaleriaFotosMoto";

// Isola do Dialog/Radix para que o teste foque apenas no callsite de storage.
// O modal é testado (ou virá a ser) em outro arquivo.
// Capturamos as props passadas para inspecionar o `urlsParaModal` (mata
// mutantes de fallback em GaleriaFotosMoto.tsx:63).
const modalSpy = vi.fn(() => null);
vi.mock("@/components/ModalVisualizacaoFoto", () => ({
  default: (props: unknown) => {
    modalSpy(props);
    return null;
  },
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
  modalSpy.mockClear();
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

  it("retorna null quando fotos está vazio (boundary)", async () => {
    // Mata o mutante ALTO em GaleriaFotosMoto.tsx:58 (ConditionalExpression
    // `if (fotos.length === 0) return null` → `false`/`true`/`!==`).
    const { container } = render(<GaleriaFotosMoto fotos={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("passa urlsParaModal com signedUrl quando carregada e fallback para original", async () => {
    // Mata os mutantes CRÍTICOS em GaleriaFotosMoto.tsx:63 (ConditionalExpression
    // `urls[index] || url` → `false`/`true` e LogicalOperator `&&`).
    // O modal recebe `urlsParaModal` calculado no pai. Com o fallback correto,
    // índices com signed URL recebem a signed; demais recebem o original.
    const { createSignedUrl } = buildBucket();

    render(
      <GaleriaFotosMoto
        fotos={[
          "user/entrada/moto/foto1.jpg",
          "https://already-signed.example/foto2.jpg",
          "user/entrada/moto/foto3.jpg",
        ]}
      />
    );

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(2);
    });

    // Modal foi renderizado (a spy capturou as props) com `urlsParaModal`.
    expect(modalSpy).toHaveBeenCalled();
    const props = modalSpy.mock.calls.at(-1)?.[0] as {
      fotos: string[];
    };
    expect(props).toBeDefined();
    expect(props.fotos).toHaveLength(3);
    // Índice 0: signed URL gerada pelo Supabase
    expect(props.fotos[0]).toBe("https://signed.example/foto.jpg");
    // Índice 1: URL original (já completa, startsWith http)
    expect(props.fotos[1]).toBe("https://already-signed.example/foto2.jpg");
    // Índice 2: signed URL gerada pelo Supabase
    expect(props.fotos[2]).toBe("https://signed.example/foto.jpg");
  });
});
