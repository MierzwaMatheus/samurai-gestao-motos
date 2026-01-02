import { useState } from "react";
import { CalcularFreteUseCase } from "@/domain/usecases/CalcularFreteUseCase";

interface ResultadoFrete {
  distanciaKm: number;
  valorFrete: number;
  cepOrigem: string;
  cepDestino: string;
}

/**
 * Hook como adaptador entre React e o caso de uso de cálculo de frete
 * Segue o princípio de Inversão de Dependência
 */
export function useCalcularFrete(useCase: CalcularFreteUseCase) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoFrete | null>(null);

  const calcular = async (cepDestino: string) => {
    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const resultadoCalculado = await useCase.execute(cepDestino);
      setResultado(resultadoCalculado);
      return resultadoCalculado;
    } catch (err) {
      const mensagem =
        err instanceof Error ? err.message : "Erro ao calcular frete";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    calcular,
    loading,
    error,
    resultado,
  };
}


