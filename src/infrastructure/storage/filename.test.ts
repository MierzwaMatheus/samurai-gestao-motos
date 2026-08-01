import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "@/infrastructure/storage/filename";

describe("sanitizeFilename", () => {
  it("substitui `~` (arquivos de backup/duplicata do Windows) por `_`", () => {
    expect(sanitizeFilename("aizusu.cardozo-20250701-0002~2.jpg")).toBe(
      "aizusu.cardozo-20250701-0002_2.jpg"
    );
  });

  it("substitui espaços por `_`", () => {
    expect(sanitizeFilename("foto da moto.jpg")).toBe("foto_da_moto.jpg");
  });

  it("substitui acentos e caracteres não-ASCII por `_`", () => {
    // "moto" + "-" + "ã"→"_" + "o" + "-" + "ç"→"_" + "." + "jpeg"
    expect(sanitizeFilename("moto-ão-ç.jpeg")).toBe("moto-_o-_.jpeg");
  });

  it("substitui caracteres especiais de URL (`#`, `?`, `&`, `+`, `%`, `!`) por `_`", () => {
    expect(sanitizeFilename("foto#1?a&b+c%d!e.jpg")).toBe(
      "foto_1_a_b_c_d_e.jpg"
    );
  });

  it("preserva alfanuméricos, `.`, `-` e `_`", () => {
    expect(sanitizeFilename("Foto_01-abc.LEGAL.jpg")).toBe(
      "Foto_01-abc.LEGAL.jpg"
    );
  });

  it("retorna string vazia se a entrada for vazia", () => {
    expect(sanitizeFilename("")).toBe("");
  });

  it("não colapsa múltiplos caracteres especiais em um único `_` (1:1)", () => {
    // Importante: cada caractere ruim vira seu próprio `_`, mantendo
    // o "comprimento" do filename — útil pra não colidir com paths
    // de arquivos diferentes que teriam a mesma versão sanitizada.
    expect(sanitizeFilename("a~b~c.jpg")).toBe("a_b_c.jpg");
  });
});
