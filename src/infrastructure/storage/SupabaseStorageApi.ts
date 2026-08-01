import {
  StorageApi,
  EspacoBucketInfo,
  ArquivoStorage,
  UploadFotoResult,
} from "@/domain/interfaces/StorageApi";
import { supabase } from "@/infrastructure/supabase/client";
import { obterSignedUrl as obterSignedUrlCacheada } from "@/infrastructure/storage/urlCache";
import { consultarEspacoBucketCacheado } from "@/infrastructure/storage/espacoBucketCache";
import { gerarVariantes } from "@/infrastructure/storage/imageVariants";
import { sanitizeFilename } from "@/infrastructure/storage/filename";

/**
 * Implementação do serviço de storage usando Supabase Storage
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseStorageApi implements StorageApi {
  private readonly bucketName = "fotos";

  /** Cache de 30 dias no edge do Supabase (em segundos). */
  private static readonly FOTO_CACHE_CONTROL_SECONDS = "2592000";

  /**
   * Faz upload de uma foto para o bucket de fotos.
   *
   * Para `moto`/`status` gera 2 variantes webp no browser (thumb
   * 400x400 cover q70, full 1600x1600 max q80) e faz 2 uploads em
   * paralelo. Para `documento` mantém 1 upload único (CNH/CRLV) e
   * devolve `thumbPath: null`.
   */
  async uploadFoto(
    file: File,
    entradaId: string,
    tipo: "moto" | "status" | "documento"
  ): Promise<UploadFotoResult> {
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

    const timestamp = Date.now();
    // Sanitiza o filename para evitar caracteres problemáticos em
    // paths do Storage (ex.: `~` em "0002~2.jpg" de backups do
    // Windows, espaços, acentos, etc. — alguns backends rejeitam com
    // HTTP 400 sem mensagem clara).
    const safeName = sanitizeFilename(file.name);
    const basePath = `${user.id}/${entradaId}/${tipo}/${timestamp}-${safeName}`;

    // Documento (CNH/CRLV): upload único, mantém legibilidade do scan.
    if (tipo === "documento") {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .upload(basePath, file, {
          cacheControl: SupabaseStorageApi.FOTO_CACHE_CONTROL_SECONDS,
          upsert: true,
        });

      if (error) {
        throw new Error(`Erro ao fazer upload: ${error.message}`);
      }

      return { thumbPath: null, fullPath: basePath };
    }

    // Moto/Status: gera as 2 variantes e sobe em paralelo.
    const { thumb, full } = await gerarVariantes(file);

    // Sufixos `-thumb` / `-full` permitem identificar a variante no
    // bucket pelo próprio nome do arquivo.
    const thumbPath = basePath.replace(/(\.[^.]+)?$/, "-thumb.webp");
    const fullPath = basePath.replace(/(\.[^.]+)?$/, "-full.webp");

    const [thumbUpload, fullUpload] = await Promise.all([
      supabase.storage.from(this.bucketName).upload(thumbPath, thumb, {
        cacheControl: SupabaseStorageApi.FOTO_CACHE_CONTROL_SECONDS,
        upsert: true,
      }),
      supabase.storage.from(this.bucketName).upload(fullPath, full, {
        cacheControl: SupabaseStorageApi.FOTO_CACHE_CONTROL_SECONDS,
        upsert: true,
      }),
    ]);

    if (thumbUpload.error) {
      // Loga o erro completo do Supabase Storage (status, message,
      // statusCode) para diagnóstico — o toast da UI muitas vezes
      // esconde a causa raiz.
      console.error(
        "[SupabaseStorageApi.uploadFoto] thumb upload failed:",
        {
          path: thumbPath,
          error: thumbUpload.error,
        }
      );
      throw new Error(
        `Erro ao fazer upload (thumb): ${thumbUpload.error.message}`
      );
    }
    if (fullUpload.error) {
      console.error(
        "[SupabaseStorageApi.uploadFoto] full upload failed:",
        {
          path: fullPath,
          error: fullUpload.error,
        }
      );
      throw new Error(
        `Erro ao fazer upload (full): ${fullUpload.error.message}`
      );
    }

    return { thumbPath, fullPath };
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
   *
   * Delega para a Edge Function `listar-arquivos-storage`, que executa
   * a query SQL com filtro de período e RLS no servidor. O cliente
   * recebe o array `arquivos` no shape que o ciclo 4 vai expor e
   * reconstrói `dataCriacao: Date` a partir do ISO string.
   */
  async listarArquivosPorPeriodo(
    dataInicio: Date,
    dataFim: Date
  ): Promise<ArquivoStorage[]> {
    try {
      const { data, error } = await supabase.functions.invoke<{
        arquivos: Array<{
          caminho: string;
          nome: string;
          tamanhoBytes: number;
          dataCriacao: string;
          tipo: string;
        }>;
      }>("listar-arquivos-storage", {
        body: {
          dataInicio: dataInicio.toISOString(),
          dataFim: dataFim.toISOString(),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return (data?.arquivos ?? []).map(item => ({
        caminho: item.caminho,
        nome: item.nome,
        tamanhoBytes: item.tamanhoBytes,
        dataCriacao: new Date(item.dataCriacao),
        tipo: item.tipo,
      }));
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
