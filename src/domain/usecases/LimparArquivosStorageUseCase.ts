import { StorageApi, ArquivoStorage } from "@/domain/interfaces/StorageApi";

/**
 * Resultado da operação de limpeza
 */
export interface ResultadoLimpeza {
  arquivosDeletados: number;
  espacoLiberadoBytes: number;
  periodoInicio: Date;
  periodoFim: Date;
}

/**
 * Use Case para limpar arquivos do storage por período
 * Segue SRP: única responsabilidade é limpar arquivos antigos
 * Segue DIP: depende da abstração StorageApi
 */
export class LimparArquivosStorageUseCase {
  constructor(private storageApi: StorageApi) {}

  /**
   * Valida se o período é válido para limpeza
   * - Data início não pode ser no futuro
   * - Data fim não pode ser no futuro
   * - Data início deve ser menor ou igual a data fim
   * - Período máximo de 1 ano
   */
  private validarPeriodo(dataInicio: Date, dataFim: Date): void {
    const agora = new Date();

    if (dataInicio > agora) {
      throw new Error("Data de início não pode ser no futuro");
    }

    if (dataFim > agora) {
      throw new Error("Data de fim não pode ser no futuro");
    }

    if (dataInicio > dataFim) {
      throw new Error("Data de início deve ser anterior à data de fim");
    }

    const umAnoEmMs = 365 * 24 * 60 * 60 * 1000;
    if (dataFim.getTime() - dataInicio.getTime() > umAnoEmMs) {
      throw new Error("Período máximo permitido é de 1 ano");
    }
  }

  /**
   * Lista arquivos que serão deletados sem executar a deleção
   * Útil para preview antes da limpeza
   */
  async preview(dataInicio: Date, dataFim: Date): Promise<ArquivoStorage[]> {
    this.validarPeriodo(dataInicio, dataFim);
    return await this.storageApi.listarArquivosPorPeriodo(dataInicio, dataFim);
  }

  /**
   * Executa a limpeza dos arquivos no período especificado
   */
  async execute(dataInicio: Date, dataFim: Date): Promise<ResultadoLimpeza> {
    this.validarPeriodo(dataInicio, dataFim);

    const arquivos = await this.storageApi.listarArquivosPorPeriodo(
      dataInicio,
      dataFim
    );

    const espacoLiberadoBytes = arquivos.reduce(
      (total, arquivo) => total + arquivo.tamanhoBytes,
      0
    );

    const arquivosDeletados = await this.storageApi.deletarArquivosPorPeriodo(
      dataInicio,
      dataFim
    );

    return {
      arquivosDeletados,
      espacoLiberadoBytes,
      periodoInicio: dataInicio,
      periodoFim: dataFim,
    };
  }
}
