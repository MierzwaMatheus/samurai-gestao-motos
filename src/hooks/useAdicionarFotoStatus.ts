import { useState } from "react";
import { AdicionarFotoStatusUseCase } from "@/domain/usecases/AdicionarFotoStatusUseCase";
import { FotoStatus } from "@shared/types";

export function useAdicionarFotoStatus(useCase: AdicionarFotoStatusUseCase) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adicionar = async (
    entradaId: string,
    file: File,
    observacao?: string,
    progresso?: number
  ): Promise<FotoStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const foto = await useCase.execute(entradaId, file, observacao, progresso);
      return foto;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao adicionar foto";
      setError(mensagem);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { adicionar, loading, error };
}


