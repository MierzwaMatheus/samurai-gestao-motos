import { useState } from "react";
import { BuscarEnderecoPorCepUseCase } from "@/domain/usecases/BuscarEnderecoPorCepUseCase";
import { Endereco } from "@shared/types";

/**
 * Hook como adaptador entre React e o caso de uso
 * Segue o princípio de Inversão de Dependência
 */
export function useBuscarCep(useCase: BuscarEnderecoPorCepUseCase) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endereco, setEndereco] = useState<Endereco | null>(null);

  const buscar = async (cep: string) => {
    setLoading(true);
    setError(null);
    setEndereco(null);

    try {
      const resultado = await useCase.execute(cep);
      setEndereco(resultado);
      return resultado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao buscar CEP";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    buscar,
    loading,
    error,
    endereco,
  };
}


