import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { StorageApi } from "@/domain/interfaces/StorageApi";

/**
 * Caso de uso: Atualizar status de entrega e fazer upload de OS assinada
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AtualizarStatusEntregaUseCase {
  constructor(
    private entradaRepo: EntradaRepository,
    private storageApi: StorageApi
  ) {}

  async execute(
    entradaId: string,
    statusEntrega: "entregue" | "retirado",
    osAssinada?: File
  ): Promise<void> {
    // Validações de negócio
    if (!entradaId) {
      throw new Error("ID da entrada é obrigatório");
    }

    let osAssinadaUrl: string | undefined;

    // Se houver OS assinada, faz upload
    if (osAssinada) {
      osAssinadaUrl = await this.storageApi.uploadFoto(
        osAssinada,
        entradaId,
        "documento"
      );
    }

    // Atualiza status de entrega
    await this.entradaRepo.atualizar(entradaId, {
      statusEntrega,
      osAssinadaUrl,
    });
  }
}

