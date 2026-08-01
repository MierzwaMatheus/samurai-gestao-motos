/**
 * Geração de variantes webp (thumb e full) a partir de um `File`.
 *
 * A integração com Canvas vive em um `ImageVariantsProcessor` injetável:
 * por padrão usamos o `defaultProcessor` (Canvas + `createImageBitmap` no
 * browser); em testes passamos um dublê para evitar a dependência do
 * DOM/Canvas.
 */

export type ResizeFit = "cover" | "contain";

export interface ResizeOptions {
  /** Largura máxima em pixels (bound da variante). */
  maxWidth: number;
  /** Altura máxima em pixels (bound da variante). */
  maxHeight: number;
  /** Qualidade do webp (0..1). */
  quality: number;
  /** Modo de ajuste: `cover` preenche cortando; `contain` cabe dentro. */
  fit: ResizeFit;
  /** MIME do arquivo gerado (sempre `image/webp` por padrão). */
  mimeType: "image/webp";
}

export interface ImageVariantsProcessor {
  resizeToWebp(file: File, opts: ResizeOptions): Promise<File>;
}

export interface Variantes {
  thumb: File;
  full: File;
}

/** Opções da variante thumb (galeria). */
const THUMB_OPTS: ResizeOptions = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.7,
  fit: "cover",
  mimeType: "image/webp",
};

/** Opções da variante full (modal/PDF). */
const FULL_OPTS: ResizeOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
  fit: "contain",
  mimeType: "image/webp",
};

/**
 * Processador default baseado em Canvas. Roda exclusivamente no browser
 * — fora dali (jsdom, Node sem polyfill) joga `Error`. Para testes,
 * passe um `ImageVariantsProcessor` próprio via segundo argumento.
 */
export const defaultProcessor: ImageVariantsProcessor = {
  async resizeToWebp(file, opts) {
    if (typeof document === "undefined") {
      throw new Error(
        "imageVariants: defaultProcessor exige ambiente browser (Canvas)"
      );
    }

    const bitmap = await createImageBitmap(file);
    try {
      const ratio = bitmap.width / bitmap.height;
      let targetW = opts.maxWidth;
      let targetH = opts.maxHeight;
      if (opts.fit === "cover") {
        // Cobre o bound cortando o excesso.
        if (ratio > 1) {
          targetH = opts.maxHeight;
          targetW = opts.maxHeight * ratio;
        } else {
          targetW = opts.maxWidth;
          targetH = opts.maxWidth / ratio;
        }
      } else {
        // contain: cabe dentro sem cortar.
        if (ratio > 1) {
          targetW = opts.maxWidth;
          targetH = opts.maxWidth / ratio;
        } else {
          targetH = opts.maxHeight;
          targetW = opts.maxHeight * ratio;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(targetW);
      canvas.height = Math.round(targetH);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("imageVariants: Canvas 2D context indisponível");
      }

      // cover: pintar fundo para tapar a área que sobrar (não acontece
      // aqui porque targetW/H >= bound); contain: idem.
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, opts.mimeType, opts.quality)
      );
      if (!blob) {
        throw new Error("imageVariants: Canvas não produziu blob webp");
      }

      // Preserva o nome original trocando só a extensão para `.webp`.
      const baseName = file.name.replace(/\.[^.]+$/, "");
      return new File([blob], `${baseName}.webp`, {
        type: opts.mimeType,
        lastModified: file.lastModified,
      });
    } finally {
      bitmap.close();
    }
  },
};

/**
 * Gera as duas variantes webp a partir de um `File`.
 *
 * `Promise.all` garante que as duas chamadas ao processor rodem em
 * paralelo — Stryker muta isso por chamadas sequenciais.
 */
export async function gerarVariantes(
  file: File,
  processor: ImageVariantsProcessor = defaultProcessor
): Promise<Variantes> {
  const [thumb, full] = await Promise.all([
    processor.resizeToWebp(file, THUMB_OPTS),
    processor.resizeToWebp(file, FULL_OPTS),
  ]);
  // Validação defensiva: o Canvas do browser pode devolver um Blob
  // com `type: "image/webp"` mas `size: 0` para imagens inválidas /
  // corrompidas / em formato não-suportado. Sem esse check, o
  // `File([blob], ...)` viraria um arquivo de 0 bytes que o
  // Supabase Storage rejeita silenciosamente com HTTP 400.
  if (thumb.size === 0) {
    throw new Error(
      `imageVariants: thumb webp vazio (0 bytes) ao processar ${file.name}`
    );
  }
  if (full.size === 0) {
    throw new Error(
      `imageVariants: full webp vazio (0 bytes) ao processar ${file.name}`
    );
  }
  return { thumb, full };
}