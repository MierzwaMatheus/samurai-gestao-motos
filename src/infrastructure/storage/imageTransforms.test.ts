import { describe, it, expect } from "vitest";

import { transformPorTipo } from "@/infrastructure/storage/imageTransforms";

/**
 * Helpers puros: nada aqui depende do Supabase nem de DOM. O objetivo é
 * maximizar o sinal para mutantes — qualquer troca em literal (`400` → `0`,
 * `70` → `80`) ou em branch (`===` → `!==`) precisa ser capturada por um
 * expect exato sobre o objeto retornado.
 *
 * Observação sobre `format`: a API do Supabase aceita **somente** `"origin"`
 * nesse campo, cuyo efeito é *desligar* a otimização. WebP é servido
 * **automaticamente** quando `format` é omitido. Por isso **nenhum** dos
 * retornos abaixo inclui `format: "webp"` — esse valor nem existe na API.
 */

describe("transformPorTipo", () => {
  describe('"moto" (galeria em grid 3×3, precisa de cover)', () => {
    it("retorna opções com cover e width 400, height 400, quality 70", () => {
      const result = transformPorTipo("moto");

      expect(result).toEqual({
        width: 400,
        height: 400,
        resize: "cover",
        quality: 70,
      });
    });

    it("não inclui o campo format (serve WebP automaticamente)", () => {
      const result = transformPorTipo("moto");

      // Garantia explícita: nunca devemos devolver `format: "webp"` (não
      // existe na API) nem `format: "origin"` (desligaria a otimização).
      expect(result).not.toHaveProperty("format");
    });
  });

  describe('"status" (galeria em grid 3×3, sem cover)', () => {
    it("retorna opções com width 400 e quality 70, sem cover", () => {
      const result = transformPorTipo("status");

      expect(result).toEqual({
        width: 400,
        quality: 70,
      });
    });

    it("não inclui resize nem height", () => {
      const result = transformPorTipo("status");

      expect(result).not.toHaveProperty("resize");
      expect(result).not.toHaveProperty("height");
    });
  });

  describe('"documento" (manter original)', () => {
    it("retorna undefined — sem transformação", () => {
      expect(transformPorTipo("documento")).toBeUndefined();
    });
  });

  describe("fallback seguro para valores desconhecidos", () => {
    it('retorna undefined para string vazia', () => {
      expect(transformPorTipo("")).toBeUndefined();
    });

    it("retorna undefined para uma string desconhecida", () => {
      expect(transformPorTipo("desconhecido")).toBeUndefined();
    });

    it("retorna undefined para tipo que parece mas não é válido", () => {
      // Caixa diferente: o switch/if deve ser estrito, não fazer match
      // case-insensitive — isso seria uma mutação perigosa.
      expect(transformPorTipo("MOTO")).toBeUndefined();
      expect(transformPorTipo("Moto")).toBeUndefined();
    });
  });
});
