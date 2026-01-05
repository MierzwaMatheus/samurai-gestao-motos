import { Foto } from "@shared/types";

/**
 * Interface para repositório de fotos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface FotoRepository {
  criar(foto: Omit<Foto, "id" | "criadoEm">): Promise<Foto>;
  buscarPorId(id: string): Promise<Foto | null>;
  buscarPorEntradaId(entradaId: string): Promise<Foto[]>;
  buscarPorEntradaIdETipo(entradaId: string, tipo: Foto["tipo"]): Promise<Foto[]>;
  deletar(id: string): Promise<void>;
}

