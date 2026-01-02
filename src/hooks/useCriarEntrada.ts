import { useState, useMemo } from "react";
import { CriarEntradaUseCase } from "@/domain/usecases/CriarEntradaUseCase";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { DadosCadastro } from "@shared/types";

export function useCriarEntrada(
  clienteRepo: ClienteRepository,
  motoRepo: MotoRepository,
  entradaRepo: EntradaRepository,
  orcamentoRepo: OrcamentoRepository,
  tipoServicoRepo: TipoServicoRepository
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new CriarEntradaUseCase(clienteRepo, motoRepo, entradaRepo, orcamentoRepo, tipoServicoRepo),
    [clienteRepo, motoRepo, entradaRepo, orcamentoRepo, tipoServicoRepo]
  );

  const criar = async (dados: DadosCadastro) => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await useCase.execute(dados);
      return resultado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao criar entrada";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { criar, loading, error };
}

