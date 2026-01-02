import { useState, useMemo } from "react";
import { AtualizarStatusEntregaUseCase } from "@/domain/usecases/AtualizarStatusEntregaUseCase";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { StorageApi } from "@/domain/interfaces/StorageApi";

export function useAtualizarStatusEntrega(
  entradaRepo: EntradaRepository,
  storageApi: StorageApi
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new AtualizarStatusEntregaUseCase(entradaRepo, storageApi),
    [entradaRepo, storageApi]
  );

  const atualizar = async (
    entradaId: string,
    statusEntrega: "entregue" | "retirado",
    osAssinada?: File
  ) => {
    setLoading(true);
    setError(null);
    try {
      await useCase.execute(entradaId, statusEntrega, osAssinada);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao atualizar status";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { atualizar, loading, error };
}

