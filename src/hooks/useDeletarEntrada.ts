import { useState, useMemo } from "react";
import { DeletarEntradaUseCase } from "@/domain/usecases/DeletarEntradaUseCase";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";

/**
 * Hook para deletar entrada
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export function useDeletarEntrada(entradaRepo: EntradaRepository) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new DeletarEntradaUseCase(entradaRepo),
    [entradaRepo]
  );

  const deletar = async (entradaId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await useCase.execute(entradaId);
      return true;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao deletar entrada";
      setError(mensagem);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deletar, loading, error };
}

