import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import ModalVisualizacaoFoto from "@/components/ModalVisualizacaoFoto";

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

describe("ModalVisualizacaoFoto — fullPath em alta resolução (ciclo 6)", () => {
  it("renderiza a url (fullPath) da foto atual como src do <img>", () => {
    // O caller (GaleriaFotosMoto) é responsável por passar
    // `fullPath ?? url` por foto. Verificamos que o modal simplesmente
    // pinta essa url no `src` — sem reescolher entre thumb e full.
    const fotos = [
      "https://signed.example/full1.jpg",
      "https://signed.example/full2.jpg",
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
    expect(img).toHaveAttribute("src", "https://signed.example/full1.jpg");
  });

  it("não usa thumbPath como src — usa a url fornecida pelo caller (já é fullPath)", () => {
    // Garante que a renderização do modal não escolhe thumb em vez de
    // full. As urls abaixo representam a versão em alta resolução; se o
    // modal estivesse consumindo thumbPath, veríamos o thumb aqui.
    const fotos = [
      "https://signed.example/full/high.jpg", // fullPath (alta resolução)
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
    expect(img).toHaveAttribute("src", "https://signed.example/full/high.jpg");
    // E nunca o thumbPath hipotético.
    expect(img).not.toHaveAttribute("src", expect.stringContaining("thumb"));
  });

  it("alterna o src ao mudar fotoAtual (cada navegação usa o fullPath correspondente)", () => {
    const fotos = [
      "https://signed.example/full/1.jpg",
      "https://signed.example/full/2.jpg",
      "https://signed.example/full/3.jpg",
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
