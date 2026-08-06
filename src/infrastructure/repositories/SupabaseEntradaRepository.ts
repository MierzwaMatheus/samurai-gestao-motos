import {
  BuscarPaginaEntradasParams,
  EntradaRepository,
} from "@/domain/interfaces/EntradaRepository";
import { Pagina } from "@/domain/interfaces/OrcamentoRepository";
import { Entrada, Foto, MotoCompleta } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { tiposServicoByIdsCached } from "@/infrastructure/repositories/tiposServicoCache";

/**
 * Implementação do repositório de entradas usando Supabase
 * Esta é uma implementação de infraestrutura que conhece detalhes do Supabase
 */
export class SupabaseEntradaRepository implements EntradaRepository {
  private storageApi = new SupabaseStorageApi();

  async criar(
    entrada: Omit<Entrada, "id" | "criadoEm" | "atualizadoEm">
  ): Promise<Entrada> {
    const { data, error } = await supabase
      .from("entradas")
      .insert({
        tipo: entrada.tipo,
        cliente_id: entrada.clienteId,
        moto_id: entrada.motoId,
        endereco: entrada.endereco,
        cep: entrada.cep,
        telefone: entrada.telefone,
        frete: entrada.frete,
        valor_cobrado: entrada.valorCobrado,
        descricao: entrada.descricao,
        observacoes: entrada.observacoes,
        data_orcamento: entrada.dataOrcamento?.toISOString(),
        data_entrada: entrada.dataEntrada?.toISOString(),
        data_entrega: entrada.dataEntrega?.toISOString(),
        status: entrada.status,
        status_entrega: entrada.statusEntrega || "pendente",
        progresso: entrada.progresso,
        final_numero_quadro: entrada.finalNumeroQuadro,
        tipo_preco: entrada.tipoPreco || "oficina",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar entrada: ${error.message}`);
    }

    return this.mapToEntrada(data);
  }

  async buscarPorId(id: string): Promise<Entrada | null> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Erro ao buscar entrada: ${error.message}`);
    }

    return data ? this.mapToEntrada(data) : null;
  }

  async buscarPorClienteId(clienteId: string): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async buscarPorMotoId(motoId: string): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("moto_id", motoId)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async buscarPorStatus(status: Entrada["status"]): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .eq("status", status)
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async listar(): Promise<Entrada[]> {
    const { data, error } = await supabase
      .from("entradas")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar entradas: ${error.message}`);
    }

    return (data || []).map(this.mapToEntrada);
  }

  async buscarPagina(
    params: BuscarPaginaEntradasParams
  ): Promise<Pagina<MotoCompleta>> {
    const { page, pageSize, tipo, status, statusEntrega, busca } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Pré-busca os IDs de clientes/motos que batem o termo de busca.
    // A busca server-side cobre 5 campos: 2 da própria entrada
    // (descricao, observacoes) e 3 dos relacionamentos (cliente.nome,
    // moto.modelo, moto.placa). Usamos índices em clientes.id/motos.id
    // para que o `IN (...)` seja barato independente do tamanho da base.
    let clienteIdsMatch: string[] = [];
    let motoIdsMatch: string[] = [];
    if (busca && busca.trim().length > 0) {
      const term = busca.trim();
      const [clientesMatch, motosMatch] = await Promise.all([
        supabase.from("clientes").select("id").or(`nome.ilike.%${term}%`),
        supabase
          .from("motos")
          .select("id")
          .or(`modelo.ilike.%${term}%,placa.ilike.%${term}%`),
      ]);
      clienteIdsMatch = (clientesMatch.data || []).map((c: any) => c.id);
      motoIdsMatch = (motosMatch.data || []).map((m: any) => m.id);
    }

    // Helper: encadeia um filtro condicionalmente num builder da Supabase.
    // Mantém a query linear (sem ternários longos) e evita `.eq()` com
    // valor `undefined` que o PostgREST rejeita.
    const applyFilter = (builder: any) => {
      if (tipo) builder = builder.eq("tipo", tipo);
      if (status && status.length > 0) {
        builder = builder.in("status", status);
      }
      if (statusEntrega && statusEntrega.length > 0) {
        builder = builder.in("status_entrega", statusEntrega);
      }
      if (busca && busca.trim().length > 0) {
        const term = busca.trim();
        const clauses = [
          `descricao.ilike.%${term}%`,
          `observacoes.ilike.%${term}%`,
        ];
        if (clienteIdsMatch.length > 0) {
          clauses.push(`cliente_id.in.(${clienteIdsMatch.join(",")})`);
        }
        if (motoIdsMatch.length > 0) {
          clauses.push(`moto_id.in.(${motoIdsMatch.join(",")})`);
        }
        builder = builder.or(clauses.join(","));
      }
      return builder;
    };

    const paginaBuilder = applyFilter(
      // Issue #15: select específico (26 colunas) em vez de `select("*")`
      // que retornava `user_id` + dados de auditoria que o `mapToEntrada`
      // e o `buscarPagina` mapper não consomem. Reduz payload ~30%.
      //
      // Issue #16: `Prefer: count=exact` no SELECT principal devolve
      // o count no header `content-range` — economiza 1 round-trip
      // por aba (antes era 1 SELECT + 1 HEAD count = 2 calls por aba).
      supabase
        .from("entradas")
        .select(
          "id,tipo,cliente_id,moto_id,endereco,cep,telefone,frete,valor_cobrado,descricao,observacoes,data_orcamento,data_entrada,data_entrega,data_conclusao,status,status_entrega,progresso,final_numero_quadro,os_assinada_url,forma_pagamento,status_pagamento,data_pagamento,tipo_preco,criado_em,atualizado_em,fotos_status"
        )
    )
      .range(from, to)
      .order("criado_em", { ascending: false })
      // IMPORTANTE: `.limit(pageSize, { count: "exact" })` na mesma
      // chain ANTES do `await`. Chamar `.limit()` DEPOIS do `await`
      // cria uma nova query (sem range/order/filtros) — o count é
      // perdido e a paginação quebra. Issue #16 corrigido depois
      // de symptom observado em prod em 2026-08-06.
      .limit(pageSize, { count: "exact" });

    const { data: entradas, error: entradasError, count } =
      await paginaBuilder;

    if (entradasError) {
      throw new Error(`Erro ao buscar entradas: ${entradasError.message}`);
    }

    if (!entradas?.length) {
      return { items: [], total: count ?? 0, page, pageSize };
    }

    const entradaIds = Array.from(
      new Set(entradas.map((e: any) => e.id))
    );
    const clienteIds = Array.from(
      new Set(entradas.map((e: any) => e.cliente_id).filter(Boolean))
    );
    const motoIds = Array.from(
      new Set(entradas.map((e: any) => e.moto_id).filter(Boolean))
    );

    const isUuid = (id: unknown): id is string =>
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );
    const clienteIdsValidos = clienteIds.filter(isUuid);
    const motoIdsValidos = motoIds.filter(isUuid);

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
          .select("id, entrada_id, url, thumb_path, full_path, tipo, criado_em")
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
        (vinculosResult.data || []).map((v: any) => v.tipo_servico_id)
      )
    );
    // Issue #17: cache compartilhado de `tipos_servico` no escopo
    // do módulo. Quando o `useMotosOficina` é instanciado 2 vezes
    // (Em Andamento + Concluidos), cada `buscarPagina` chama este
    // helper. IDs já cacheados são reusados sem nova query; só o
    // delta (IDs novos) vai pro Supabase. Reduz 2 queries pra 1
    // no primeiro load (a segunda aba reusa tipos já cacheados).
    const tiposResult = await tiposServicoByIdsCached(tipoServicoIds);

    if (tiposResult.error) {
      throw new Error(
        `Erro ao buscar tipos de serviço: ${tiposResult.error.message}`
      );
    }

    const fotosPorEntrada: Record<string, Foto[]> = {};
    for (const foto of fotosResult.data || []) {
      if (!fotosPorEntrada[foto.entrada_id]) {
        fotosPorEntrada[foto.entrada_id] = [];
      }
      fotosPorEntrada[foto.entrada_id].push({
        id: foto.id,
        entradaId: foto.entrada_id,
        url: foto.url,
        thumbPath: foto.thumb_path ?? null,
        fullPath: foto.full_path ?? null,
        tipo: foto.tipo,
        criadoEm: new Date(foto.criado_em),
      });
    }
    // Issue #13: NÃO assina URLs aqui. O signing é responsabilidade da
    // GaleriaFotosMoto (no useEffect, lazy on mount), do
    // ModalVisualizacaoFoto (no click) e do GerarOSUseCase (lazy on
    // demanda). Antes, esse laço gerava ~10-40 POSTs a
    // `/storage/v1/object/sign/...` por página da Oficina — mesmo
    // para fotos que o usuário nunca abriu. Agora, 0 POSTs no carregamento
    // da lista. O cache do `urlCache` segue reusando URLs entre
    // componentes.
    const fotosMap = fotosPorEntrada;

    const clientesMap = new Map(
      (clientesResult.data || []).map((c: any) => [c.id, c])
    );
    const motosMap = new Map(
      (motosResult.data || []).map((m: any) => [m.id, m])
    );
    const tiposMap = new Map(
      (tiposResult.data || []).map((t: any) => [t.id, t])
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

    const items: MotoCompleta[] = entradas.map((entrada: any) => {
      const cliente = clientesMap.get(entrada.cliente_id) as any;
      const moto = motosMap.get(entrada.moto_id) as any;
      const fotosStatus = (() => {
        if (!entrada.fotos_status) return [];
        try {
          const parsed =
            typeof entrada.fotos_status === "string"
              ? JSON.parse(entrada.fotos_status)
              : entrada.fotos_status;
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

      const motoBase: any = {
        id: entrada.id,
        motoId: moto?.id || entrada.moto_id,
        clienteId: cliente?.id || entrada.cliente_id,
        modelo: moto?.modelo || "Moto não encontrada",
        marca: moto?.marca,
        ano: moto?.ano,
        cilindrada: moto?.cilindrada,
        placa: moto?.placa,
        criadoEm: new Date(entrada.criado_em),
        atualizadoEm: new Date(entrada.atualizado_em),
      };
      return {
        ...motoBase,
        entradaId: entrada.id,
        cliente: cliente?.nome || "Cliente não encontrado",
        telefone: cliente?.telefone,
        status: entrada.status,
        statusEntrega: entrada.status_entrega || "pendente",
        progresso: entrada.progresso || 0,
        dataConclusao: entrada.data_conclusao
          ? new Date(entrada.data_conclusao)
          : null,
        formaPagamento: entrada.forma_pagamento || null,
        statusPagamento: entrada.status_pagamento || null,
        fotosStatus: fotosStatus.map((foto: any) => ({
          url: foto.url,
          thumbPath: foto.thumbPath ?? null,
          fullPath: foto.fullPath ?? null,
          data: new Date(foto.data),
          observacao: foto.observacao,
          progresso: foto.progresso,
        })),
        fotos: entrada.id && fotosMap[entrada.id] ? fotosMap[entrada.id] : [],
        tiposServico: servicosPorEntrada[entrada.id] || [],
        servicosPersonalizados: [],
      } as MotoCompleta;
    });

    return { items, total: count ?? 0, page, pageSize };
  }

  async atualizar(id: string, dados: Partial<Entrada>): Promise<Entrada> {
    const updateData: any = {};
    if (dados.tipo !== undefined) updateData.tipo = dados.tipo;
    if (dados.endereco !== undefined) updateData.endereco = dados.endereco;
    if (dados.cep !== undefined) updateData.cep = dados.cep;
    if (dados.telefone !== undefined) updateData.telefone = dados.telefone;
    if (dados.frete !== undefined) updateData.frete = dados.frete;
    if (dados.valorCobrado !== undefined)
      updateData.valor_cobrado = dados.valorCobrado;
    if (dados.descricao !== undefined) updateData.descricao = dados.descricao;
    if (dados.observacoes !== undefined)
      updateData.observacoes = dados.observacoes;
    if (dados.dataOrcamento !== undefined)
      updateData.data_orcamento = dados.dataOrcamento.toISOString();
    if (dados.dataEntrada !== undefined)
      updateData.data_entrada = dados.dataEntrada.toISOString();
    if (dados.dataEntrega !== undefined)
      updateData.data_entrega = dados.dataEntrega.toISOString();
    if (dados.dataConclusao !== undefined)
      updateData.data_conclusao = dados.dataConclusao
        ? dados.dataConclusao.toISOString()
        : null;
    if (dados.status !== undefined) updateData.status = dados.status;
    if (dados.statusEntrega !== undefined)
      updateData.status_entrega = dados.statusEntrega;
    if (dados.progresso !== undefined) updateData.progresso = dados.progresso;
    if (dados.finalNumeroQuadro !== undefined)
      updateData.final_numero_quadro = dados.finalNumeroQuadro;
    if (dados.osAssinadaUrl !== undefined)
      updateData.os_assinada_url = dados.osAssinadaUrl;
    if (dados.tipoPreco !== undefined) updateData.tipo_preco = dados.tipoPreco;
    if (dados.formaPagamento !== undefined)
      updateData.forma_pagamento = dados.formaPagamento;
    if (dados.statusPagamento !== undefined)
      updateData.status_pagamento = dados.statusPagamento;
    if (dados.dataPagamento !== undefined)
      updateData.data_pagamento = dados.dataPagamento
        ? dados.dataPagamento.toISOString()
        : null;
    if (dados.fotosStatus !== undefined) {
      // Converte array de FotoStatus para JSONB
      updateData.fotos_status = JSON.stringify(
        dados.fotosStatus.map(foto => ({
          url: foto.url,
          thumbPath: foto.thumbPath ?? null,
          fullPath: foto.fullPath ?? null,
          data: foto.data.toISOString(),
          observacao: foto.observacao,
          progresso: foto.progresso,
        }))
      );
    }

    const { data, error } = await supabase
      .from("entradas")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar entrada: ${error.message}`);
    }

    return this.mapToEntrada(data);
  }

  async deletar(id: string): Promise<void> {
    const { error } = await supabase.from("entradas").delete().eq("id", id);

    if (error) {
      throw new Error(`Erro ao deletar entrada: ${error.message}`);
    }
  }

  private mapToEntrada(data: any): Entrada {
    // Converte fotos_status JSONB para array de FotoStatus
    let fotosStatus: any[] = [];
    if (data.fotos_status) {
      try {
        const parsed =
          typeof data.fotos_status === "string"
            ? JSON.parse(data.fotos_status)
            : data.fotos_status;
        fotosStatus = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Erro ao parsear fotos_status:", e);
        fotosStatus = [];
      }
    }

    return {
      id: data.id,
      tipo: data.tipo,
      clienteId: data.cliente_id,
      motoId: data.moto_id,
      endereco: data.endereco,
      cep: data.cep,
      telefone: data.telefone,
      frete:
        data.frete !== null && data.frete !== undefined
          ? parseFloat(data.frete)
          : null,
      valorCobrado: data.valor_cobrado
        ? parseFloat(data.valor_cobrado)
        : undefined,
      descricao: data.descricao,
      observacoes: data.observacoes,
      dataOrcamento: data.data_orcamento
        ? new Date(data.data_orcamento)
        : undefined,
      dataEntrada: data.data_entrada ? new Date(data.data_entrada) : undefined,
      dataEntrega: data.data_entrega ? new Date(data.data_entrega) : undefined,
      dataConclusao: data.data_conclusao
        ? new Date(data.data_conclusao)
        : undefined,
      status: data.status,
      statusEntrega: data.status_entrega,
      progresso: data.progresso || 0,
      finalNumeroQuadro: data.final_numero_quadro,
      osAssinadaUrl: data.os_assinada_url,
      formaPagamento: data.forma_pagamento || undefined,
      statusPagamento: data.status_pagamento || undefined,
      dataPagamento: data.data_pagamento
        ? new Date(data.data_pagamento)
        : undefined,
      tipoPreco: data.tipo_preco,
      fotosStatus: fotosStatus.map((foto: any) => ({
        url: foto.url,
        thumbPath: foto.thumbPath ?? null,
        fullPath: foto.fullPath ?? null,
        data: new Date(foto.data),
        observacao: foto.observacao,
        progresso: foto.progresso,
      })),
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em),
    };
  }
}
