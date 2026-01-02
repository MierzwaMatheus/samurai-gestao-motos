import { StorageApi } from "@/domain/interfaces/StorageApi";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { Foto } from "@shared/types";

/**
 * Caso de uso: Upload de foto
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class UploadFotoUseCase {
  constructor(
    private storageApi: StorageApi,
    private fotoRepo: FotoRepository
  ) {}

  async execute(
    file: File,
    entradaId: string,
    tipo: "moto" | "status" | "documento"
  ): Promise<Foto> {
    // Validações de negócio
    if (!file) {
      throw new Error("Arquivo é obrigatório");
    }

    if (!entradaId) {
      throw new Error("ID da entrada é obrigatório");
    }

    // Faz upload do arquivo
    const filePath = await this.storageApi.uploadFoto(file, entradaId, tipo);

    // Obtém URL pública
    const url = this.storageApi.obterUrlPublica(filePath);

    // Salva referência no banco
    const foto = await this.fotoRepo.criar({
      entradaId,
      url,
      tipo,
    });

    return foto;
  }
}

