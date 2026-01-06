import { UsuarioRepository } from "@/domain/interfaces/UsuarioRepository";
import { Usuario, AtualizarUsuarioInput } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de usuários usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseUsuarioRepository implements UsuarioRepository {
  async criar(usuario: Omit<Usuario, "id" | "criadoEm" | "atualizadoEm">): Promise<Usuario> {
    const { data, error } = await supabase
      .from("usuarios")
      .insert({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        permissao: usuario.permissao,
        ativo: usuario.ativo,
        criado_por: usuario.criadoPor,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar usuário: ${error.message}`);
    }

    return this.mapToUsuario(data);
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }

    return data ? this.mapToUsuario(data) : null;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar usuário por email: ${error.message}`);
    }

    return data ? this.mapToUsuario(data) : null;
  }

  async listar(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar usuários: ${error.message}`);
    }

    return (data || []).map((item) => this.mapToUsuario(item));
  }

  async atualizar(id: string, dados: AtualizarUsuarioInput): Promise<Usuario> {
    const updateData: any = {};

    if (dados.nome !== undefined) {
      updateData.nome = dados.nome;
    }
    if (dados.permissao !== undefined) {
      updateData.permissao = dados.permissao;
    }
    if (dados.ativo !== undefined) {
      updateData.ativo = dados.ativo;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar usuário: ${error.message}`);
    }

    return this.mapToUsuario(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("usuarios")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar usuário: ${error.message}`);
    }
  }

  private mapToUsuario(data: any): Usuario {
    return {
      id: data.id,
      nome: data.nome,
      email: data.email,
      permissao: data.permissao,
      ativo: data.ativo,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
      criadoPor: data.criado_por,
    };
  }
}

