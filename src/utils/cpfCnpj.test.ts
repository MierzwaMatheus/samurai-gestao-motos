import { describe, it, expect } from "vitest";

import { validarCpfCnpj, formatarCpfCnpj, mascararCpfCnpjParcial } from "@/utils/cpfCnpj";

/**
 * CPF/CNPJ é um campo OPCIONAL do cliente. As três funções puras aqui
 * cobrem: validação (dígito verificador), máscara progressiva no input
 * e mascaramento parcial para a listagem (só os 3 primeiros dígitos).
 */
describe("validarCpfCnpj", () => {
  it("aceita vazio, pois o campo é opcional", () => {
    expect(validarCpfCnpj("")).toBe(true);
    expect(validarCpfCnpj("   ")).toBe(true);
  });

  it("aceita CPF válido com e sem pontuação", () => {
    expect(validarCpfCnpj("529.982.247-25")).toBe(true);
    expect(validarCpfCnpj("52998224725")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(validarCpfCnpj("529.982.247-26")).toBe(false);
    expect(validarCpfCnpj("111.444.777-36")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos repetidos", () => {
    expect(validarCpfCnpj("000.000.000-00")).toBe(false);
    expect(validarCpfCnpj("111.111.111-11")).toBe(false);
    expect(validarCpfCnpj("99999999999")).toBe(false);
  });

  it("aceita CNPJ válido com e sem pontuação", () => {
    expect(validarCpfCnpj("11.222.333/0001-81")).toBe(true);
    expect(validarCpfCnpj("11222333000181")).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(validarCpfCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos repetidos", () => {
    expect(validarCpfCnpj("11.111.111/1111-11")).toBe(false);
  });

  it("aceita documento cujo dígito verificador é 9 (resto exatamente 2)", () => {
    // Resto 2 é a fronteira do `resto < 2 ? 0 : 11 - resto`: com `<= 2`
    // o dígito viraria 0 e estes documentos seriam recusados.
    expect(validarCpfCnpj("10000000795")).toBe(true);
    expect(validarCpfCnpj("11222333000696")).toBe(true);
  });

  it("aceita documento cujo dígito verificador é 0 (resto menor que 2)", () => {
    // Sem o ramo `resto < 2 ? 0`, o dígito viraria 10 ou 11 e nunca bateria.
    expect(validarCpfCnpj("10000000108")).toBe(true);
    expect(validarCpfCnpj("10000000280")).toBe(true);
    expect(validarCpfCnpj("11222333000009")).toBe(true);
  });

  it("rejeita documento com o primeiro dígito errado mesmo que o segundo seja coerente", () => {
    // Garante que o primeiro dígito verificador é realmente conferido.
    expect(validarCpfCnpj("52998224709")).toBe(false);
    expect(validarCpfCnpj("11222333000106")).toBe(false);
  });

  it("rejeita quantidade de dígitos que não é 11 nem 14", () => {
    expect(validarCpfCnpj("529982247")).toBe(false);
    expect(validarCpfCnpj("529982247250")).toBe(false);
    expect(validarCpfCnpj("112223330001810")).toBe(false);
  });
});

describe("formatarCpfCnpj", () => {
  it("formata progressivamente enquanto o usuário digita um CPF", () => {
    expect(formatarCpfCnpj("529")).toBe("529");
    expect(formatarCpfCnpj("5299")).toBe("529.9");
    expect(formatarCpfCnpj("529982")).toBe("529.982");
    expect(formatarCpfCnpj("5299822")).toBe("529.982.2");
    expect(formatarCpfCnpj("529982247")).toBe("529.982.247");
    expect(formatarCpfCnpj("5299822472")).toBe("529.982.247-2");
    expect(formatarCpfCnpj("52998224725")).toBe("529.982.247-25");
  });

  it("muda para o formato de CNPJ a partir do 12º dígito", () => {
    expect(formatarCpfCnpj("112223330001")).toBe("11.222.333/0001");
    expect(formatarCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("ignora caracteres não numéricos digitados", () => {
    expect(formatarCpfCnpj("529.982.247-25")).toBe("529.982.247-25");
    expect(formatarCpfCnpj("abc529xyz")).toBe("529");
  });

  it("descarta dígitos além do limite de CNPJ", () => {
    expect(formatarCpfCnpj("112223330001819999")).toBe("11.222.333/0001-81");
  });

  it("devolve string vazia quando não há dígitos", () => {
    expect(formatarCpfCnpj("")).toBe("");
    expect(formatarCpfCnpj("abc")).toBe("");
  });
});

describe("mascararCpfCnpjParcial", () => {
  it("revela apenas os 3 primeiros dígitos de um CPF", () => {
    expect(mascararCpfCnpjParcial("529.982.247-25")).toBe("529.***.***-**");
    expect(mascararCpfCnpjParcial("52998224725")).toBe("529.***.***-**");
  });

  it("revela apenas os 3 primeiros dígitos de um CNPJ", () => {
    expect(mascararCpfCnpjParcial("11.222.333/0001-81")).toBe("11.2**.***/****-**");
    expect(mascararCpfCnpjParcial("11222333000181")).toBe("11.2**.***/****-**");
  });

  it("devolve string vazia para valor ausente ou sem dígitos", () => {
    expect(mascararCpfCnpjParcial("")).toBe("");
    expect(mascararCpfCnpjParcial(undefined)).toBe("");
    expect(mascararCpfCnpjParcial("abc")).toBe("");
  });

  it("mascara também documentos com quantidade inesperada de dígitos", () => {
    expect(mascararCpfCnpjParcial("12345")).toBe("123**");
    expect(mascararCpfCnpjParcial("12")).toBe("12");
  });
});
