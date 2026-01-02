import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { Foto } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de fotos usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseFotoRepository implements FotoRepository {
  async criar(foto: Omit<Foto, "id" | "criadoEm">): Promise<Foto> {
    const { data, error } = await supabase
      .from("fotos")
      .insert({
        entrada_id: foto.entradaId,
        url: foto.url,
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

    const foto = this.mapToFoto(data);
    
    // Se a URL parece ser um filePath (não começa com http), gera URL assinada
    if (!foto.url.startsWith("http")) {
      const { data: signedUrlData } = await supabase.storage
        .from("fotos")
        .createSignedUrl(foto.url, 3600); // 1 hora
      
      if (signedUrlData) {
        foto.url = signedUrlData.signedUrl;
      }
    }

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
      (data || []).map(async (item) => {
        const foto = this.mapToFoto(item);
        // Se a URL parece ser um filePath (não começa com http), gera URL assinada
        if (!foto.url.startsWith("http")) {
          const { data: signedUrlData } = await supabase.storage
            .from("fotos")
            .createSignedUrl(foto.url, 3600); // 1 hora
          
          if (signedUrlData) {
            foto.url = signedUrlData.signedUrl;
          }
        }
        return foto;
      })
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

  private mapToFoto(data: any): Foto {
    return {
      id: data.id,
      entradaId: data.entrada_id,
      url: data.url,
      tipo: data.tipo,
      criadoEm: new Date(data.criado_em),
    };
  }
}

