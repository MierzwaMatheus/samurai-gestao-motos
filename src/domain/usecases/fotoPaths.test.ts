import { describe, expect, it, vi } from "vitest";

import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { StorageApi } from "@/domain/interfaces/StorageApi";
import { AdicionarFotoStatusUseCase } from "@/domain/usecases/AdicionarFotoStatusUseCase";
import { UploadFotoUseCase } from "@/domain/usecases/UploadFotoUseCase";
import { Entrada, Foto } from "@shared/types";

const buildStorageApi = (
  overrides: Partial<StorageApi> = {}
): StorageApi => ({
  uploadFoto: vi.fn().mockResolvedValue({
    thumbPath: "entrada-1/status/thumb.webp",
    fullPath: "entrada-1/status/full.webp",
  }),
  deletarFoto: vi.fn(),
  obterUrlPublica: vi.fn(),
  obterUrlAssinada: vi.fn().mockResolvedValue("https://signed.example/full.webp"),
  // Ciclo 3: helper central. Para `status` retorna public URL.
  obterUrlParaFoto: vi
    .fn()
    .mockImplementation(
      async (path: string, tipo: "moto" | "status" | "documento") =>
        tipo === "documento"
          ? `https://signed.example/${path}`
          : `https://public.example/${path}`
    ),
  consultarEspacoBucket: vi.fn(),
  listarArquivosPorPeriodo: vi.fn(),
  deletarArquivosPorPeriodo: vi.fn(),
  ...overrides,
});

const buildFoto = (overrides: Partial<Foto> = {}): Foto => ({
  id: "foto-1",
  entradaId: "entrada-1",
  url: "entrada-1/moto/full.webp",
  thumbPath: "entrada-1/moto/thumb.webp",
  fullPath: "entrada-1/moto/full.webp",
  tipo: "moto",
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

const buildFotoRepository = (
  overrides: Partial<FotoRepository> = {}
): FotoRepository => ({
  criar: vi.fn().mockResolvedValue(buildFoto()),
  buscarPorId: vi.fn(),
  buscarPorEntradaId: vi.fn(),
  buscarPorEntradaIdETipo: vi.fn(),
  deletar: vi.fn(),
  ...overrides,
});

const buildEntrada = (overrides: Partial<Entrada> = {}): Entrada => ({
  id: "entrada-1",
  tipo: "entrada",
  clienteId: "cliente-1",
  motoId: "moto-1",
  frete: null,
  status: "alinhando",
  progresso: 40,
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  atualizadoEm: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

const buildEntradaRepository = (
  entrada: Entrada,
  overrides: Partial<EntradaRepository> = {}
): EntradaRepository => ({
  criar: vi.fn(),
  buscarPorId: vi.fn().mockResolvedValue(entrada),
  buscarPorClienteId: vi.fn(),
  buscarPorMotoId: vi.fn(),
  buscarPorStatus: vi.fn(),
  listar: vi.fn(),
  atualizar: vi.fn().mockResolvedValue(entrada),
  deletar: vi.fn(),
  buscarPagina: vi.fn(),
  ...overrides,
});

describe("propagação das variantes de foto", () => {
  it("persiste thumbPath e fullPath ao fazer upload de uma foto", async () => {
    const storageApi = buildStorageApi({
      uploadFoto: vi.fn().mockResolvedValue({
        thumbPath: "entrada-1/moto/thumb.webp",
        fullPath: "entrada-1/moto/full.webp",
      }),
    });
    const fotoCriada = buildFoto();
    const fotoRepo = buildFotoRepository({
      criar: vi.fn().mockResolvedValue(fotoCriada),
    });
    const file = new File(["foto"], "foto.jpg", { type: "image/jpeg" });

    const resultado = await new UploadFotoUseCase(storageApi, fotoRepo).execute(
      file,
      "entrada-1",
      "moto"
    );

    expect(fotoRepo.criar).toHaveBeenCalledWith({
      entradaId: "entrada-1",
      url: "entrada-1/moto/full.webp",
      thumbPath: "entrada-1/moto/thumb.webp",
      fullPath: "entrada-1/moto/full.webp",
      tipo: "moto",
    });
    expect(resultado).toEqual(fotoCriada);
  });

  it("persiste e retorna as duas variantes ao adicionar foto de status", async () => {
    const storageApi = buildStorageApi();
    const fotoAnterior = {
      url: "entrada-1/status/anterior.webp",
      data: new Date("2026-01-01T00:00:00Z"),
      progresso: 20,
    };
    const entrada = buildEntrada({ fotosStatus: [fotoAnterior] });
    const entradaRepo = buildEntradaRepository(entrada);
    const file = new File(["foto"], "status.jpg", { type: "image/jpeg" });

    const resultado = await new AdicionarFotoStatusUseCase(
      entradaRepo,
      storageApi
    ).execute("entrada-1", file, "Serviço iniciado", 60);

    const novaFotoPersistida = {
      url: "entrada-1/status/full.webp",
      thumbPath: "entrada-1/status/thumb.webp",
      fullPath: "entrada-1/status/full.webp",
      data: expect.any(Date),
      observacao: "Serviço iniciado",
      progresso: 60,
    };
    expect(entradaRepo.atualizar).toHaveBeenCalledWith("entrada-1", {
      fotosStatus: [fotoAnterior, novaFotoPersistida],
      progresso: 60,
    });
    // Ciclo 3: usa obterUrlParaFoto(path, "status") → public URL.
    expect(storageApi.obterUrlParaFoto).toHaveBeenCalledWith(
      "entrada-1/status/full.webp",
      "status"
    );
    expect(storageApi.obterUrlAssinada).not.toHaveBeenCalled();
    expect(resultado).toEqual({
      ...novaFotoPersistida,
      url: "https://public.example/entrada-1/status/full.webp",
    });
  });
});
