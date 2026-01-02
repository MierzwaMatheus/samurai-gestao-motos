import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { Entrada } from "@shared/types";

/**
 * Caso de uso: Gerar Ordem de Serviço
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class GerarOSUseCase {
  constructor(
    private entradaRepo: EntradaRepository,
    private clienteRepo: ClienteRepository,
    private motoRepo: MotoRepository,
    private fotoRepo: FotoRepository
  ) {}

  async execute(entradaId: string): Promise<{
    entrada: Entrada;
    cliente: { nome: string; telefone?: string; endereco?: string };
    moto: { modelo: string; placa?: string; finalNumeroQuadro?: string };
    fotos: Array<{ url: string; tipo: string }>;
  }> {
    // Busca entrada
    const entrada = await this.entradaRepo.buscarPorId(entradaId);
    if (!entrada) {
      throw new Error("Entrada não encontrada");
    }

    // Busca cliente e moto
    const [cliente, moto] = await Promise.all([
      this.clienteRepo.buscarPorId(entrada.clienteId),
      this.motoRepo.buscarPorId(entrada.motoId),
    ]);

    if (!cliente || !moto) {
      throw new Error("Cliente ou moto não encontrados");
    }

    // Busca fotos
    const fotos = await this.fotoRepo.buscarPorEntradaId(entradaId);

    return {
      entrada,
      cliente: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
      },
      moto: {
        modelo: moto.modelo,
        placa: moto.placa,
        finalNumeroQuadro: moto.finalNumeroQuadro,
      },
      fotos: fotos.map((f) => ({ url: f.url, tipo: f.tipo })),
    };
  }
}

