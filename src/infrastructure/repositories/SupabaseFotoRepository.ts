import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { Foto } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { TipoFoto } from "@/domain/interfaces/StorageApi";

/**
 * Implementação do repositório de fotos usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseFotoRepository implements FotoRepository {
  private storageApi = new SupabaseStorageApi();
  async criar(
    foto: Omit<Foto, "id" | "criadoEm" | "thumbPath" | "fullPath"> & {
      thumbPath?: string | null;
      fullPath?: string | null;
    }
  ): Promise<Foto> {
    const { data, error } = await supabase
      .from("fotos")
      .insert({
        entrada_id: foto.entradaId,
        url: foto.url,
        thumb_path: foto.thumbPath ?? null,
        full_path: foto.fullPath ?? null,
        tipo: foto.tipo,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar foto: ${error.message}`);
    }

    return this.mapToFoto(data);
  }

  async buscarPorId(id: string): Promise<Foto | null> {
    const { data, error } = await supabase
      .from("fotos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar foto: ${error.message}`);
    }

    if (!data) return null;

    const foto = await this.resolveSignedUrls(this.mapToFoto(data));

    return foto;
  }

  async buscarPorEntradaId(entradaId: string): Promise<Foto[]> {
    const { data, error } = await supabase
      .from("fotos")
      .select("*")
      .eq("entrada_id", entradaId)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar fotos: ${error.message}`);
    }

    // Converte filePath para URL assinada se necessário
    const fotos = await Promise.all(
      (data || []).map(async (item) => this.resolveSignedUrls(this.mapToFoto(item)))
    );

    return fotos;
  }

  async buscarPorEntradaIdETipo(entradaId: string, tipo: Foto["tipo"]): Promise<Foto[]> {
    const { data, error } = await supabase
      .from("fotos")
      .select("*")
      .eq("entrada_id", entradaId)
      .eq("tipo", tipo)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar fotos: ${error.message}`);
    }

    // Converte filePath para URL assinada se necessário
    const fotos = await Promise.all(
      (data || []).map(async (item) => this.resolveSignedUrls(this.mapToFoto(item)))
    );

    return fotos;
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("fotos")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar foto: ${error.message}`);
    }
  }

  /**
   * Resolve o `url` e os `thumbPath`/`fullPath` para URLs utilizáveis
   * quando ainda são filePaths (raw). Para fotos legadas (sem
   * thumb_path/full_path) ou para `documento` (thumb_path null), o
   * thumbPath aponta para a MESMA URL do `url` — preservando
   * compatibilidade. O cache (delegado a `urlCache`) garante que o
   * mesmo path não assina 2x.
   *
   * Ciclo 3 (issue #13): usa `obterUrlParaFoto(path, tipo)` em vez de
   * `obterUrlAssinada` direto. Para `moto`/`status` o helper retorna
   * public URL (cache indefinido) — não usa mais o caminho de signed
   * URL desnecessário, reduzindo ~30 chamadas a
   * `/storage/v1/object/sign/...` por página da Oficina. Para
   * `documento` mantém signed URL com TTL 1h.
   */
  private async resolveSignedUrls(foto: Foto): Promise<Foto> {
    const tipo: TipoFoto = foto.tipo;

    if (!foto.url.startsWith("http")) {
      foto.url = await this.storageApi.obterUrlParaFoto(foto.url, tipo);
    }

    const resolvedUrl = foto.url;
    foto.thumbPath = await this.resolvePath(foto.thumbPath, resolvedUrl, tipo);
    foto.fullPath = await this.resolvePath(foto.fullPath, resolvedUrl, tipo);

    return foto;
  }

  /**
   * Resolve um único path para uma URL utilizável:
   * - `null`/`undefined` → `fallback` (URL resolvida do `url`).
   * - Já é uma URL completa (`http`) → devolve como está.
   * - Raw path → resolve via `obterUrlParaFoto(path, tipo)`.
   */
  private async resolvePath(
    path: string | null | undefined,
    fallback: string,
    tipo: TipoFoto
  ): Promise<string> {
    if (!path) return fallback;
    if (path.startsWith("http")) return path;
    return this.storageApi.obterUrlParaFoto(path, tipo);
  }

  private mapToFoto(data: any): Foto {
    return {
      id: data.id,
      entradaId: data.entrada_id,
      url: data.url,
      thumbPath: data.thumb_path ?? null,
      fullPath: data.full_path ?? null,
      tipo: data.tipo,
      criadoEm: new Date(data.criado_em),
    };
  }
}

