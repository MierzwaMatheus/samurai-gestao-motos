import { useState, useCallback, useMemo } from "react";
import { StorageApi, EspacoBucketInfo } from "@/domain/interfaces/StorageApi";
import { ConsultarEspacoStorageUseCase } from "@/domain/usecases/ConsultarEspacoStorageUseCase";

export interface StorageInfoState extends EspacoBucketInfo {
  espacoUsadoFormatado: string;
  espacoTotalFormatado: string;
  espacoDisponivelFormatado: string;
  corBarra: string;
}

export function useStorageInfo(storageApi: StorageApi) {
  const [info, setInfo] = useState<StorageInfoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new ConsultarEspacoStorageUseCase(storageApi),
    [storageApi]
  );

  const carregarInfo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await useCase.execute();

      setInfo({
        ...data,
        espacoUsadoFormatado: ConsultarEspacoStorageUseCase.formatarTamanho(
          data.espacoUsadoBytes
        ),
        espacoTotalFormatado: ConsultarEspacoStorageUseCase.formatarTamanho(
          data.espacoTotalBytes
        ),
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
    }
  }, [useCase]);

  return {
    info,
    loading,
    error,
    carregarInfo,
  };
}
