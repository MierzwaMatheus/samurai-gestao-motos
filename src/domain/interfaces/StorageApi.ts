/**
 * Interface para serviços de storage/upload de arquivos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface StorageApi {
  uploadFoto(
    file: File,
    entradaId: string,
    tipo: "moto" | "status" | "documento"
  ): Promise<string>;
  deletarFoto(path: string): Promise<void>;
  obterUrlPublica(path: string): string;
  obterUrlAssinada(path: string, expiresIn?: number): Promise<string>;
  consultarEspacoBucket(): Promise<EspacoBucketInfo>;
  listarArquivosPorPeriodo(
    dataInicio: Date,
    dataFim: Date
  ): Promise<ArquivoStorage[]>;
  deletarArquivosPorPeriodo(dataInicio: Date, dataFim: Date): Promise<number>;
}

export interface EspacoBucketInfo {
  espacoUsadoBytes: number;
  espacoTotalBytes: number;
  espacoDisponivelBytes: number;
  percentualUsado: number;
  totalArquivos: number;
}

export interface ArquivoStorage {
  nome: string;
  caminho: string;
  tamanhoBytes: number;
  dataCriacao: Date;
  tipo: string;
}
