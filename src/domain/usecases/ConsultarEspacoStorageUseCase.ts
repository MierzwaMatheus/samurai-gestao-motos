import { StorageApi, EspacoBucketInfo } from "@/domain/interfaces/StorageApi";

/**
 * Use Case para consultar espaço utilizado no bucket
 * Segue SRP: única responsabilidade é consultar espaço
 * Segue DIP: depende da abstração StorageApi
 */
export class ConsultarEspacoStorageUseCase {
  constructor(private storageApi: StorageApi) {}

  async execute(): Promise<EspacoBucketInfo> {
    return await this.storageApi.consultarEspacoBucket();
  }

  /**
   * Formata bytes para formato legível (KB, MB, GB)
   */
  static formatarTamanho(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Retorna cor baseada no percentual de uso
   */
  static obterCorPercentual(percentual: number): string {
    if (percentual < 50) return "bg-green-500";
    if (percentual < 75) return "bg-yellow-500";
    if (percentual < 90) return "bg-orange-500";
    return "bg-red-500";
  }
}
