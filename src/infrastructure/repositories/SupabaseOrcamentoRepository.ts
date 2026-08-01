import {
  BuscarPaginaOrcamentosParams,
  OrcamentoRepository,
  Pagina,
} from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { Orcamento, OrcamentoCompleto } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";

/**
 * Implementação do repositório de orçamentos usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseOrcamentoRepository implements OrcamentoRepository {
  private storageApi = new SupabaseStorageApi();

  constructor(private tipoServicoRepo?: TipoServicoRepository) {
    // Permite instanciação sem parâmetros
  }
  async criar(
    orcamento: Omit<Orcamento, "id" | "criadoEm" | "atualizadoEm">
  ): Promise<Orcamento> {
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

  async buscarCompletosPorStatus(
    status: Orcamento["status"]
  ): Promise<OrcamentoCompleto[]> {
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
        throw new Error(
          `Erro ao buscar orçamentos: ${orcamentosError.message}`
        );
      }

      if (!orcamentos || orcamentos.length === 0) {
        return [];
      }

      // Busca entradas relacionadas em uma única query
      const entradaIds = orcamentos.map((o: any) => o.entrada_id);
      const { data: entradas, error: entradasError } = await supabase
        .from("entradas")
        .select(
          "id, descricao, frete, valor_cobrado, endereco, cep, data_orcamento, cliente_id, moto_id"
        )
        .in("id", entradaIds);

      if (entradasError) {
        throw new Error(`Erro ao buscar entradas: ${entradasError.message}`);
      }

      // Busca clientes e motos em paralelo
      const clienteIds = Array.from(
        new Set(entradas?.map((e: any) => e.cliente_id).filter(Boolean) || [])
      );
      const motoIds = Array.from(
        new Set(entradas?.map((e: any) => e.moto_id).filter(Boolean) || [])
      );

      // Valida que os IDs são UUIDs válidos
      const clienteIdsValidos = clienteIds.filter(id =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id
        )
      );
      const motoIdsValidos = motoIds.filter(id =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id
        )
      );

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
        throw new Error(
          `Erro ao buscar clientes: ${clientesResult.error.message}`
        );
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
            const signedUrl = await this.storageApi.obterUrlAssinada(url);
            return [entradaId, signedUrl];
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
        const tiposServicoPromises = entradaIds.map(async entradaId => {
          try {
            const tipos =
              await this.tipoServicoRepo!.buscarPorEntradaId(entradaId);
            return [entradaId, tipos];
          } catch (error) {
            console.error(
              `Erro ao buscar tipos de serviço para entrada ${entradaId}:`,
              error
            );
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
          frete:
            entrada?.frete !== null && entrada?.frete !== undefined
              ? parseFloat(entrada.frete)
              : null,
          valorCobrado: entrada?.valor_cobrado
            ? parseFloat(entrada.valor_cobrado)
            : undefined,
          endereco: entrada?.endereco,
          cep: entrada?.cep,
          fotoMoto: entrada?.id ? fotosMapFinal[entrada.id] : undefined,
          dataOrcamento: entrada?.data_orcamento
            ? new Date(entrada.data_orcamento)
            : undefined,
          tiposServico: entrada?.id ? tiposServicoMap[entrada.id] || [] : [],
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async buscarPagina({
    page,
    pageSize,
    status,
  }: BuscarPaginaOrcamentosParams): Promise<Pagina<OrcamentoCompleto>> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: orcamentos, error: orcamentosError } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("status", status)
      .range(from, to)
      .order("criado_em", { ascending: false })
      .limit(pageSize);

    if (orcamentosError) {
      throw new Error(`Erro ao buscar orçamentos: ${orcamentosError.message}`);
    }

    const { count, error: countError } = await supabase
      .from("orcamentos")
      .select("*", { count: "exact", head: true })
      .eq("status", status);

    if (countError) {
      throw new Error(`Erro ao contar orçamentos: ${countError.message}`);
    }

    if (!orcamentos?.length) {
      return { items: [], total: count ?? 0, page, pageSize };
    }

    const entradaIds = Array.from(
      new Set(orcamentos.map((orcamento: any) => orcamento.entrada_id))
    );
    const { data: entradas, error: entradasError } = await supabase
      .from("entradas")
      .select(
        "id, descricao, frete, valor_cobrado, endereco, cep, data_orcamento, cliente_id, moto_id"
      )
      .in("id", entradaIds);

    if (entradasError) {
      throw new Error(`Erro ao buscar entradas: ${entradasError.message}`);
    }

    const isUuid = (id: unknown): id is string =>
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );
    const clienteIdsValidos = Array.from(
      new Set(
        (entradas || [])
          .map((entrada: any) => entrada.cliente_id)
          .filter(isUuid)
      )
    );
    const motoIdsValidos = Array.from(
      new Set(
        (entradas || []).map((entrada: any) => entrada.moto_id).filter(isUuid)
      )
    );

    const [clientesResult, motosResult, fotosResult, vinculosResult] =
      await Promise.all([
        clienteIdsValidos.length
          ? supabase
              .from("clientes")
              .select("id, nome, telefone")
              .in("id", clienteIdsValidos)
          : Promise.resolve({ data: [], error: null }),
        motoIdsValidos.length
          ? supabase
              .from("motos")
              .select(
                "id, modelo, placa, marca, ano, cilindrada, final_numero_quadro"
              )
              .in("id", motoIdsValidos)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("fotos")
          .select("entrada_id, url")
          .in("entrada_id", entradaIds)
          .eq("tipo", "moto")
          .order("criado_em", { ascending: false }),
        supabase
          .from("entradas_tipos_servico")
          .select("entrada_id, tipo_servico_id, quantidade, com_oleo")
          .in("entrada_id", entradaIds),
      ]);

    if (clientesResult.error) {
      throw new Error(
        `Erro ao buscar clientes: ${clientesResult.error.message}`
      );
    }
    if (motosResult.error) {
      throw new Error(`Erro ao buscar motos: ${motosResult.error.message}`);
    }
    if (fotosResult.error) {
      throw new Error(`Erro ao buscar fotos: ${fotosResult.error.message}`);
    }
    if (vinculosResult.error) {
      throw new Error(
        `Erro ao buscar vínculos de tipos de serviço: ${vinculosResult.error.message}`
      );
    }

    const tipoServicoIds = Array.from(
      new Set(
        (vinculosResult.data || []).map(
          (vinculo: any) => vinculo.tipo_servico_id
        )
      )
    );
    const tiposResult = tipoServicoIds.length
      ? await supabase
          .from("tipos_servico")
          .select("*")
          .in("id", tipoServicoIds)
      : { data: [], error: null };

    if (tiposResult.error) {
      throw new Error(
        `Erro ao buscar tipos de serviço: ${tiposResult.error.message}`
      );
    }

    const fotosPorEntrada: Record<string, string> = {};
    for (const foto of fotosResult.data || []) {
      if (!fotosPorEntrada[foto.entrada_id]) {
        fotosPorEntrada[foto.entrada_id] = foto.url;
      }
    }
    const fotosAssinadas = await Promise.all(
      Object.entries(fotosPorEntrada).map(async ([entradaId, url]) => [
        entradaId,
        url.startsWith("http")
          ? url
          : await this.storageApi.obterUrlAssinada(url),
      ])
    );

    const entradasMap = new Map(
      (entradas || []).map((entrada: any) => [entrada.id, entrada])
    );
    const clientesMap = new Map(
      (clientesResult.data || []).map((cliente: any) => [cliente.id, cliente])
    );
    const motosMap = new Map(
      (motosResult.data || []).map((moto: any) => [moto.id, moto])
    );
    const fotosMap = Object.fromEntries(fotosAssinadas);
    const tiposMap = new Map(
      (tiposResult.data || []).map((tipo: any) => [tipo.id, tipo])
    );
    const servicosPorEntrada: Record<string, any[]> = {};

    for (const vinculo of vinculosResult.data || []) {
      const tipo = tiposMap.get(vinculo.tipo_servico_id) as any;
      if (!tipo) continue;
      (servicosPorEntrada[vinculo.entrada_id] ||= []).push({
        id: tipo.id,
        nome: tipo.nome,
        precoOficina: parseFloat(tipo.preco_oficina ?? tipo.valor ?? 0) || 0,
        precoParticular:
          parseFloat(tipo.preco_particular ?? tipo.valor ?? 0) || 0,
        categoria: tipo.categoria || "padrao",
        precoOficinaComOleo: tipo.preco_oficina_com_oleo
          ? parseFloat(tipo.preco_oficina_com_oleo)
          : undefined,
        precoOficinaSemOleo: tipo.preco_oficina_sem_oleo
          ? parseFloat(tipo.preco_oficina_sem_oleo)
          : undefined,
        precoParticularComOleo: tipo.preco_particular_com_oleo
          ? parseFloat(tipo.preco_particular_com_oleo)
          : undefined,
        precoParticularSemOleo: tipo.preco_particular_sem_oleo
          ? parseFloat(tipo.preco_particular_sem_oleo)
          : undefined,
        quantidadeServicos: tipo.quantidade_servicos || 0,
        criadoEm: new Date(tipo.criado_em),
        atualizadoEm: new Date(tipo.atualizado_em),
        quantidade: vinculo.quantidade || 1,
        comOleo: vinculo.com_oleo || false,
      });
    }

    const items = orcamentos.map((orcamento: any) => {
      const entrada = entradasMap.get(orcamento.entrada_id) as any;
      const cliente = entrada
        ? (clientesMap.get(entrada.cliente_id) as any)
        : undefined;
      const moto = entrada ? (motosMap.get(entrada.moto_id) as any) : undefined;

      return {
        ...this.mapToOrcamento(orcamento),
        cliente: cliente?.nome || "Cliente não encontrado",
        telefone: cliente?.telefone,
        moto: moto?.modelo || "Moto não encontrada",
        marca: moto?.marca,
        ano: moto?.ano,
        cilindrada: moto?.cilindrada,
        placa: moto?.placa,
        finalNumeroQuadro: moto?.final_numero_quadro,
        descricao: entrada?.descricao,
        frete:
          entrada?.frete !== null && entrada?.frete !== undefined
            ? parseFloat(entrada.frete)
            : null,
        valorCobrado: entrada?.valor_cobrado
          ? parseFloat(entrada.valor_cobrado)
          : undefined,
        endereco: entrada?.endereco,
        cep: entrada?.cep,
        fotoMoto: entrada?.id ? fotosMap[entrada.id] : undefined,
        dataOrcamento: entrada?.data_orcamento
          ? new Date(entrada.data_orcamento)
          : undefined,
        tiposServico: entrada?.id ? servicosPorEntrada[entrada.id] || [] : [],
      };
    });

    return { items, total: count ?? 0, page, pageSize };
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
    if (dados.dataExpiracao !== undefined)
      updateData.data_expiracao = dados.dataExpiracao.toISOString();
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
    const { error } = await supabase.from("orcamentos").delete().eq("id", id);

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
            console.error(
              "Erro ao atualizar orçamentos expirados:",
              updateError
            );
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
