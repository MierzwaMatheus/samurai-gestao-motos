// Smoke test: confirma que o setup de matchers do jest-dom carregou.
// Se `toBeInTheDocument` estiver disponível, este teste passa; sem o
// setup, o matcher não existe e o teste falha com "is not a function".
import { describe, it, expect } from "vitest";

describe("test infra setup", () => {
  it("jest-dom matchers estão disponíveis (smoke test)", () => {
    // Cria um elemento detached e checa o matcher do jest-dom
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    document.body.removeChild(el);
  });
});
