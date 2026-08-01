import { useState, useRef, useCallback, useEffect } from "react";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { Entrada, MotoCompleta } from "@shared/types";

/**
 * Opções do hook `useMotosOficina`.
 *
 * - page:      número da página (1-based). Default 1.
 * - pageSize:  quantidade de itens por página. Default 10.
 * - tipo:      filtro server-side pelo tipo de entrada.
 * - status:    filtro server-side pelos status da oficina aceitos.
 * - statusEntrega: filtro server-side pelos status de entrega aceitos.
 * - busca:     termo livre enviado ao backend (cliente/moto/placa/serviço).
 *
 * Os filtros `tipo` / `statusEntrega` / `busca` são aplicados **no
 * servidor** via `entradaRepo.buscarPagina()` — não há mais filtragem
 * client-side (issue #11 ciclo 6).
 */
export interface UseMotosOficinaOpts {
  page?: number;
  pageSize?: number;
  tipo?: Entrada["tipo"];
  status?: Entrada["status"][];
  statusEntrega?: NonNullable<Entrada["statusEntrega"]>[];
  busca?: string;
}

/**
 * Hook paginado para listagem de motos da oficina.
 *
 * Retorno:
 *  - `motos`           — lista acumulada (concatena via `carregarMais`).
 *  - `total`           — total de registros no servidor.
 *  - `hasMore`         — `motos.length < total`.
 *  - `loading` / `error`
 *  - `carregarMais()`  — busca a próxima página e concatena.
 *  - `recarregar()`    — volta para `page=1` e substitui a lista.
 *  - `setBusca(value)` — atualiza o termo de busca com debounce de 300ms;
 *                        ao disparar, zera a paginação (`page=1`) e
 *                        substitui a lista.
 *  - `atualizarMoto()` — mutação imutável sobre um item por `entradaId`.
 *
 * Mudanças rápidas em `busca` são colapsadas em **uma única** request
 * após 300ms (debounce). Mudar `busca` sempre volta para `page=1`.
 */
export function useMotosOficina(
  entradaRepo: EntradaRepository,
  opts: UseMotosOficinaOpts = {}
) {
  const pageSize = opts.pageSize ?? 10;
  const initialPage = opts.page ?? 1;
  const tipo = opts.tipo;
  const status = opts.status;
  const statusEntrega = opts.statusEntrega;
  const buscaInicial = opts.busca;

  const [motos, setMotos] = useState<MotoCompleta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantém a page corrente acessível de forma síncrona dentro dos
  // callbacks. NÃO sincronizamos `pageRef.current = initialPage` em cada
  // render — isso resetaria o ref para 1 e quebraria o encadeamento de
  // `carregarMais()`. O ref só é atualizado quando uma página é de fato
  // carregada (dentro de `carregarInterno`).
  const pageRef = useRef(initialPage);

  const carregarInterno = useCallback(
    async (
      proximaPage: number,
      append: boolean,
      params: { busca?: string } = {}
    ) => {
      pageRef.current = proximaPage;
      setLoading(true);
      setError(null);
      try {
        const pagina = await entradaRepo.buscarPagina({
          page: proximaPage,
          pageSize,
          tipo,
          status,
          statusEntrega,
          busca: params.busca,
        });
        setTotal(pagina.total);
        setMotos((prev) =>
          append ? [...prev, ...pagina.items] : pagina.items
        );
      } catch (err) {
        const mensagem =
          err instanceof Error ? err.message : "Erro ao carregar motos";
        setError(mensagem);
      } finally {
        setLoading(false);
      }
    },
    [entradaRepo, pageSize, tipo, status, statusEntrega]
  );

  const recarregar = useCallback(async () => {
    await carregarInterno(1, false, { busca: buscaInicial });
  }, [carregarInterno, buscaInicial]);

  const carregarMais = useCallback(async () => {
    await carregarInterno(pageRef.current + 1, true, {});
  }, [carregarInterno]);

  // ====== Busca com debounce 300ms ======
  const [busca, setBuscaState] = useState<string | undefined>(buscaInicial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mantém a versão mais recente do callback de carga para que o timer
  // possa chamá-lo sem precisar re-registrar.
  const carregarInternoRef = useRef(carregarInterno);
  carregarInternoRef.current = carregarInterno;

  const cancelarDebounce = () => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };

  // Limpa timer pendente no unmount.
  useEffect(() => {
    return () => {
      cancelarDebounce();
    };
  }, []);

  const setBusca = useCallback((valor: string) => {
    setBuscaState(valor);
    cancelarDebounce();
    // Se vazio, dispara imediatamente (sem debounce) para reativar a lista.
    // Se não-vazio, agenda 300ms.
    if (valor.length === 0) {
      void carregarInternoRef.current(1, false, { busca: undefined });
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void carregarInternoRef.current(1, false, { busca: valor });
    }, 300);
  }, []);

  const atualizarMoto = (
    entradaId: string,
    atualizacoes: Partial<MotoCompleta>
  ) => {
    setMotos((prevMotos) =>
      prevMotos.map((moto) =>
        moto.entradaId === entradaId ? { ...moto, ...atualizacoes } : moto
      )
    );
  };

  const hasMore = motos.length < total;

  return {
    motos,
    total,
    hasMore,
    loading,
    error,
    carregarMais,
    recarregar,
    setBusca,
    atualizarMoto,
    busca,
  };
}