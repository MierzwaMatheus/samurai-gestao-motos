import { useState, useRef, useCallback } from "react";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { Orcamento, OrcamentoCompleto } from "@shared/types";

export interface UseOrcamentosOpts {
  page?: number;
  pageSize?: number;
}

/**
 * Hook paginado para listagem de orçamentos.
 *
 * - Aceita `opts.page` / `opts.pageSize` (defaults: 1 / 10).
 * - Retorna `orcamentos`, `total`, `hasMore`, `loading`, `error`,
 *   `carregarMais`, `recarregar`, `atualizarOrcamento`, `removerOrcamento`.
 * - NÃO faz re-fetch de `tiposServico` por entrada: o `buscarPagina()`
 *   do repositório já entrega esse dado em batch (eliminação do N+1
 *   duplicado que existia na versão anterior).
 * - `recarregar()` reseta a paginação para `page=1` (substitui).
 * - `carregarMais()` concatena os itens da próxima página.
 *
 * Padrão de fetch explícito (mesmo de `useRelatorioExcel`): o caller
 * chama `recarregar()` na montagem e após trocar filtros; chama
 * `carregarMais()` no scroll infinito.
 *
 * `tipoServicoRepo` e `servicoPersonalizadoRepo` são mantidos como
 * parâmetros opcionais apenas para preservar a assinatura usada pelos
 * consumidores atuais; a versão atual do hook NÃO os consome.
 */
export function useOrcamentos(
  orcamentoRepo: OrcamentoRepository,
  status: Orcamento["status"],
  _tipoServicoRepo?: TipoServicoRepository,
  _servicoPersonalizadoRepo?: ServicoPersonalizadoRepository,
  opts: UseOrcamentosOpts = {}
) {
  const pageSize = opts.pageSize ?? 10;
  const initialPage = opts.page ?? 1;

  const [orcamentos, setOrcamentos] = useState<OrcamentoCompleto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantém a page corrente acessível de forma síncrona dentro dos
  // callbacks (evita fechar sobre um valor desatualizado ao encadear
  // `carregarMais` em sequência).
  const pageRef = useRef(initialPage);
  pageRef.current = initialPage;

  const carregarInterno = useCallback(
    async (proximaPage: number, append: boolean) => {
      pageRef.current = proximaPage;
      setLoading(true);
      setError(null);
      try {
        const pagina = await orcamentoRepo.buscarPagina({
          status,
          page: proximaPage,
          pageSize,
        });
        setTotal(pagina.total);
        setOrcamentos((prev) =>
          append ? [...prev, ...pagina.items] : pagina.items
        );
      } catch (err) {
        const mensagem =
          err instanceof Error ? err.message : "Erro ao carregar orçamentos";
        setError(mensagem);
      } finally {
        setLoading(false);
      }
    },
    [orcamentoRepo, status, pageSize]
  );

  const recarregar = useCallback(async () => {
    await carregarInterno(1, false);
  }, [carregarInterno]);

  const carregarMais = useCallback(async () => {
    await carregarInterno(pageRef.current + 1, true);
  }, [carregarInterno]);

  const atualizarOrcamento = (
    orcamentoId: string,
    atualizacoes: Partial<OrcamentoCompleto>
  ) => {
    setOrcamentos((prev) =>
      prev.map((orcamento) =>
        orcamento.id === orcamentoId
          ? { ...orcamento, ...atualizacoes }
          : orcamento
      )
    );
  };

  const removerOrcamento = (orcamentoId: string) => {
    setOrcamentos((prev) =>
      prev.filter((orcamento) => orcamento.id !== orcamentoId)
    );
  };

  const hasMore = orcamentos.length < total;

  return {
    orcamentos,
    total,
    hasMore,
    loading,
    error,
    carregarMais,
    recarregar,
    atualizarOrcamento,
    removerOrcamento,
  };
}
