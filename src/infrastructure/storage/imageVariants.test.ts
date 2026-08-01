import { describe, it, expect, vi } from "vitest";

import {
  gerarVariantes,
  type ImageVariantsProcessor,
} from "@/infrastructure/storage/imageVariants";

/**
 * `gerarVariantes` orquestra a criação de duas variantes webp (thumb e
 * full) com base em um `File`. Para manter o módulo testável fora do
 * browser, a integração com Canvas é feita por trás de uma interface
 * `ImageVariantsProcessor` injetada.
 */
describe("gerarVariantes", () => {
  const buildFile = (): File =>
    new File(["conteudo-de-teste"], "foto.jpg", { type: "image/jpeg" });

  const buildProcessorMock = (
    overrides: Partial<ImageVariantsProcessor> = {}
  ): ImageVariantsProcessor => {
    const thumb = new File(["thumb"], "thumb.webp", { type: "image/webp" });
    const full = new File(["full"], "full.webp", { type: "image/webp" });
    return {
      resizeToWebp: vi.fn(async () => thumb),
      ...overrides,
    } as unknown as ImageVariantsProcessor;
  };

  it("devolve um objeto com `thumb` e `full`", async () => {
    const processor = buildProcessorMock();

    const { thumb, full } = await gerarVariantes(buildFile(), processor);

    expect(thumb).toBeInstanceOf(File);
    expect(full).toBeInstanceOf(File);
  });

  it("gera a thumb com 400x400 cover q70 (image/webp)", async () => {
    const processor = buildProcessorMock();

    await gerarVariantes(buildFile(), processor);

    expect(processor.resizeToWebp).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.7,
        fit: "cover",
        mimeType: "image/webp",
      })
    );
  });

  it("gera a full com 1600x1600 max q80 (image/webp)", async () => {
    const processor = buildProcessorMock();

    await gerarVariantes(buildFile(), processor);

    // A 2ª chamada é a variante `full`. Stryker muta a ordem das
    // chamadas — sem essa asserção, um mutante que troca thumb/full
    // sobrevive.
    const calls = (processor.resizeToWebp as ReturnType<typeof vi.fn>).mock
      .calls;
    const fullCall = calls[1];
    expect(fullCall[1]).toEqual(
      expect.objectContaining({
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        fit: "contain",
        mimeType: "image/webp",
      })
    );
  });

  it("dispara thumb e full em paralelo via Promise.all", async () => {
    // Stryker muta `await Promise.all([...])` por chamadas sequenciais.
    // Sem essa asserção, o mutante faz upload das 2 variantes em série.
    const ordemDeInicio: string[] = [];
    const processor: ImageVariantsProcessor = {
      resizeToWebp: vi.fn(async (_file, opts) => {
        ordemDeInicio.push(opts.fit);
        // devolve arquivos diferentes para que o teste distinga as
        // variantes.
        return new File([opts.fit], `${opts.fit}.webp`, {
          type: "image/webp",
        });
      }),
    };

    const { thumb, full } = await gerarVariantes(buildFile(), processor);

    // Ambas devem ter sido iniciadas antes da resolução do Promise.all.
    expect(ordemDeInicio).toContain("cover");
    expect(ordemDeInicio).toContain("contain");
    expect(thumb.name).toBe("cover.webp");
    expect(full.name).toBe("contain.webp");
  });

  it("repassa o `file` original ao processor sem alterá-lo", async () => {
    const processor = buildProcessorMock();
    const original = buildFile();

    await gerarVariantes(original, processor);

    const [recebido] = (processor.resizeToWebp as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(recebido).toBe(original);
  });
});