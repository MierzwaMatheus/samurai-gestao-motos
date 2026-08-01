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

  it("passa urlsParaModal com signed URL do thumb e fallback para thumbPath original", async () => {
    // O modal recebe `urlsParaModal` calculado no pai. Para cada foto, o
    // modal recebe a URL assinada do thumb (ou o thumbPath original se já
    // for URL completa). O fallback cobre fotos sem signed URL.
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

    // Modal foi renderizado (a spy capturou as props) com `urlsParaModal`.
    expect(modalSpy).toHaveBeenCalled();
    const props = modalSpy.mock.calls.at(-1)?.[0] as {
      fotos: string[];
    };
    expect(props).toBeDefined();
    expect(props.fotos).toHaveLength(3);
    // Índice 0: signed URL do thumb1 gerada pelo Supabase
    expect(props.fotos[0]).toBe("https://signed.example/thumb.jpg");
    // Índice 1: thumbPath original (já começa com http, não foi assinado)
    expect(props.fotos[1]).toBe("https://already-signed.example/thumb2.jpg");
    // Índice 2: signed URL do url (foto legada, sem thumbPath)
    expect(props.fotos[2]).toBe("https://signed.example/thumb.jpg");
  });
});