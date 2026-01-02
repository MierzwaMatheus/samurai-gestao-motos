import { useState } from "react";
import { AtualizarProgressoStatusUseCase } from "@/domain/usecases/AtualizarProgressoStatusUseCase";

export function useAtualizarProgressoStatus(useCase: AtualizarProgressoStatusUseCase) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atualizar = async (
    entradaId: string,
    dados: {
      progresso?: number;
      status?: "pendente" | "alinhando" | "concluido";
    }
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await useCase.execute(entradaId, dados);
      return true;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao atualizar";
      setError(mensagem);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { atualizar, loading, error };
}


