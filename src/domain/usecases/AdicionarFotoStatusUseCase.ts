import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { StorageApi } from "@/domain/interfaces/StorageApi";
import { FotoStatus } from "@shared/types";

/**
 * Caso de uso: Adicionar foto de status com observações
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AdicionarFotoStatusUseCase {
  constructor(
    private entradaRepo: EntradaRepository,
    private storageApi: StorageApi
  ) {}

  async execute(
    entradaId: string,
    file: File,
    observacao?: string,
    progresso?: number
  ): Promise<FotoStatus> {
    // Validações de negócio
    if (!entradaId) {
      throw new Error("ID da entrada é obrigatório");
    }

    if (!file) {
      throw new Error("Arquivo é obrigatório");
    }

    // Busca entrada atual para obter progresso atual se não fornecido
    const entrada = await this.entradaRepo.buscarPorId(entradaId);
    if (!entrada) {
      throw new Error("Entrada não encontrada");
    }

    const progressoAtual = progresso !== undefined ? progresso : entrada.progresso;

    // Faz upload do arquivo
    const filePath = await this.storageApi.uploadFoto(file, entradaId, "status");

    // Gera URL assinada
    const url = await this.storageApi.obterUrlAssinada(filePath, 3600);

    // Cria objeto de foto de status
    const fotoStatus: FotoStatus = {
      url: filePath, // Salva o filePath, não a URL assinada
      data: new Date(),
      observacao,
      progresso: progressoAtual,
    };

    // Busca fotos de status existentes
    const fotosStatusExistentes = entrada.fotosStatus || [];

    // Adiciona nova foto
    const novasFotosStatus = [...fotosStatusExistentes, fotoStatus];

    // Atualiza entrada com nova foto e progresso (se fornecido)
    await this.entradaRepo.atualizar(entradaId, {
      fotosStatus: novasFotosStatus,
      progresso: progressoAtual,
    });

    // Retorna foto com URL assinada para exibição imediata
    return {
      ...fotoStatus,
      url, // URL assinada para exibição
    };
  }
}

