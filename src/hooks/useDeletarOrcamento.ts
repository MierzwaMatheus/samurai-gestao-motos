import { useState, useMemo } from "react";
import { DeletarOrcamentoUseCase } from "@/domain/usecases/DeletarOrcamentoUseCase";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";

/**
 * Hook para deletar orçamento
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export function useDeletarOrcamento(orcamentoRepo: OrcamentoRepository) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new DeletarOrcamentoUseCase(orcamentoRepo),
    [orcamentoRepo]
  );

  const deletar = async (orcamentoId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await useCase.execute(orcamentoId);
      return true;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao deletar orçamento";
      setError(mensagem);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deletar, loading, error };
}

