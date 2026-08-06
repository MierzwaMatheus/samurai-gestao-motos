import { describe, it, expect } from "vitest";

import { gerarOSPDF } from "@/utils/gerarOSPDF";

/**
 * O `gerarOSPDF` é uma função pura que recebe dados (já com URLs
 * resolvidas) e devolve um Blob HTML. Após o ciclo 3 (issue #13), a
 * camada que produz os dados (`GerarOSUseCase`) é responsável por
 * resolver URLs via `obterUrlParaFoto` (public para moto/status,
 * signed para documento). O utilitário NÃO deve fazer chamadas ao
 * Storage — apenas embute as URLs recebidas nos `<img>`.
 */
describe("gerarOSPDF — ciclo 3 (URLs já resolvidas pelo use case)", () => {
  it("embute a URL pública de moto no <img> sem tentar assinar", async () => {
    const dados = {
      entrada: {
        id: "entrada-1",
        tipo: "entrada",
        frete: null,
      },
      cliente: { nome: "Cliente Teste", telefone: "11999" },
      moto: { modelo: "CB 500" },
      fotos: [
        // URL pública (moto) — já resolvida por obterUrlParaFoto.
        // Antes do ciclo 3, vinha como signed URL com TTL 1h.
        { url: "https://public.example/entrada-1/moto/full.webp", tipo: "moto" },
      ],
    };

    const blob = await gerarOSPDF(dados as never);
    const html = await blob.text();

    // A URL pública aparece no <img src>.
    expect(html).toContain('src="https://public.example/entrada-1/moto/full.webp"');
    // E NÃO deve haver chamada a /sign/ (que era o padrão antes — signed URL).
    expect(html).not.toContain("/storage/v1/object/sign/");
  });

  it("embute a URL pública de status no <img> (galeria de serviço)", async () => {
    const dados = {
      entrada: {
        id: "entrada-1",
        tipo: "entrada",
        frete: null,
      },
      cliente: { nome: "Cliente", telefone: "11999" },
      moto: { modelo: "CB 500" },
      fotos: [
        // Status: URL pública (ciclo 3 mudou de signed para public).
        { url: "https://public.example/entrada-1/status/full.webp", tipo: "status" },
      ],
    };

    const blob = await gerarOSPDF(dados as never);
    const html = await blob.text();

    expect(html).toContain('src="https://public.example/entrada-1/status/full.webp"');
    expect(html).not.toContain("/storage/v1/object/sign/");
  });

  it("preserva URL signed de documento no <img> (dados sensíveis mantêm TTL 1h)", async () => {
    const dados = {
      entrada: {
        id: "entrada-1",
        tipo: "entrada",
        frete: null,
      },
      cliente: { nome: "Cliente", telefone: "11999" },
      moto: { modelo: "CB 500" },
      fotos: [
        // Documento: signed URL (TTL 1h) — manter.
        {
          url: "https://signed.example/entrada-1/documento/cnh.jpg?token=abc",
          tipo: "documento",
        },
      ],
    };

    const blob = await gerarOSPDF(dados as never);
    const html = await blob.text();

    expect(html).toContain(
      'src="https://signed.example/entrada-1/documento/cnh.jpg?token=abc"'
    );
  });

  it("renderiza estrutura mínima: cabeçalho + cliente + moto + fotos", async () => {
    const dados = {
      entrada: {
        id: "abcdef12-3456",
        tipo: "entrada",
        frete: 10,
        dataConclusao: new Date("2025-01-15"),
      },
      cliente: {
        nome: "João da Silva",
        telefone: "11999990000",
        endereco: "Rua A, 123",
      },
      moto: {
        modelo: "CB 500",
        placa: "ABC1D23",
        marca: "Honda",
        cilindrada: "500",
        ano: "2020",
        finalNumeroQuadro: "12345",
      },
      fotos: [
        { url: "https://public.example/moto/1.webp", tipo: "moto" },
        { url: "https://public.example/status/1.webp", tipo: "status" },
      ],
    };

    const blob = await gerarOSPDF(dados as never);
    const html = await blob.text();

    // Estrutura básica
    expect(html).toContain("SAMURAI ALINHAMENTO DE MOTOS");
    expect(html).toContain("DADOS DO CLIENTE");
    expect(html).toContain("DADOS DA MOTO");
    expect(html).toContain("REGISTRO FOTOGRÁFICO");
    expect(html).toContain("João da Silva");
    expect(html).toContain("CB 500");
    expect(html).toContain("ABC1D23");

    // Imagens
    expect(html).toContain('src="https://public.example/moto/1.webp"');
    expect(html).toContain('src="https://public.example/status/1.webp"');

    // Numero da OS (8 primeiros chars do id em uppercase)
    expect(html).toContain("ABCDEF12");

    // Retornou blob do tipo text/html
    expect(blob.type).toBe("text/html");
  });
});