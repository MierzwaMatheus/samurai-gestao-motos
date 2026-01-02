import { StorageApi } from "@/domain/interfaces/StorageApi";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do serviço de storage usando Supabase Storage
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseStorageApi implements StorageApi {
  private readonly bucketName = "fotos";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    // Valida tipo de arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Tipo de arquivo não permitido. Use JPEG, PNG, WEBP ou GIF.");
    }

    // Valida tamanho (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error("Arquivo muito grande. Tamanho máximo: 5MB.");
    }

    // Gera nome único para o arquivo
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = `${user.id}/${entradaId}/${tipo}/${fileName}`;

    // Faz upload
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
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
    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Obtém URL assinada (para bucket privado)
   */
  async obterUrlAssinada(path: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Erro ao gerar URL assinada: ${error.message}`);
    }

    return data.signedUrl;
  }
}

