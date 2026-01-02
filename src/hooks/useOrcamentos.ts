import { useState, useEffect, useMemo } from "react";
import { ListarOrcamentosUseCase } from "@/domain/usecases/ListarOrcamentosUseCase";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { OrcamentoCompleto } from "@shared/types";

export function useOrcamentos(orcamentoRepo: OrcamentoRepository, status: "ativo" | "expirado" | "convertido") {
  const [orcamentos, setOrcamentos] = useState<OrcamentoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new ListarOrcamentosUseCase(orcamentoRepo),
    [orcamentoRepo]
  );

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const dados = await useCase.execute(status);
      setOrcamentos(dados);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao carregar orçamentos";
      setError(mensagem);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return { orcamentos, loading, error, recarregar: carregar };
}

