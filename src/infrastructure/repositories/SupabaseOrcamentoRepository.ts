import {
  BuscarPaginaOrcamentosParams,
  OrcamentoRepository,
  Pagina,
} from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { Foto, Orcamento, OrcamentoCompleto } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { TipoFoto } from "@/domain/interfaces/StorageApi";

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
      let fotosMapFinal: Record<
        string,
        Pick<Foto, "url" | "thumbPath" | "fullPath">
      > = {};

      if (entradaIds.length > 0) {
        const { data: fotos, error: fotosError } = await supabase
          .from("fotos")
          .select("entrada_id, url, thumb_path, full_path")
          .in("entrada_id", entradaIds)
          .eq("tipo", "moto")
          .order("criado_em", { ascending: false });

        if (!fotosError && fotos) {
          // Deduplica por entrada_id (mantém a primeira = mais recente)
          // e assina os 3 paths (url, thumb_path, full_path) em
          // paralelo. Fotos legadas sem thumb_path/full_path mantêm
          // `null` nesses campos — o consumer (ciclo 4) faz fallback
          // para `url`.
          fotosMapFinal = await this.buildFotosPorEntrada(fotos);
        }
      }

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
          fotoMoto: entrada?.id
            ? fotosMapFinal[entrada.id]
            : undefined,
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
          .select("entrada_id, url, thumb_path, full_path")
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

    // Deduplica por entrada_id (mantém a primeira = mais recente) e
    // assina os 3 paths (url, thumb_path, full_path) em paralelo.
    // Fotos legadas sem thumb_path/full_path mantêm `null` nesses
    // campos — o consumer (ciclo 4) faz fallback para `url`.
    const fotosMap: Record<
      string,
      Pick<Foto, "url" | "thumbPath" | "fullPath">
    > = await this.buildFotosPorEntrada(fotosResult.data || []);

    const entradasMap = new Map(
      (entradas || []).map((entrada: any) => [entrada.id, entrada])
    );
    const clientesMap = new Map(
      (clientesResult.data || []).map((cliente: any) => [cliente.id, cliente])
    );
    const motosMap = new Map(
      (motosResult.data || []).map((moto: any) => [moto.id, moto])
    );
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

  /**
   * Deduplica fotos por `entrada_id` (mantém a primeira ocorrência,
   * que é a mais recente graças ao `order("criado_em", desc)` da
   * query) e assina os 3 paths (`url`, `thumb_path`, `full_path`) em
   * paralelo. Fotos legadas (sem `thumb_path`/`full_path`) retornam
   * `null` nesses campos — o consumer (ciclo 4) faz fallback para
   * `url`. Já é URL completa (`http`) → mantém como está.
   */
  private async buildFotosPorEntrada(
    fotos: any[]
  ): Promise<Record<string, Foto>> {
    const fotosPorEntrada: Record<string, any> = {};
    for (const foto of fotos) {
      if (!fotosPorEntrada[foto.entrada_id]) fotosPorEntrada[foto.entrada_id] = foto;
    }
    // Tolerância a falhas: Promise.allSettled garante que UMA foto com
    // 400 (ex.: path com caractere especial) não derruba a página
    // inteira do /orcamentos. A foto problemática fica com os 3 paths
    // crus (em vez de signed URLs) — UI mostra ela como quebrada,
    // mas as outras fotos renderizam normalmente.
    //
    // Issue #13 (lazy signing) não foi aplicado aqui ainda — o
    // `buscarCompletosPorStatus` é chamado pela página de Orçamentos,
    // e a foto principal (`OrcamentoCompleto.fotoMoto`) precisa de
    // URL assinada pra renderizar. Migrar pra lazy signing requer
    // mover o signing pra dentro do `Orcamentos.tsx` (no useEffect
    // do componente) — fora do escopo deste fix.
    const fotosAssinadas = await Promise.allSettled(
      Object.entries(fotosPorEntrada).map(async ([entradaId, raw]) => {
        const paths = raw as any;
        const signed = await this.assinar3Paths(paths);
        const foto: Foto = {
          id: paths.id ?? `${entradaId}-moto`,
          entradaId,
          tipo: "moto",
          criadoEm: paths.criado_em ? new Date(paths.criado_em) : new Date(0),
          url: signed.url,
          thumbPath: signed.thumbPath,
          fullPath: signed.fullPath,
        };
        return [entradaId, foto] as const;
      })
    );
    const resultado: Record<string, Foto> = {};
    for (const r of fotosAssinadas) {
      if (r.status === "fulfilled") {
        const [entradaId, foto] = r.value;
        resultado[entradaId] = foto;
      } else {
        // Fallback: usar paths crus quando a assinatura falhou
        // Identifica qual entrada pelo contexto: percorremos de novo
        // para extrair entrada_id do path original
        const reason = String(r.reason);
        console.warn(
          `[SupabaseOrcamentoRepository] Falha ao assinar URL, usando path cru: ${reason}`
        );
        // Estratégia de fallback: percorre fotosPorEntrada e adiciona
        // com paths crus. Como o índice é posicional, mapeamos pelo
        // status de cada Promise.allSettled.
        const entries = Object.entries(fotosPorEntrada);
        for (let i = 0; i < entries.length; i++) {
          if (i >= fotosAssinadas.length) break;
          if (fotosAssinadas[i] === r) {
            const [entradaId, raw] = entries[i];
            resultado[entradaId] = {
              id: raw.id ?? `${entradaId}-moto`,
              entradaId,
              tipo: "moto",
              criadoEm: raw.criado_em ? new Date(raw.criado_em) : new Date(0),
              url: raw.url,
              thumbPath: raw.thumb_path ?? null,
              fullPath: raw.full_path ?? null,
            };
          }
        }
      }
    }
    return resultado;
  }

  /**
   * Resolve os 3 paths de uma foto (url, thumb_path, full_path) para URLs utilizáveis.
   *
   * Após ciclo 3 (issue #13): usa `obterUrlParaFoto(path, tipo)` em vez
   * de `obterUrlAssinada` direto. O parâmetro `tipo` é o tipo da foto
   * (vem da coluna `fotos.tipo` filtrada na query — para a página de
   * orçamentos sempre é `"moto"`). Para `moto` retorna public URL
   * (cache indefinido) — antes, todo o eager signing estava gerando
   * chamadas desnecessárias a `/storage/v1/object/sign/...` que o
   * browser descartava em revisitas.
   *
   * URLs já completas (`http`) são mantidas como estão. Tolerante a
   * falhas — se uma chamada rejeitar, retorna o path cru pro campo
   * correspondente (a UI mostra placeholder).
   */
  private async assinar3Paths(
    paths: any,
    tipo: TipoFoto = "moto"
  ): Promise<{
    url: string;
    thumbPath: string | null;
    fullPath: string | null;
  }> {
    const resolvePath = async (raw: string | null | undefined): Promise<string | null> => {
      if (!raw) return raw ?? null;
      if (raw.startsWith("http")) return raw;
      try {
        return await this.storageApi.obterUrlParaFoto(raw, tipo);
      } catch {
        return raw;
      }
    };
    const [url, thumbPath, fullPath] = await Promise.all([
      resolvePath(paths.url),
      resolvePath(paths.thumb_path),
      resolvePath(paths.full_path),
    ]);
    return { url: url!, thumbPath, fullPath };
  }
}
