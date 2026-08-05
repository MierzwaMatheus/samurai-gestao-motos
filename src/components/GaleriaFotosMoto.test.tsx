import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import GaleriaFotosMoto from "@/components/GaleriaFotosMoto";
import type { Foto } from "@shared/types";

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
    data: { signedUrl: "https://signed.example/thumb.jpg" },
    error: null,
  });

  mockedFrom.mockReturnValue({ createSignedUrl } as never);

  return { createSignedUrl };
};

/**
 * Constrói uma Foto mínima para uso nos testes. Recebe paths separados para
 * thumbPath e fullPath (cada um opcional) e devolve um objeto Foto com os
 * campos obrigatórios preenchidos.
 */
const buildFoto = (params: {
  url: string;
  thumbPath?: string | null;
  fullPath?: string | null;
  id?: string;
  entradaId?: string;
}): Foto => ({
  id: params.id ?? "foto-id",
  entradaId: params.entradaId ?? "entrada-id",
  url: params.url,
  thumbPath: params.thumbPath ?? null,
  fullPath: params.fullPath ?? null,
  tipo: "moto",
  criadoEm: new Date("2025-01-01T12:00:00Z"),
});

beforeEach(() => {
  vi.clearAllMocks();
  _clearUrlCache();
  modalSpy.mockClear();
});

describe("GaleriaFotosMoto", () => {
  it("chama createSignedUrl com (thumbPath, 3600) quando thumbPath existe", async () => {
    const { createSignedUrl } = buildBucket();

    const foto: Foto = buildFoto({
      url: "user/entrada/moto/full.jpg",
      thumbPath: "user/entrada/moto/thumb.jpg",
    });
    render(<GaleriaFotosMoto fotos={[foto]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    // O thumb (galeria) usa o thumbPath
    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/thumb.jpg",
      3600
    );
    expect(createSignedUrl.mock.calls[0]).toHaveLength(2);
  });

  it("aponta para o bucket 'fotos' do Supabase", async () => {
    const { createSignedUrl } = buildBucket();

    const foto: Foto = buildFoto({
      url: "user/entrada/moto/full.jpg",
      thumbPath: "user/entrada/moto/thumb.jpg",
    });
    render(<GaleriaFotosMoto fotos={[foto]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(mockedFrom).toHaveBeenCalledWith("fotos");
  });

  it("cai no url (signed) quando thumbPath é null — fallback para fotos legadas", async () => {
    // Cobre o ramo CRÍTICO: `foto.thumbPath ?? foto.url` quando thumbPath
    // é null. Sem essa fallback, fotos legadas (sem thumb_path no banco)
    // ficariam sem imagem na galeria.
    const { createSignedUrl } = buildBucket();

    const fotoLegada: Foto = buildFoto({
      url: "user/entrada/moto/legada.jpg",
      thumbPath: null,
    });
    render(<GaleriaFotosMoto fotos={[fotoLegada]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    expect(createSignedUrl).toHaveBeenCalledWith(
      "user/entrada/moto/legada.jpg",
      3600
    );
  });

  it("não chama createSignedUrl quando thumbPath é uma URL completa (já assinada)", async () => {
    const { createSignedUrl } = buildBucket();

    const foto: Foto = buildFoto({
      url: "user/entrada/moto/full.jpg",
      thumbPath: "https://already-signed.example/thumb.jpg",
    });
    render(<GaleriaFotosMoto fotos={[foto]} />);

    await waitFor(() => {
      expect(createSignedUrl).not.toHaveBeenCalled();
    });
  });

  it("retorna null quando fotos está vazio (boundary)", async () => {
    const { container } = render(<GaleriaFotosMoto fotos={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("passa Foto[] completa para o modal (issue #13: modal assina fullPath internamente)", async () => {
    // Após issue #13: a galeria não monta mais `urlsParaModal` (string[]).
    // O modal recebe `Foto[]` com thumbPath/fullPath como paths crus
    // (ou signed URLs) e ele próprio decide o que assinar sob demanda.
    const { createSignedUrl } = buildBucket();

    const fotos: Foto[] = [
      buildFoto({
        id: "1",
        url: "user/entrada/moto/full1.jpg",
        thumbPath: "user/entrada/moto/thumb1.jpg",
      }),
      buildFoto({
        id: "2",
        url: "user/entrada/moto/full2.jpg",
        thumbPath: "https://already-signed.example/thumb2.jpg",
      }),
      buildFoto({
        id: "3",
        url: "user/entrada/moto/legada3.jpg",
        thumbPath: null,
      }),
    ];

    render(<GaleriaFotosMoto fotos={fotos} />);

    await waitFor(() => {
      // 2 chamadas signed: thumb1 e legado3 (url)
      expect(createSignedUrl).toHaveBeenCalledTimes(2);
    });

    // Modal recebe a Foto[] intacta — sem transformação pra string[].
    expect(modalSpy).toHaveBeenCalled();
    const props = modalSpy.mock.calls.at(-1)?.[0] as {
      fotos: Foto[];
    };
    expect(props).toBeDefined();
    expect(props.fotos).toHaveLength(3);
    // As URLs no objeto Foto permanecem como paths crus / signed URLs
    // originais — o modal que decide o que assinar para fullPath.
    expect(props.fotos[0]).toEqual(
      expect.objectContaining({
        id: "1",
        url: "user/entrada/moto/full1.jpg",
        thumbPath: "user/entrada/moto/thumb1.jpg",
      })
    );
    expect(props.fotos[1]).toEqual(
      expect.objectContaining({
        id: "2",
        thumbPath: "https://already-signed.example/thumb2.jpg",
      })
    );
    expect(props.fotos[2]).toEqual(
      expect.objectContaining({
        id: "3",
        url: "user/entrada/moto/legada3.jpg",
        thumbPath: null,
      })
    );
  });

  it("passa Foto[] sem transformação quando thumbPath é URL completa (issue #13)", async () => {
    // Mata o mutante de LogicalOperator em GaleriaFotosMoto.tsx:32
    // (`??` → `&&`). Quando thumbPath já é uma URL completa (http) e
    // `url` aponta para um path distinto, o operador correto é `??`:
    // o thumbPath vence e o url fica só como fallback de thumbPath.
    const { createSignedUrl } = buildBucket();

    const fotos: Foto[] = [
      buildFoto({
        id: "1",
        url: "user/entrada/moto/legado.jpg",
        thumbPath: "https://already-signed.example/thumb1.jpg",
      }),
    ];

    render(<GaleriaFotosMoto fotos={fotos} />);

    await waitFor(() => {
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    expect(modalSpy).toHaveBeenCalled();
    const props = modalSpy.mock.calls.at(-1)?.[0] as {
      fotos: Foto[];
    };
    expect(props).toBeDefined();
    // thumbPath é http → urls[0] é setado para o thumbPath original;
    // modal recebe a Foto com ambos os campos preservados.
    expect(props.fotos[0]).toEqual(
      expect.objectContaining({
        id: "1",
        thumbPath: "https://already-signed.example/thumb1.jpg",
        url: "user/entrada/moto/legado.jpg",
      })
    );
    expect(props.fotos[0].thumbPath).not.toBe("user/entrada/moto/legado.jpg");
  });

  it("tolerância a falhas: quando createSignedUrl rejeita, urls[index] fica undefined (thumb) sem quebrar a galeria (issue #13)", async () => {
    // Antes da issue #13: Promise.all rejeitava e a galeria inteira
    // ficava sem thumbs renderizados. Depois: Promise.allSettled + a
    // foto problemática fica com `urls[index] === undefined` e o
    // `<img>` cai no placeholder (Image icon). As outras fotos
    // renderizam normalmente.
    const createSignedUrl = vi.fn().mockRejectedValue(new Error("rede off"));
    mockedFrom.mockReturnValue({ createSignedUrl } as never);

    const fotos: Foto[] = [
      buildFoto({
        id: "1",
        url: "user/entrada/moto/legado.jpg",
        thumbPath: "user/entrada/moto/thumb1.jpg",
      }),
    ];

    render(<GaleriaFotosMoto fotos={fotos} />);

    // Espera o useEffect tentar assinar
    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });

    // Modal continua recebendo a Foto[] intacta — é a galeria que
    // decide se o thumb renderiza (via `urls[index]`). Quando cai
    // o reject, a galeria renderiza o placeholder.
    expect(modalSpy).toHaveBeenCalled();
    const props = modalSpy.mock.calls.at(-1)?.[0] as {
      fotos: Foto[];
    };
    expect(props).toBeDefined();
    expect(props.fotos[0]).toEqual(
      expect.objectContaining({
        id: "1",
        thumbPath: "user/entrada/moto/thumb1.jpg",
        url: "user/entrada/moto/legado.jpg",
      })
    );
  });

  it("usa o id (não o index) como key do botão — fotos com id duplicado disparam warning do React", () => {
    // Mata o mutante de LogicalOperator em GaleriaFotosMoto.tsx:72
    // (`key={foto.id ?? index}` → `key={foto.id && index}`). Quando
    // duas fotos têm o MESMO id, o `key` original repete o id e o
    // React dispara um warning de "duplicate key". Com o mutante
    // `&&`, o key vira o `index` (único por iteração) e o warning
    // não acontece. Espiamos `console.error` para detectar o aviso.
    buildBucket();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const fotos: Foto[] = [
      buildFoto({ id: "dup", url: "u/1.jpg", thumbPath: "u/t1.jpg" }),
      buildFoto({
        id: "dup",
        url: "u/2.jpg",
        thumbPath: "u/t2.jpg",
        entradaId: "entrada-id",
      }),
    ];

    render(<GaleriaFotosMoto fotos={fotos} />);

    // Stryker mutante `&&`: keys = 0, 1 → sem warning.
    // Original: keys = "dup", "dup" → warning "Encountered two
    // children with the same key, `dup`".
    const mensagens = errorSpy.mock.calls.flat().map(String).join(" ");
    expect(mensagens).toMatch(/same key|duplicate key/i);

    errorSpy.mockRestore();
  });
});