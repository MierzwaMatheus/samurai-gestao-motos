import { useState, useCallback, useMemo } from "react";
import { StorageApi, ArquivoStorage } from "@/domain/interfaces/StorageApi";
import {
  LimparArquivosStorageUseCase,
  ResultadoLimpeza,
} from "@/domain/usecases/LimparArquivosStorageUseCase";
import { ConsultarEspacoStorageUseCase } from "@/domain/usecases/ConsultarEspacoStorageUseCase";

export interface PreviewLimpeza {
  arquivos: ArquivoStorage[];
  quantidade: number;
  espacoTotalBytes: number;
  espacoTotalFormatado: string;
}

export function useLimparStorage(storageApi: StorageApi) {
  const [preview, setPreview] = useState<PreviewLimpeza | null>(null);
  const [resultado, setResultado] = useState<ResultadoLimpeza | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingLimpeza, setLoadingLimpeza] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new LimparArquivosStorageUseCase(storageApi),
    [storageApi]
  );

  const gerarPreview = useCallback(
    async (dataInicio: Date, dataFim: Date) => {
      setLoadingPreview(true);
      setError(null);
      setPreview(null);

      try {
        const arquivos = await useCase.preview(dataInicio, dataFim);
        const espacoTotalBytes = arquivos.reduce(
          (total, arquivo) => total + arquivo.tamanhoBytes,
          0
        );

        setPreview({
          arquivos,
          quantidade: arquivos.length,
          espacoTotalBytes,
          espacoTotalFormatado:
            ConsultarEspacoStorageUseCase.formatarTamanho(espacoTotalBytes),
        });
      } catch (err) {
        const mensagem =
          err instanceof Error ? err.message : "Erro ao gerar preview";
        setError(mensagem);
      } finally {
        setLoadingPreview(false);
      }
    },
    [useCase]
  );

  const limpar = useCallback(
    async (dataInicio: Date, dataFim: Date) => {
      setLoadingLimpeza(true);
      setError(null);

      try {
        const resultado = await useCase.execute(dataInicio, dataFim);
        setResultado(resultado);
        setPreview(null);
        return resultado;
      } catch (err) {
        const mensagem =
          err instanceof Error ? err.message : "Erro ao limpar arquivos";
        setError(mensagem);
        throw err;
      } finally {
        setLoadingLimpeza(false);
      }
    },
    [useCase]
  );

  const limparPreview = useCallback(() => {
    setPreview(null);
    setResultado(null);
    setError(null);
  }, []);

  return {
    preview,
    resultado,
    loadingPreview,
    loadingLimpeza,
    error,
    gerarPreview,
    limpar,
    limparPreview,
  };
}
