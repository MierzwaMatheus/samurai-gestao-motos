import { describe, it, expect, vi, beforeEach } from "vitest";

import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";

// Mock do cliente Supabase: para `buscarPagina` precisamos encadear várias
// chamadas `.from(...)` (entradas, count, clientes, motos, fotos,
// entradas_tipos_servico, tipos_servico) e mais o `storage.from(...)` para
// signed URLs das fotos.
vi.mock("@/infrastructure/supabase/client", () => {
  const dbFrom = vi.fn();
  const storageFrom = vi.fn();
  return {
    supabase: {
      auth: { getUser: vi.fn() },
      from: dbFrom,
      storage: { from: storageFrom },
    },
  };
});

import { supabase } from "@/infrastructure/supabase/client";

const mockedDbFrom = vi.mocked(supabase.from);
const mockedStorageFrom = vi.mocked(supabase.storage.from);

/**
 * Monta o duplo de teste do bucket de storage, expondo o spy de
 * `createSignedUrl` para observarmos os argumentos recebidos.
 */
const buildBucket = () => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://signed.example/moto.jpg" },
    error: null,
  });
  mockedStorageFrom.mockReturnValue({ createSignedUrl } as never);
  return { createSignedUrl };
};

/**
 * Encadeia um query builder mockado. Cada método encadeável termina
 * devolvendo `terminal`, simulando o contrato fluent da Supabase JS.
 */
const buildQueryChain = <T>(terminal: T) => {
  const chain: any = {};
  chain.then = (resolve: (v: T) => unknown) =>
    Promise.resolve(terminal).then(resolve);
  chain.catch = () => chain;

  for (const method of [
    "select",
    "update",
    "eq",
    "in",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "or",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  return chain;
};

/**
 * Configura o dispatcher de `supabase.from(...)` retornando o chain certo
 * por nome de tabela. `entradas` alterna entre o chain da página principal
 * (1ª chamada) e o chain da contagem exata (2ª chamada).
 */
const setupPagedEntradas = ({
  fotosStatus,
  fotos = [],
}: {
  fotosStatus?: unknown;
  fotos?: any[];
} = {}) => {
  const clienteId = "11111111-1111-4111-8111-111111111111";
  const motoId = "22222222-2222-4222-8222-222222222222";

  const entradasChain = buildQueryChain({
    data: [
      {
        id: "entrada-1",
        cliente_id: clienteId,
        moto_id: motoId,
        descricao: "Revisão geral",
        status: "pendente",
        status_entrega: "pendente",
        tipo: "entrada",
        progresso: 0,
        criado_em: "2025-01-01T00:00:00Z",
        atualizado_em: "2025-01-01T00:00:00Z",
        frete: null,
        fotos_status: fotosStatus,
      },
    ],
    error: null,
  });

  const countChain = buildQueryChain({
    data: null,
    error: null,
    count: 42,
  });

  const clientesChain = buildQueryChain({
    data: [{ id: clienteId, nome: "Cliente", telefone: "123" }],
    error: null,
  });
  const motosChain = buildQueryChain({
    data: [{ id: motoId, modelo: "CG", placa: "ABC1D23" }],
    error: null,
  });
  const fotosChain = buildQueryChain({ data: fotos, error: null });
  const vinculosChain = buildQueryChain({ data: [], error: null });
  const tiposChain = buildQueryChain({ data: [], error: null });

  let entradasCall = 0;
  mockedDbFrom.mockImplementation(((table: string) => {
    if (table === "entradas") {
      entradasCall += 1;
      return entradasCall === 1 ? entradasChain : countChain;
    }
    if (table === "clientes") return clientesChain;
    if (table === "motos") return motosChain;
    if (table === "fotos") return fotosChain;
    if (table === "entradas_tipos_servico") return vinculosChain;
    if (table === "tipos_servico") return tiposChain;
    return buildQueryChain({ data: [], error: null });
  }) as never);

  return {
    entradasChain,
    countChain,
    clientesChain,
    motosChain,
    fotosChain,
    vinculosChain,
    tiposChain,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SupabaseEntradaRepository — paginação", () => {
  it("aplica .range() + .order() + limit() na query de página e contagem exata head=true", async () => {
    buildBucket();
    const { entradasChain, countChain } = setupPagedEntradas();

    const pagina = await new SupabaseEntradaRepository().buscarPagina({
      page: 2,
      pageSize: 10,
    });

    // Faixa da página 2 com pageSize 10: from=10, to=19
    expect(entradasChain.range).toHaveBeenCalledWith(10, 19);
    expect(entradasChain.order).toHaveBeenCalledWith("criado_em", {
      ascending: false,
    });
    // .order() deve vir antes de .limit() para garantir a ordenação correta
    expect(entradasChain.order.mock.invocationCallOrder[0]).toBeLessThan(
      entradasChain.limit.mock.invocationCallOrder[0]
    );
    expect(entradasChain.limit).toHaveBeenCalledWith(10);

    // Query de contagem exata, sem corpo, apenas o count
    expect(countChain.select).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });

    expect(pagina).toMatchObject({
      total: 42,
      page: 2,
      pageSize: 10,
    });
  });

  it("aplica .eq('tipo', ...) quando o filtro tipo é informado", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      tipo: "entrada",
    });

    expect(entradasChain.eq).toHaveBeenCalledWith("tipo", "entrada");
  });

  it("aplica .in('status_entrega', [...]) quando statusEntrega é informado", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      statusEntrega: ["pendente", "entregue"],
    });

    expect(entradasChain.in).toHaveBeenCalledWith("status_entrega", [
      "pendente",
      "entregue",
    ]);
  });

  it("aplica .in('status', [...]) quando status é informado", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      status: ["concluido"],
    });

    expect(entradasChain.in).toHaveBeenCalledWith("status", ["concluido"]);
  });

  it("gera .or(...) quando busca é informada", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
      busca: "CG",
    });

    expect(entradasChain.or).toHaveBeenCalledTimes(1);
    // O argumento deve conter o termo de busca (não-string vazia)
    const arg = entradasChain.or.mock.calls[0][0] as string;
    expect(arg).toContain("CG");
  });

  it("não aplica .eq('tipo', ...) quando tipo é omitido", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(entradasChain.eq).not.toHaveBeenCalledWith(
      "tipo",
      expect.anything()
    );
  });

  it("não aplica .in('status_entrega', ...) quando statusEntrega é omitido", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(entradasChain.in).not.toHaveBeenCalledWith(
      "status_entrega",
      expect.any(Array)
    );
  });

  it("não aplica .or(...) quando busca é omitida", async () => {
    buildBucket();
    const { entradasChain } = setupPagedEntradas();

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(entradasChain.or).not.toHaveBeenCalled();
  });

  it("propaga thumb/full nas fotos de status e mantém null nas fotos legadas", async () => {
    buildBucket();
    const { fotosChain } = setupPagedEntradas({
      fotosStatus: [
        {
          url: "nova.jpg",
          thumbPath: "thumbs/nova.webp",
          fullPath: "full/nova.webp",
          data: "2025-01-02T00:00:00Z",
          observacao: "Nova",
          progresso: 50,
        },
        {
          url: "legada.jpg",
          data: "2025-01-03T00:00:00Z",
          observacao: "Legada",
          progresso: 60,
        },
      ],
    });

    const pagina = await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(fotosChain.select).toHaveBeenCalledWith(
      "id, entrada_id, url, thumb_path, full_path, tipo, criado_em"
    );
    expect(pagina.items[0].fotosStatus).toMatchObject([
      { thumbPath: "thumbs/nova.webp", fullPath: "full/nova.webp" },
      { thumbPath: null, fullPath: null },
    ]);
  });

  it("retorna moto.fotos como Foto[] com thumbPath/fullPath assinados quando há foto nova", async () => {
    // Após o ciclo 3, `MotoCompleta.fotos` migra de `string[]` para
    // `Foto[]` e o repositório devolve cada foto da tabela `fotos`
    // (tipo 'moto') já com `url`/`thumbPath`/`fullPath` assinados.
    // Cobre o ramo "foto nova com pipeline de 2 variantes".
    buildBucket();
    setupPagedEntradas({
      fotos: [
        {
          id: "foto-nova",
          entrada_id: "entrada-1",
          url: "user/entrada-1/moto/1234-foto.webp",
          thumb_path: "user/entrada-1/moto/1234-foto-thumb.webp",
          full_path: "user/entrada-1/moto/1234-foto-full.webp",
          tipo: "moto",
          criado_em: "2025-01-02T00:00:00Z",
        },
      ],
    });

    const pagina = await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    // Foto com shape completo (Foto) — não string crua
    expect(pagina.items[0].fotos).toHaveLength(1);
    expect(pagina.items[0].fotos[0]).toEqual(
      expect.objectContaining({
        id: "foto-nova",
        entradaId: "entrada-1",
        tipo: "moto",
        // 3 caminhos foram assinados em paralelo (url + thumb + full)
        url: "https://signed.example/moto.jpg",
        thumbPath: "https://signed.example/moto.jpg",
        fullPath: "https://signed.example/moto.jpg",
        criadoEm: new Date("2025-01-02T00:00:00Z"),
      })
    );
  });

  it("retorna moto.fotos como Foto[] com thumbPath/fullPath null para fotos legadas", async () => {
    // Cobre o ramo "foto legada sem pipeline de 2 variantes" — os
    // campos `thumb_path`/`full_path` não existem no banco. Devolvemos
    // um `Foto` com esses campos `null`; o consumer (GaleriaFotosMoto)
    // faz fallback para `url` via `thumbPath ?? url`.
    buildBucket();
    setupPagedEntradas({
      fotos: [
        {
          id: "foto-legada",
          entrada_id: "entrada-1",
          url: "user/entrada-1/moto/legada.jpg",
          // sem thumb_path, sem full_path
          tipo: "moto",
          criado_em: "2025-01-03T00:00:00Z",
        },
      ],
    });

    const pagina = await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    expect(pagina.items[0].fotos).toHaveLength(1);
    expect(pagina.items[0].fotos[0]).toEqual(
      expect.objectContaining({
        id: "foto-legada",
        entradaId: "entrada-1",
        tipo: "moto",
        url: "https://signed.example/moto.jpg",
        thumbPath: null,
        fullPath: null,
      })
    );
  });

  it("tolerância a falhas: signed URL com 400 não derruba a página inteira", async () => {
    // Bug observado em prod em 2026-08-05: uma foto cujo `obterUrlAssinada`
    // falha (ex.: 400 Bad Request por causa de caractere incomum no path)
    // faz o `Promise.all` em `buscarPagina` rejeitar, e o `useMotosOficina`
    // nunca chama `setMotos` — `oficinaConcluidos.motos` permanece `[]`,
    // mostrando "Nenhum serviço concluído" mesmo com 241 entradas reais.
    //
    // Esperado: a página continua renderizando as outras fotos. A foto
    // problemática cai num fallback (path cru) em vez de quebrar tudo.
    const createSignedUrl = vi.fn().mockImplementation((path: string) => {
      if (path.includes("quebrada")) {
        return Promise.resolve({
          data: null,
          error: { message: "400 Bad Request", statusCode: "400" },
        });
      }
      return Promise.resolve({
        data: { signedUrl: `https://signed.example/${path}` },
        error: null,
      });
    });
    mockedStorageFrom.mockReturnValue({ createSignedUrl } as never);

    setupPagedEntradas({
      fotos: [
        {
          id: "foto-boa",
          entrada_id: "entrada-1",
          url: "user/entrada-1/moto/boa.jpg",
          tipo: "moto",
          criado_em: "2025-01-02T00:00:00Z",
        },
        {
          id: "foto-quebrada",
          entrada_id: "entrada-1",
          url: "user/entrada-1/moto/quebrada.jpg",
          tipo: "moto",
          criado_em: "2025-01-02T00:00:00Z",
        },
      ],
    });

    const pagina = await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    // A página vem — Promise.all não rejeitou por causa da foto quebrada
    expect(pagina.items).toHaveLength(1);
    expect(pagina.items[0].fotos).toHaveLength(2);

    // A foto "boa" recebeu a URL assinada normalmente
    expect(pagina.items[0].fotos[0].url).toBe(
      "https://signed.example/user/entrada-1/moto/boa.jpg"
    );

    // A foto "quebrada" caiu pro fallback (path cru) — não bloqueou as outras
    expect(pagina.items[0].fotos[1].id).toBe("foto-quebrada");
    expect(pagina.items[0].fotos[1].url).toBe(
      "user/entrada-1/moto/quebrada.jpg"
    );
  });

  it("lê e regrava thumb/full no JSONB de fotos de status", async () => {
    const returnedRow = {
      id: "entrada-1",
      tipo: "entrada",
      cliente_id: "cliente-1",
      moto_id: "moto-1",
      status: "pendente",
      progresso: 0,
      fotos_status: [
        {
          url: "nova.jpg",
          thumbPath: "thumbs/nova.webp",
          fullPath: "full/nova.webp",
          data: "2025-01-02T00:00:00Z",
          progresso: 50,
        },
        {
          url: "legada.jpg",
          data: "2025-01-03T00:00:00Z",
          progresso: 60,
        },
      ],
      criado_em: "2025-01-01T00:00:00Z",
      atualizado_em: "2025-01-01T00:00:00Z",
    };
    const chain = buildQueryChain({ data: returnedRow, error: null });
    mockedDbFrom.mockReturnValue(chain);

    const entrada = await new SupabaseEntradaRepository().atualizar("entrada-1", {
      fotosStatus: returnedRow.fotos_status.map(foto => ({
        ...foto,
        data: new Date(foto.data),
        observacao: undefined,
      })),
    } as never);

    const payload = chain.update.mock.calls[0][0];
    expect(JSON.parse(payload.fotos_status)).toMatchObject([
      { thumbPath: "thumbs/nova.webp", fullPath: "full/nova.webp" },
      { thumbPath: null, fullPath: null },
    ]);
    expect(entrada.fotosStatus).toMatchObject([
      { thumbPath: "thumbs/nova.webp", fullPath: "full/nova.webp" },
      { thumbPath: null, fullPath: null },
    ]);
  });

  it("lança erro com mensagem clara quando a query principal falha", async () => {
    buildBucket();
    const errorChain = buildQueryChain({ data: null, error: { message: "boom" } });
    mockedDbFrom.mockReturnValue(errorChain);

    await expect(
      new SupabaseEntradaRepository().buscarPagina({ page: 1, pageSize: 10 })
    ).rejects.toThrow(/Erro ao buscar entradas.*boom/);
  });

  // ==========================================================================
  // Mata mutantes de boundary em `startsWith("http")` vs `endsWith("http")`:
  // se a URL/thumbPath/fullPath já é uma URL completa (`http...`), o
  // repositório NÃO deve chamar `obterUrlAssinada` novamente.
  // ==========================================================================
  it("NÃO re-assina url/thumbPath/fullPath quando já são URLs completas (startsWith 'http')", async () => {
    const { createSignedUrl } = buildBucket();
    setupPagedEntradas({
      fotos: [
        {
          id: "foto-assinada",
          entrada_id: "entrada-1",
          // já é URL completa — qualquer chamada extra a
          // `obterUrlAssinada` é desperdício e pode quebrar a URL.
          url: "https://signed.example/full.webp",
          thumb_path: "https://signed.example/thumb.webp",
          full_path: "https://signed.example/full.webp",
          tipo: "moto",
          criado_em: "2025-01-02T00:00:00Z",
        },
      ],
    });

    await new SupabaseEntradaRepository().buscarPagina({
      page: 1,
      pageSize: 10,
    });

    // Como url/thumbPath/fullPath já começam com "http", o repositório
    // deve usar os valores como estão — zero chamadas a
    // `obterUrlAssinada`. Se um mutante trocar `startsWith("http")`
    // por `endsWith("http")`, esses URLs não serão mais reconhecidas
    // e createSignedUrl será chamado 3 vezes (ou mais).
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
