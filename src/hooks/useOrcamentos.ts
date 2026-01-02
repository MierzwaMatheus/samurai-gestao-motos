import { useState, useEffect, useMemo } from "react";
import { ListarOrcamentosUseCase } from "@/domain/usecases/ListarOrcamentosUseCase";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { OrcamentoCompleto } from "@shared/types";

export function useOrcamentos(
  orcamentoRepo: OrcamentoRepository,
  status: "ativo" | "expirado" | "convertido",
  tipoServicoRepo?: TipoServicoRepository
) {
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
      
      // Busca tipos de serviço para cada orçamento se o repositório estiver disponível
      if (tipoServicoRepo) {
        const dadosComTiposServico = await Promise.all(
          dados.map(async (orcamento) => {
            try {
              const tiposServico = await tipoServicoRepo.buscarPorEntradaId(orcamento.entradaId);
              return { ...orcamento, tiposServico };
            } catch (error) {
              console.error(`Erro ao buscar tipos de serviço para entrada ${orcamento.entradaId}:`, error);
              return { ...orcamento, tiposServico: [] };
            }
          })
        );
        setOrcamentos(dadosComTiposServico);
      } else {
        setOrcamentos(dados);
      }
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

  const atualizarOrcamento = (orcamentoId: string, atualizacoes: Partial<OrcamentoCompleto>) => {
    setOrcamentos((prevOrcamentos) =>
      prevOrcamentos.map((orcamento) =>
        orcamento.id === orcamentoId ? { ...orcamento, ...atualizacoes } : orcamento
      )
    );
  };

  const removerOrcamento = (orcamentoId: string) => {
    setOrcamentos((prevOrcamentos) =>
      prevOrcamentos.filter((orcamento) => orcamento.id !== orcamentoId)
    );
  };

  return { orcamentos, loading, error, recarregar: carregar, atualizarOrcamento, removerOrcamento };
}

