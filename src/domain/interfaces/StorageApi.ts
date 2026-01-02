/**
 * Interface para serviços de storage/upload de arquivos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface StorageApi {
  uploadFoto(file: File, entradaId: string, tipo: "moto" | "status" | "documento"): Promise<string>;
  deletarFoto(path: string): Promise<void>;
  obterUrlPublica(path: string): string;
}

