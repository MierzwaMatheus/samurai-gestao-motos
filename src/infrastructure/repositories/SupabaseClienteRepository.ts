import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { Cliente } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de clientes usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseClienteRepository implements ClienteRepository {
  async criar(cliente: Omit<Cliente, "id" | "criadoEm" | "atualizadoEm">): Promise<Cliente> {
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        endereco: cliente.endereco,
        cep: cliente.cep,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar cliente: ${error.message}`);
    }

    return this.mapToCliente(data);
  }

  async buscarPorId(id: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar cliente: ${error.message}`);
    }

    return data ? this.mapToCliente(data) : null;
  }

  async buscarPorNome(nome: string): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .ilike("nome", `%${nome}%`);

    if (error) {
      throw new Error(`Erro ao buscar clientes: ${error.message}`);
    }

    return (data || []).map(this.mapToCliente);
  }

  async buscarPorNomeOuTelefone(termo: string): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`);

    if (error) {
      throw new Error(`Erro ao buscar clientes: ${error.message}`);
    }

    return (data || []).map(this.mapToCliente);
  }

  async listar(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar clientes: ${error.message}`);
    }

    return (data || []).map(this.mapToCliente);
  }

  async atualizar(id: string, dados: Partial<Cliente>): Promise<Cliente> {
    const { data, error } = await supabase
      .from("clientes")
      .update({
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        endereco: dados.endereco,
        cep: dados.cep,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar cliente: ${error.message}`);
    }

    return this.mapToCliente(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar cliente: ${error.message}`);
    }
  }

  private mapToCliente(data: any): Cliente {
    return {
      id: data.id,
      nome: data.nome,
      telefone: data.telefone,
      email: data.email,
      endereco: data.endereco,
      cep: data.cep,
      numeroServicos: data.numero_servicos || 0,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}

