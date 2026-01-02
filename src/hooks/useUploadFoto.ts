import { useState, useMemo } from "react";
import { UploadFotoUseCase } from "@/domain/usecases/UploadFotoUseCase";
import { StorageApi } from "@/domain/interfaces/StorageApi";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { Foto } from "@shared/types";

export function useUploadFoto(storageApi: StorageApi, fotoRepo: FotoRepository) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new UploadFotoUseCase(storageApi, fotoRepo),
    [storageApi, fotoRepo]
  );

  const upload = async (
    file: File,
    entradaId: string,
    tipo: "moto" | "status" | "documento" = "moto"
  ): Promise<Foto> => {
    setLoading(true);
    setError(null);
    try {
      const foto = await useCase.execute(file, entradaId, tipo);
      return foto;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao fazer upload";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { upload, loading, error };
}

