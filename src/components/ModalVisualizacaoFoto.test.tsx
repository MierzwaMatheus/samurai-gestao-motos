import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import ModalVisualizacaoFoto from "@/components/ModalVisualizacaoFoto";
import { _clearUrlCache } from "@/infrastructure/storage/urlCache";
import type { Foto } from "@shared/types";

// Mock do cliente Supabase: o modal faz obterSignedUrl (via urlCache).
// Controlamos o retorno de createSignedUrl para testes com paths crus.
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

// Isola do Dialog/Radix: o modal depende de portal/overlay que torna o
// jsdom instável. Como o contrato do Modal é puramente "renderiza a URL
// de `fotos[fotoAtual]`", mockamos o suficiente para inspecionar o `<img>`.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-root">{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
}));

const buildFoto = (params: {
  fullPath?: string | null;
  url?: string;
  id?: string;
}): Foto => ({
  id: params.id ?? "foto-1",
  entradaId: "entrada-1",
  url: params.url ?? "user/entrada-1/moto/legado.jpg",
  thumbPath: null,
  fullPath: params.fullPath ?? null,
  tipo: "moto",
  criadoEm: new Date("2025-01-02T00:00:00Z"),
});

const buildBucket = (signedUrl: string) => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl },
    error: null,
  });
  mockedFrom.mockReturnValue({ createSignedUrl } as never);
  return { createSignedUrl };
};

beforeEach(() => {
  vi.clearAllMocks();
  _clearUrlCache();
});

describe("ModalVisualizacaoFoto — fullPath em alta resolução (issue #13)", () => {
  it("renderiza a url já assinada (fullPath) da foto atual como src do <img>", async () => {
    // Após issue #13: o modal recebe `Foto[]` (com thumbPath/fullPath
    // como paths crus ou signed URLs) e usa `fullPath ?? url` para a
    // imagem em alta resolução. Como tem lazy signing interno, espera
    // o useEffect rodar pra assertion.
    const fotos: Foto[] = [
      buildFoto({ fullPath: "https://signed.example/full1.jpg" }),
      buildFoto({ fullPath: "https://signed.example/full2.jpg" }),
    ];
    render(
      <ModalVisualizacaoFoto
        fotos={fotos}
        fotoAtual={0}
        aberto={true}
        onFechar={() => {}}
      />
    );

    // fullPath já é signed URL (http) — sem chamada de signed URL
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://signed.example/full1.jpg");
  });

  it("assina fullPath lazy quando recebe path cru", async () => {
    // Cobre o caminho em que `fullPath` é um path (não signed URL) e o
    // modal precisa assinar para renderizar a imagem em alta resolução.
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example/full.jpg" },
      error: null,
    });
    mockedFrom.mockReturnValue({ createSignedUrl } as never);

    const fotos: Foto[] = [
      buildFoto({ fullPath: "user/entrada-1/moto/full.jpg" }),
    ];
    render(
      <ModalVisualizacaoFoto
        fotos={fotos}
        fotoAtual={0}
        aberto={true}
        onFechar={() => {}}
      />
    );

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledWith(
        "user/entrada-1/moto/full.jpg",
        expect.any(Number)
      );
    });

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://signed.example/full.jpg");
  });

  it("cai no thumbPath quando o thumb já é signed URL e o fullPath está null", async () => {
    // Antes do issue #13: galeria assinava o thumbPath e o modal
    // recebia só a string. Agora o modal recebe Foto[] com
    // thumbPath/fullPath crus e usa `fullPath ?? url` — mas a foto
    // legada só tem url (sem thumbPath/fullPath). Cobrindo o fallback.
    const fotos: Foto[] = [
      buildFoto({
        url: "https://signed.example/legado.jpg",
        fullPath: null,
      }),
    ];
    render(
      <ModalVisualizacaoFoto
        fotos={fotos}
        fotoAtual={0}
        aberto={true}
        onFechar={() => {}}
      />
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://signed.example/legado.jpg");
  });

  it("alterna o src ao mudar fotoAtual (cada navegação usa o fullPath correspondente)", async () => {
    const fotos: Foto[] = [
      buildFoto({ fullPath: "https://signed.example/full/1.jpg" }),
      buildFoto({ fullPath: "https://signed.example/full/2.jpg" }),
      buildFoto({ fullPath: "https://signed.example/full/3.jpg" }),
    ];
    const { rerender } = render(
      <ModalVisualizacaoFoto
        fotos={fotos}
        fotoAtual={0}
        aberto={true}
        onFechar={() => {}}
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://signed.example/full/1.jpg"
    );

    rerender(
      <ModalVisualizacaoFoto
        fotos={fotos}
        fotoAtual={1}
        aberto={true}
        onFechar={() => {}}
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://signed.example/full/2.jpg"
    );

    rerender(
      <ModalVisualizacaoFoto
        fotos={fotos}
        fotoAtual={2}
        aberto={true}
        onFechar={() => {}}
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://signed.example/full/3.jpg"
    );
  });

  it("retorna null quando fotos está vazio (boundary)", () => {
    const { container } = render(
      <ModalVisualizacaoFoto
        fotos={[]}
        fotoAtual={0}
        aberto={true}
        onFechar={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
