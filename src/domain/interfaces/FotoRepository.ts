import { Foto } from "@shared/types";

/**
 * Interface para repositório de fotos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface FotoRepository {
  criar(foto: Omit<Foto, "id" | "criadoEm">): Promise<Foto>;
  buscarPorId(id: string): Promise<Foto | null>;
  buscarPorEntradaId(entradaId: string): Promise<Foto[]>;
  deletar(id: string): Promise<void>;
}

