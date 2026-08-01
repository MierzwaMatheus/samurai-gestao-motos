import {
  StorageApi,
  EspacoBucketInfo,
  ArquivoStorage,
} from "@/domain/interfaces/StorageApi";
import { supabase } from "@/infrastructure/supabase/client";
import { obterSignedUrl as obterSignedUrlCacheada } from "@/infrastructure/storage/urlCache";
import { consultarEspacoBucketCacheado } from "@/infrastructure/storage/espacoBucketCache";
import imageCompression from "browser-image-compression";

/**
 * Implementação do serviço de storage usando Supabase Storage
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseStorageApi implements StorageApi {
  private readonly bucketName = "fotos";

  /** Cache de 30 dias no edge do Supabase (em segundos). */
  private static readonly FOTO_CACHE_CONTROL_SECONDS = "2592000";

  /**
   * Opções de compressão aplicadas no browser antes do upload.
   *
   * Image Transformations do Supabase é Pro-only, então a redução de
   * egresso precisa acontecer *antes* do arquivo chegar ao bucket: o
   * objeto armazenado já é o comprimido (~300-500 KB em vez de 3-5 MB),
   * e toda leitura posterior trafega esse tamanho menor.
   */
  private static readonly OPCOES_COMPRESSAO = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
  };

  /**
   * Faz upload de uma foto para o bucket de fotos
   * O arquivo é salvo em: {userId}/{entradaId}/{tipo}/{timestamp}-{filename}
   */
  async uploadFoto(
    file: File,
    entradaId: string,
    tipo: "moto" | "status" | "documento"
  ): Promise<string> {
    // Obtém o usuário atual
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    // Valida tipo de arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        "Tipo de arquivo não permitido. Use JPEG, PNG, WEBP ou GIF."
      );
    }

    // Valida tamanho (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error("Arquivo muito grande. Tamanho máximo: 5MB.");
    }

    // Comprime imagens antes do upload. Documentos (scans/PDFs) mantêm o
    // arquivo original: recomprimir degradaria a legibilidade.
    const arquivoParaUpload =
      tipo === "documento"
        ? file
        : await imageCompression(file, SupabaseStorageApi.OPCOES_COMPRESSAO);

    // Gera nome único para o arquivo
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = `${user.id}/${entradaId}/${tipo}/${fileName}`;

    // Faz upload com cache de 30 dias para casar com a janela de cache dos
    // consumidores (signed URLs têm `expiresIn` curto, mas o objeto no
    // Storage pode ficar cacheado por mais tempo no edge do Supabase).
    // `upsert: true` permite reenviar o mesmo `filePath` sem 409.
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, arquivoParaUpload, {
        cacheControl: SupabaseStorageApi.FOTO_CACHE_CONTROL_SECONDS,
        upsert: true,
      });

    if (error) {
      throw new Error(`Erro ao fazer upload: ${error.message}`);
    }

    // Retorna o caminho completo
    return filePath;
  }

  /**
   * Deleta uma foto do storage
   */
  async deletarFoto(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) {
      throw new Error(`Erro ao deletar foto: ${error.message}`);
    }
  }

  /**
   * Obtém URL pública de uma foto
   * Nota: Como o bucket é privado, precisamos usar signed URL ou tornar o bucket público
   * Por enquanto, retornamos uma URL assinada válida por 1 hora
   */
  obterUrlPublica(path: string): string {
    // Para bucket privado, precisamos gerar signed URL
    // Mas para simplificar, vamos retornar a URL direta
    // Se o bucket for privado, precisará usar getSignedUrl
    const { data } = supabase.storage.from(this.bucketName).getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Obtém URL assinada (para bucket privado)
   *
   * Gera uma signed URL com `expiresIn` em segundos (default 1h).
   * Parâmetros de Image Transformations do Supabase **não** são
   * aplicados: essa feature é Pro-only e no Free Plan o servidor
   * ignora o argumento `transform`, então a economia esperada de
   * egresso não se materializa. A redução real de egresso é feita
   * antes do upload (compressão no browser — ver `uploadFoto`).
   */
  async obterUrlAssinada(
    path: string,
    expiresIn: number = 3600
  ): Promise<string> {
    return obterSignedUrlCacheada(path, expiresIn);
  }

  /**
   * Consulta espaço utilizado no bucket
   *
   * Delega para a Edge Function `consultar-uso-storage`, que agrega
   * bytes/quantidade por usuário no SQL (SECURITY DEFINER). Isso troca
   * a listagem recursiva paginada (centenas de requests) por uma única
   * chamada HTTP.
   *
   * O cliente recompõe `espacoDisponivelBytes` e `percentualUsado` com
   * a constante `LIMITE_BYTES = 1 GB` para preservar o shape
   * `EspacoBucketInfo` consumido pela UI.
   */
  async consultarEspacoBucket(): Promise<EspacoBucketInfo> {
    return consultarEspacoBucketCacheado(async () => {
      const LIMITE_GB = 1;
      const LIMITE_BYTES = LIMITE_GB * 1024 * 1024 * 1024;

      try {
        const { data, error } = await supabase.functions.invoke<{
          espacoUsadoBytes: number;
          totalArquivos: number;
        }>("consultar-uso-storage");

        if (error) {
          throw new Error(error.message);
        }

        const espacoUsadoBytes = data?.espacoUsadoBytes ?? 0;
        const totalArquivos = data?.totalArquivos ?? 0;
        const espacoDisponivelBytes = LIMITE_BYTES - espacoUsadoBytes;
        const percentualUsado = (espacoUsadoBytes / LIMITE_BYTES) * 100;

        return {
          espacoUsadoBytes,
          espacoTotalBytes: LIMITE_BYTES,
          espacoDisponivelBytes: Math.max(0, espacoDisponivelBytes),
          percentualUsado: Math.min(100, percentualUsado),
          totalArquivos,
        };
      } catch (error) {
        throw new Error(
          `Erro ao consultar espaço do bucket: ${
            error instanceof Error ? error.message : "Erro desconhecido"
          }`
        );
      }
    });
  }

  /**
   * Lista arquivos por período
   * Retorna todos os arquivos criados entre dataInicio e dataFim
   * Faz busca recursiva em todas as subpastas
   */
  async listarArquivosPorPeriodo(
    dataInicio: Date,
    dataFim: Date
  ): Promise<ArquivoStorage[]> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error("Usuário não autenticado");
      }

      const arquivosFiltrados: ArquivoStorage[] = [];
      const prefixoBase = `${userData.user.id}`;
      const pastasParaProcessar: string[] = [prefixoBase];

      while (pastasParaProcessar.length > 0) {
        const pastaAtual = pastasParaProcessar.shift()!;
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: items, error } = await supabase.storage
            .from(this.bucketName)
            .list(pastaAtual, {
              limit: limit,
              offset: offset,
              sortBy: { column: "created_at", order: "desc" },
            });

          if (error) {
            throw new Error(`Erro ao listar arquivos: ${error.message}`);
          }

          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }

          for (const item of items) {
            if (item.id) {
              const dataCriacao = new Date(item.created_at);

              if (dataCriacao >= dataInicio && dataCriacao <= dataFim) {
                arquivosFiltrados.push({
                  nome: item.name,
                  caminho: `${pastaAtual}/${item.name}`,
                  tamanhoBytes: item.metadata?.size || 0,
                  dataCriacao,
                  tipo: item.metadata?.mimetype || "unknown",
                });
              }
            } else {
              pastasParaProcessar.push(`${pastaAtual}/${item.name}`);
            }
          }

          if (items.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }
      }

      return arquivosFiltrados;
    } catch (error) {
      throw new Error(
        `Erro ao listar arquivos por período: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    }
  }

  /**
   * Deleta arquivos por período
   * Retorna a quantidade de arquivos deletados
   */
  async deletarArquivosPorPeriodo(
    dataInicio: Date,
    dataFim: Date
  ): Promise<number> {
    try {
      const arquivos = await this.listarArquivosPorPeriodo(dataInicio, dataFim);

      if (arquivos.length === 0) {
        return 0;
      }

      const caminhos = arquivos.map(a => a.caminho);
      const batchSize = 100;
      let totalDeletados = 0;

      for (let i = 0; i < caminhos.length; i += batchSize) {
        const batch = caminhos.slice(i, i + batchSize);
        const { error } = await supabase.storage
          .from(this.bucketName)
          .remove(batch);

        if (error) {
          throw new Error(`Erro ao deletar arquivos: ${error.message}`);
        }

        totalDeletados += batch.length;
      }

      return totalDeletados;
    } catch (error) {
      throw new Error(
        `Erro ao deletar arquivos por período: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    }
  }
}
