/**
 * Opções de transformação de imagem aplicadas na geração da URL assinada.
 * Espelha o subconjunto do Supabase Image Transformations que usamos para
 * reduzir egress: servir a imagem já no tamanho em que ela é exibida.
 */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  /** Qualidade de 20 a 100. O Supabase usa 80 por padrão. */
  quality?: number;
  /**
   * Só aceita `"origin"`, que **desliga** a otimização automática e força o
   * formato original. Omitir este campo é o que faz o Supabase servir WebP
   * automaticamente para navegadores que o suportam — é isso que queremos
   * na maioria dos casos, então normalmente não passamos `format`.
   */
  format?: "origin";
}

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
  obterUrlAssinada(
    path: string,
    expiresIn?: number,
    transform?: ImageTransformOptions
  ): Promise<string>;
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
