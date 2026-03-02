import { useState, useMemo } from "react";
import { AtualizarEntradaUseCase } from "@/domain/usecases/AtualizarEntradaUseCase";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { DadosCadastro } from "@shared/types";
import { HistoricoRepository } from "@/infrastructure/repositories/SupabaseHistoricoRepository";

export function useAtualizarEntrada(
  clienteRepo: ClienteRepository,
  motoRepo: MotoRepository,
  entradaRepo: EntradaRepository,
  orcamentoRepo: OrcamentoRepository,
  tipoServicoRepo: TipoServicoRepository,
  servicoPersonalizadoRepo: ServicoPersonalizadoRepository,
  historicoRepo: HistoricoRepository
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () =>
      new AtualizarEntradaUseCase(
        clienteRepo,
        motoRepo,
        entradaRepo,
        orcamentoRepo,
        tipoServicoRepo,
        servicoPersonalizadoRepo,
        historicoRepo
      ),
    [
      clienteRepo,
      motoRepo,
      entradaRepo,
      orcamentoRepo,
      tipoServicoRepo,
      servicoPersonalizadoRepo,
      historicoRepo,
    ]
  );

  const atualizar = async (entradaId: string, dados: DadosCadastro) => {
    setLoading(true);
    setError(null);
    try {
      await useCase.execute(entradaId, dados);
    } catch (err) {
      const mensagem =
        err instanceof Error ? err.message : "Erro ao atualizar entrada";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { atualizar, loading, error };
}
