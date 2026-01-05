import { useState, useEffect } from "react";
import { BuscarConfiguracaoFreteUseCase } from "@/domain/usecases/BuscarConfiguracaoFreteUseCase";
import { AtualizarConfiguracaoFreteUseCase } from "@/domain/usecases/AtualizarConfiguracaoFreteUseCase";
import { ConfiguracaoFrete } from "@shared/types";

/**
 * Hook como adaptador entre React e os casos de uso de configuração de frete
 * Segue o princípio de Inversão de Dependência
 */
export function useConfiguracaoFrete(
  buscarUseCase: BuscarConfiguracaoFreteUseCase,
  atualizarUseCase: AtualizarConfiguracaoFreteUseCase
) {
  const [loading, setLoading] = useState(false);
  const [loadingBuscar, setLoadingBuscar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoFrete | null>(null);

  const buscar = async () => {
    setLoadingBuscar(true);
    setError(null);

    try {
      const resultado = await buscarUseCase.execute();
      setConfiguracao(resultado);
      return resultado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao buscar configuração";
      setError(mensagem);
      throw err;
    } finally {
      setLoadingBuscar(false);
    }
  };

  const atualizar = async (dados: { cepOrigem: string; valorPorKm: number }) => {
    setLoading(true);
    setError(null);

    try {
      const resultado = await atualizarUseCase.execute(dados);
      setConfiguracao(resultado);
      return resultado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao atualizar configuração";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscar();
  }, []);

  return {
    configuracao,
    buscar,
    atualizar,
    loading,
    loadingBuscar,
    error,
  };
}



