import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { StorageApi, EspacoBucketInfo } from "@/domain/interfaces/StorageApi";
import { ConsultarEspacoStorageUseCase } from "@/domain/usecases/ConsultarEspacoStorageUseCase";
import { useAuth } from "@/contexts/AuthContext";

export interface StorageInfoState extends EspacoBucketInfo {
  espacoUsadoFormatado: string;
  espacoTotalFormatado: string;
  espacoDisponivelFormatado: string;
  corBarra: string;
}

interface StorageInfoContextValue {
  info: StorageInfoState | null;
  loading: boolean;
  error: string | null;
  /**
   * Recarrega dados sob demanda. Usado pelo `StorageManager` (modal)
   * no on-open ou após `Limpar`. Se uma chamada já está em voo,
   * retorna a promise existente (deduplica).
   */
  carregarInfo: () => Promise<void>;
}

const StorageInfoContext = createContext<StorageInfoContextValue | undefined>(
  undefined
);

interface StorageInfoProviderProps {
  storageApi: StorageApi;
  children: ReactNode;
}

/**
 * Provider singleton do estado de storage.
 *
 * Issue #14b: antes deste Provider, o `useStorageInfo` era instanciado
 * em DOIS lugares (Header.StorageBar + StorageManager), cada um
 * criando o seu próprio `useCase` e o seu próprio `useEffect`. Em
 * alguns fluxos isso virou 2-3 chamadas concorrentes à Edge Function
 * `consultar-uso-storage` no mesmo load. O cache em
 * `consultarEspacoBucketCacheado` (5min TTL) deduplicava chamadas
 * SEQUENCIAIS, mas chamadas CONCORRENTES no mesmo tick ainda
 * causavam requests HTTP redundantes (a cache hit acontece DEPOIS do
 * await).
 *
 * Solução: 1 hook instance provider-wide. Toda chamada é guardada
 * por `inFlightRef` — se uma chamada já está em voo, as outras
 * esperam a mesma Promise. Garante 1 request real por sessão de
 * 5 minutos, independente de quantos componentes consomem.
 */
export function StorageInfoProvider({
  storageApi,
  children,
}: StorageInfoProviderProps) {
  const [info, setInfo] = useState<StorageInfoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCaseRef = useRef<ConsultarEspacoStorageUseCase>();
  if (!useCaseRef.current) {
    useCaseRef.current = new ConsultarEspacoStorageUseCase(storageApi);
  }
  const useCase = useCaseRef.current;

  // Deduplicação de chamadas concorrentes: se uma chamada está em voo,
  // as próximas retornam a mesma Promise.
  const inFlightRef = useRef<Promise<void> | null>(null);

  const carregarInfo = useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }
    setLoading(true);
    setError(null);
    const promise = (async () => {
      try {
        const data = await useCase.execute();
        setInfo({
          ...data,
          espacoUsadoFormatado:
            ConsultarEspacoStorageUseCase.formatarTamanho(data.espacoUsadoBytes),
          espacoTotalFormatado:
            ConsultarEspacoStorageUseCase.formatarTamanho(data.espacoTotalBytes),
          espacoDisponivelFormatado:
            ConsultarEspacoStorageUseCase.formatarTamanho(
              data.espacoDisponivelBytes
            ),
          corBarra: ConsultarEspacoStorageUseCase.obterCorPercentual(
            data.percentualUsado
          ),
        });
      } catch (err) {
        const mensagem =
          err instanceof Error ? err.message : "Erro ao carregar informações";
        setError(mensagem);
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [useCase]);

  // Auto-load só quando o usuário está autenticado. CarregarInfo ainda
  // pode ser chamado manualmente pelo StorageManager (on-open).
  const { user, loading: authLoading } = useAuth();
  useEffect(() => {
    if (authLoading || !user) return;
    void carregarInfo();
  }, [carregarInfo, user, authLoading]);

  return (
    <StorageInfoContext.Provider
      value={{ info, loading, error, carregarInfo }}
    >
      {children}
    </StorageInfoContext.Provider>
  );
}

export function useStorageInfoContext() {
  const ctx = useContext(StorageInfoContext);
  if (ctx === undefined) {
    throw new Error(
      "useStorageInfoContext deve ser usado dentro de um StorageInfoProvider"
    );
  }
  return ctx;
}

/**
 * @deprecated Use `useStorageInfoContext` (singleton via Provider).
 * Mantido para compat enquanto a migração é feita. Cria o seu próprio
 * useCase/estado — pode duplicar chamadas em alguns cenários.
 */
export { useStorageInfo } from "@/hooks/useStorageInfo";
