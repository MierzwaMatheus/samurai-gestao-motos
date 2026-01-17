import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { Orcamento, OrcamentoCompleto } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

/**
 * Implementação do repositório de orçamentos usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseOrcamentoRepository implements OrcamentoRepository {
  constructor(private tipoServicoRepo?: TipoServicoRepository) {
    // Permite instanciação sem parâmetros
  }
  async criar(orcamento: Omit<Orcamento, "id" | "criadoEm" | "atualizadoEm">): Promise<Orcamento> {
    const { data, error } = await supabase
      .from("orcamentos")
      .insert({
        entrada_id: orcamento.entradaId,
        valor: orcamento.valor,
        data_expiracao: orcamento.dataExpiracao.toISOString(),
        status: orcamento.status,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar orçamento: ${error.message}`);
    }

    return this.mapToOrcamento(data);
  }

  async buscarPorId(id: string): Promise<Orcamento | null> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar orçamento: ${error.message}`);
    }

    return data ? this.mapToOrcamento(data) : null;
  }

  async buscarPorEntradaId(entradaId: string): Promise<Orcamento | null> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("entrada_id", entradaId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar orçamento: ${error.message}`);
    }

    return data ? this.mapToOrcamento(data) : null;
  }

  async buscarCompletosPorStatus(status: Orcamento["status"]): Promise<OrcamentoCompleto[]> {
    try {
      // Primeiro, atualiza orçamentos expirados
      await this.atualizarOrcamentosExpirados();

      // Busca orçamentos
      const { data: orcamentos, error: orcamentosError } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("status", status)
        .order("criado_em", { ascending: false });

      if (orcamentosError) {
        throw new Error(`Erro ao buscar orçamentos: ${orcamentosError.message}`);
      }

      if (!orcamentos || orcamentos.length === 0) {
        return [];
      }

      // Busca entradas relacionadas em uma única query
      const entradaIds = orcamentos.map((o: any) => o.entrada_id);
      const { data: entradas, error: entradasError } = await supabase
        .from("entradas")
        .select("id, descricao, frete, valor_cobrado, endereco, cep, data_orcamento, cliente_id, moto_id")
        .in("id", entradaIds);

      if (entradasError) {
        throw new Error(`Erro ao buscar entradas: ${entradasError.message}`);
      }

      // Busca clientes e motos em paralelo
      const clienteIds = Array.from(new Set(entradas?.map((e: any) => e.cliente_id).filter(Boolean) || []));
      const motoIds = Array.from(new Set(entradas?.map((e: any) => e.moto_id).filter(Boolean) || []));

      // Valida que os IDs são UUIDs válidos
      const clienteIdsValidos = clienteIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
      const motoIdsValidos = motoIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

      const [clientesResult, motosResult] = await Promise.all([
        clienteIdsValidos.length > 0
          ? supabase
              .from("clientes")
              .select("id, nome, telefone")
              .in("id", clienteIdsValidos)
          : Promise.resolve({ data: [], error: null }),
        motoIdsValidos.length > 0
          ? supabase
              .from("motos")
              .select("id, modelo, placa, marca, ano, cilindrada")
              .in("id", motoIdsValidos)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (clientesResult.error) {
        console.error("Erro ao buscar clientes:", clientesResult.error);
        throw new Error(`Erro ao buscar clientes: ${clientesResult.error.message}`);
      }
      if (motosResult.error) {
        console.error("Erro ao buscar motos:", motosResult.error);
        console.error("Moto IDs:", motoIdsValidos);
        throw new Error(`Erro ao buscar motos: ${motosResult.error.message}`);
      }

      const clientes = clientesResult.data || [];
      const motos = motosResult.data || [];

      // Busca fotos para todas as entradas de uma vez
      let fotosMap: Record<string, string> = {};

      if (entradaIds.length > 0) {
        const { data: fotos, error: fotosError } = await supabase
          .from("fotos")
          .select("entrada_id, url")
          .in("entrada_id", entradaIds)
          .eq("tipo", "moto")
          .order("criado_em", { ascending: false });

        if (!fotosError && fotos) {
          // Cria mapa de entrada_id -> primeira foto
          fotos.forEach((foto: any) => {
            if (!fotosMap[foto.entrada_id]) {
              fotosMap[foto.entrada_id] = foto.url;
            }
          });
        }
      }

      // Gera URLs assinadas para as fotos (se necessário) em paralelo
      const fotosComUrls = await Promise.all(
        Object.entries(fotosMap).map(async ([entradaId, url]) => {
          // Se não é URL completa, gera URL assinada
          if (!url.startsWith("http")) {
            const { data: signedUrlData } = await supabase.storage
              .from("fotos")
              .createSignedUrl(url, 3600);
            
            if (signedUrlData) {
              return [entradaId, signedUrlData.signedUrl];
            }
          }
          return [entradaId, url];
        })
      );

      const fotosMapFinal = Object.fromEntries(fotosComUrls);

      // Cria mapas para acesso rápido
      const entradasMap = new Map(entradas?.map((e: any) => [e.id, e]) || []);
      const clientesMap = new Map(clientes.map((c: any) => [c.id, c]));
      const motosMap = new Map(motos.map((m: any) => [m.id, m]));

      // Busca tipos de serviço para todas as entradas
      let tiposServicoMap: Record<string, any[]> = {};
      if (this.tipoServicoRepo && entradaIds.length > 0) {
        const tiposServicoPromises = entradaIds.map(async (entradaId) => {
          try {
            const tipos = await this.tipoServicoRepo!.buscarPorEntradaId(entradaId);
            return [entradaId, tipos];
          } catch (error) {
            console.error(`Erro ao buscar tipos de serviço para entrada ${entradaId}:`, error);
            return [entradaId, []];
          }
        });
        const tiposServicoResults = await Promise.all(tiposServicoPromises);
        tiposServicoMap = Object.fromEntries(tiposServicoResults);
      }

      // Mapeia os dados completos
      return orcamentos.map((orcamento: any) => {
        const entrada = entradasMap.get(orcamento.entrada_id);
        const cliente = entrada ? clientesMap.get(entrada.cliente_id) : null;
        const moto = entrada ? motosMap.get(entrada.moto_id) : null;

        return {
          ...this.mapToOrcamento(orcamento),
          cliente: cliente?.nome || "Cliente não encontrado",
          telefone: cliente?.telefone,
          moto: moto?.modelo || "Moto não encontrada",
          marca: moto?.marca,
          ano: moto?.ano,
          cilindrada: moto?.cilindrada,
          placa: moto?.placa,
          finalNumeroQuadro: (moto as any)?.final_numero_quadro,
          descricao: entrada?.descricao,
          frete: entrada?.frete ? parseFloat(entrada.frete) : 0,
          valorCobrado: entrada?.valor_cobrado ? parseFloat(entrada.valor_cobrado) : undefined,
          endereco: entrada?.endereco,
          cep: entrada?.cep,
          fotoMoto: entrada?.id ? fotosMapFinal[entrada.id] : undefined,
          dataOrcamento: entrada?.data_orcamento ? new Date(entrada.data_orcamento) : undefined,
          tiposServico: entrada?.id ? tiposServicoMap[entrada.id] || [] : [],
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async listar(): Promise<Orcamento[]> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar orçamentos: ${error.message}`);
    }

    return (data || []).map(this.mapToOrcamento);
  }

  async atualizar(id: string, dados: Partial<Orcamento>): Promise<Orcamento> {
    const updateData: any = {};
    if (dados.valor !== undefined) updateData.valor = dados.valor;
    if (dados.dataExpiracao !== undefined) updateData.data_expiracao = dados.dataExpiracao.toISOString();
    if (dados.status !== undefined) updateData.status = dados.status;

    const { data, error } = await supabase
      .from("orcamentos")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar orçamento: ${error.message}`);
    }

    return this.mapToOrcamento(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase
      .from("orcamentos")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar orçamento: ${error.message}`);
    }
  }

  private async atualizarOrcamentosExpirados(): Promise<void> {
    try {
      const { error } = await supabase.rpc("atualizar_orcamentos_expirados");
      if (error) {
        // Se a função não existir, faz update manual
        if (error.code === "42883") {
          const { error: updateError } = await supabase
            .from("orcamentos")
            .update({ status: "expirado" })
            .eq("status", "ativo")
            .lt("data_expiracao", new Date().toISOString());
          
          if (updateError) {
            console.error("Erro ao atualizar orçamentos expirados:", updateError);
          }
        } else {
          console.error("Erro ao chamar função de atualização:", error);
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar orçamentos expirados:", err);
    }
  }

  private mapToOrcamento(data: any): Orcamento {
    return {
      id: data.id,
      entradaId: data.entrada_id,
      valor: parseFloat(data.valor || 0),
      dataExpiracao: new Date(data.data_expiracao),
      status: data.status,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}

