import { Foto } from "@shared/types";

/**
 * Interface para repositório de fotos
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface FotoRepository {
  /**
   * Persiste uma foto. `thumbPath` e `fullPath` são opcionais:
   * - `documento` envia ambos como `null` (1 upload único).
   * - Pipeline de 2 variantes (`moto`/`status`) envia ambos.
   * - Compat: callers antigos podem omitir (cai no `url` no mapper).
   */
  criar(
    foto: Omit<Foto, "id" | "criadoEm" | "thumbPath" | "fullPath"> & {
      thumbPath?: string | null;
      fullPath?: string | null;
    }
  ): Promise<Foto>;
  buscarPorId(id: string): Promise<Foto | null>;
  buscarPorEntradaId(entradaId: string): Promise<Foto[]>;
  buscarPorEntradaIdETipo(entradaId: string, tipo: Foto["tipo"]): Promise<Foto[]>;
  deletar(id: string): Promise<void>;
}

