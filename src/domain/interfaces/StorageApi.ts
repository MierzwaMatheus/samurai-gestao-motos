/**
 * Tipos de foto que determinam onde o arquivo é salvo no bucket.
 * Centralizamos o union aqui para que `StorageApi` e quaisquer callers
 * usem a mesma fonte da verdade.
 */
export type TipoFoto = "moto" | "status" | "documento";

/**
 * Resultado de `uploadFoto` para o pipeline de duas variantes.
 *
 * - `thumbPath`: caminho da variante thumbnail no bucket. `null` para
 *   `documento` (que mantém 1 upload único para preservar a
 *   legibilidade do scan).
 * - `fullPath`: caminho da variante em alta resolução (ou do arquivo
 *   único, no caso de `documento`).
 */
export interface UploadFotoResult {
  thumbPath: string | null;
  fullPath: string;
}

/**
 * Interface para serviços de storage/upload de arquivos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface StorageApi {
  uploadFoto(
    file: File,
    entradaId: string,
    tipo: TipoFoto
  ): Promise<UploadFotoResult>;
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
