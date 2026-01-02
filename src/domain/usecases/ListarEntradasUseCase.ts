import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { Entrada } from "@shared/types";

/**
 * Caso de uso: Listar entradas por status
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class ListarEntradasUseCase {
  constructor(private entradaRepo: EntradaRepository) {}

  async execute(status?: Entrada["status"]): Promise<Entrada[]> {
    if (status) {
      return await this.entradaRepo.buscarPorStatus(status);
    }
    return await this.entradaRepo.listar();
  }
}

