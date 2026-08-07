import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";

// ============================================================================
// Mocks de dependências da página
// ----------------------------------------------------------------------------
// A página `Oficina.tsx` instancia repositórios concretos do Supabase via
// `useMemo(() => new SupabaseXRepository(), [])` e usa hooks de domínio
// (`useMotosOficina`, `useAdicionarFotoStatus`, `useAtualizarProgressoStatus`,
// `useDeletarEntrada`, `useGerarOS`, `usePagamento`). Para isolar o teste ao
// comportamento de paginação/scroll/contador que o ciclo 9 introduz,
// mockamos:
//   1. o hook `useMotosOficina` (controla o estado paginado de cada aba);
//   2. as classes de repositório (precisam existir como construtores);
//   3. os demais hooks de domínio;
//   4. componentes pesados sem lógica de paginação (Header, BottomNav,
//      HistoryModal, GaleriaFotos, GaleriaFotosMoto) — stubs simples;
//   5. dependências externas (supabase client, wouter, sonner, auth).
// ============================================================================

// O hook é o coração do ciclo 9. A página agora chama `useMotosOficina` DUAS
// vezes (uma instância por aba) — cada `mockReturnValueOnce` configura o
// estado de uma instância distinta (em-andamento e concluidos).
const useMotosOficinaMock = vi.fn();

// Demais hooks de domínio — stubs triviais.
const useAdicionarFotoStatusMock = vi.fn(() => ({
  adicionar: vi.fn(),
  loading: false,
  error: null,
}));
const useAtualizarProgressoStatusMock = vi.fn(() => ({
  atualizar: vi.fn(),
  loading: false,
  error: null,
}));
const useDeletarEntradaMock = vi.fn(() => ({
  deletar: vi.fn(),
  loading: false,
  error: null,
}));
const useGerarOSMock = vi.fn(() => ({
  gerar: vi.fn().mockResolvedValue(undefined),
  loading: false,
  error: null,
}));
const usePagamentoMock = vi.fn(() => ({
  atualizarStatusPagamento: vi.fn(),
  atualizarFormaPagamento: vi.fn(),
}));

vi.mock("@/hooks/useMotosOficina", () => ({
  useMotosOficina: (...args: unknown[]) => useMotosOficinaMock(...args),
}));
vi.mock("@/hooks/useAdicionarFotoStatus", () => ({
  useAdicionarFotoStatus: (...args: unknown[]) => useAdicionarFotoStatusMock(...args),
}));
vi.mock("@/hooks/useAtualizarProgressoStatus", () => ({
  useAtualizarProgressoStatus: (...args: unknown[]) =>
    useAtualizarProgressoStatusMock(...args),
}));
vi.mock("@/hooks/useDeletarEntrada", () => ({
  useDeletarEntrada: (...args: unknown[]) => useDeletarEntradaMock(...args),
}));
vi.mock("@/hooks/useGerarOS", () => ({
  useGerarOS: (...args: unknown[]) => useGerarOSMock(...args),
}));
vi.mock("@/hooks/usePagamento", () => ({
  usePagamento: (...args: unknown[]) => usePagamentoMock(...args),
}));

// Hook real de scroll infinito — testamos a integração com o sentinel
// usando o mock global de `IntersectionObserver` (instalado em
// `beforeEach`). NÃO mockamos `useInfiniteScroll` em si: queremos que o
// hook real crie o observer e dispare `carregarMais` quando o sentinel
// entra em viewport.

// Repositórios: precisamos apenas que `new SupabaseXRepository()` retorne
// um stub com a forma da interface (o estado vem do `useMotosOficina`
// mockado). Como a página continua usando `entradaRepo` em outros
// pontos, retornamos um stub razoável.
const repoStub = (extra: Record<string, unknown> = {}) => ({
  buscarPorId: vi.fn(),
  buscarPagina: vi.fn(),
  ...extra,
});

vi.mock("@/infrastructure/repositories/SupabaseEntradaRepository", () => ({
  SupabaseEntradaRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseClienteRepository", () => ({
  SupabaseClienteRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseMotoRepository", () => ({
  SupabaseMotoRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseTipoServicoRepository", () => ({
  SupabaseTipoServicoRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseFotoRepository", () => ({
  SupabaseFotoRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseServicoPersonalizadoRepository", () => ({
  SupabaseServicoPersonalizadoRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/storage/SupabaseStorageApi", () => ({
  SupabaseStorageApi: vi.fn().mockImplementation(() => repoStub()),
}));

// Componentes auxiliares — stubs sem dependências externas.
vi.mock("@/components/Header", () => ({
  default: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav" />,
}));
vi.mock("@/components/HistoryModal", () => ({
  HistoryModal: () => null,
}));
vi.mock("@/components/GaleriaFotos", () => ({
  default: () => null,
}));

// ============================================================================
// GaleriaFotosMoto — captura de props
// ----------------------------------------------------------------------------
// `GaleriaFotosMoto` é o consumidor final de `moto.fotos`. Para validar
// que a página propaga `Foto[]` (com thumbPath/fullPath) ao invés de
// embrulhar `string` num `Foto` com thumbPath: null, mockamos o
// componente com um spy que retém as props recebidas. Usamos
// `vi.hoisted` para que o spy seja acessível dentro do `vi.mock`
// (hoisted) e nos testes (escopo normal).
// ============================================================================
const galeriaFotosMotoSpy = vi.hoisted(() => vi.fn(() => null));
vi.mock("@/components/GaleriaFotosMoto", () => ({
  default: (props: unknown) => {
    galeriaFotosMotoSpy(props);
    return null;
  },
}));

// Dependências externas (evitam requests reais e warnings de DOM).
vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => [null, vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Contexto de autenticação — usado por Header/BottomNav (que mockamos,
// mas o wouter/useAuth pode vazar).
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

// Use-cases (instanciados via `new`) — devem existir como construtor.
vi.mock("@/domain/usecases/AdicionarFotoStatusUseCase", () => ({
  AdicionarFotoStatusUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("@/domain/usecases/AtualizarProgressoStatusUseCase", () => ({
  AtualizarProgressoStatusUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("@/domain/usecases/PrepararDadosEntradaParaEdicaoUseCase", () => ({
  PrepararDadosEntradaParaEdicaoUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({}),
  })),
}));

import Oficina from "@/pages/Oficina";

// ============================================================================
// Mock de IntersectionObserver
// ----------------------------------------------------------------------------
// O `useInfiniteScroll` cria um IntersectionObserver; jsdom não o
// implementa. Capturamos cada instância para que os testes possam
// disparar `__trigger()` simulando interseção do sentinel.
// ============================================================================
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(target: Element): void {
    this.observed = this.observed.filter((t) => t !== target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  __trigger(entries: Array<Partial<IntersectionObserverEntry>>): void {
    this.callback(entries as IntersectionObserverEntry[], this);
  }
}

const installIntersectionObserverMock = () => {
  MockIntersectionObserver.instances = [];
  (
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
};

const restoreIntersectionObserver = () => {
  delete (
    globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver }
  ).IntersectionObserver;
};

// ============================================================================
// Helpers
// ============================================================================
type MotoMock = ReturnType<typeof makeMoto>;

function makeMoto(entradaId: string) {
  return {
    id: entradaId,
    entradaId,
    motoId: `moto-${entradaId}`,
    clienteId: `cliente-${entradaId}`,
    modelo: "CG 160",
    marca: "Honda",
    ano: 2023,
    cilindrada: 160,
    placa: `ABC${entradaId.slice(-2).toUpperCase()}`,
    criadoEm: new Date("2025-01-01T00:00:00Z"),
    atualizadoEm: new Date("2025-01-01T00:00:00Z"),
    cliente: `Cliente ${entradaId}`,
    telefone: "11999999999",
    status: "pendente" as const,
    statusEntrega: "pendente" as const,
    progresso: 0,
    dataConclusao: null,
    formaPagamento: null,
    statusPagamento: null,
    fotosStatus: [],
    fotos: [],
    tiposServico: [],
    servicosPersonalizados: [],
  };
}

interface UseMotosOficinaHandle {
  motos: MotoMock[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  carregarMais: ReturnType<typeof vi.fn>;
  recarregar: ReturnType<typeof vi.fn>;
  setBusca: ReturnType<typeof vi.fn>;
  atualizarMoto: ReturnType<typeof vi.fn>;
  busca: string | undefined;
}

/**
 * Configura o mock de `useMotosOficina` para retornar dois estados
 * distintos — um para cada `TabsContent`:
 *   - chamadas ímpares  → instância "Em Andamento"
 *   - chamadas pares     → instância "Concluídos"
 *
 * Usamos `mockImplementation` com um contador para que re-renders
 * (que re-invocam o hook) recebam o mesmo handle da instância lógica
 * correspondente, mantendo os spies `setBusca` / `carregarMais` /
 * `recarregar` estáveis entre re-renders.
 */
function mockUseMotosOficina(
  emAndamento: Partial<UseMotosOficinaHandle> = {},
  concluidos: Partial<UseMotosOficinaHandle> = {}
) {
  const emAndamentoHandle: UseMotosOficinaHandle = {
    motos: [],
    total: 0,
    hasMore: false,
    loading: false,
    error: null,
    carregarMais: vi.fn().mockResolvedValue(undefined),
    recarregar: vi.fn().mockResolvedValue(undefined),
    setBusca: vi.fn(),
    atualizarMoto: vi.fn(),
    busca: undefined,
    ...emAndamento,
  };
  const concluidosHandle: UseMotosOficinaHandle = {
    motos: [],
    total: 0,
    hasMore: false,
    loading: false,
    error: null,
    carregarMais: vi.fn().mockResolvedValue(undefined),
    recarregar: vi.fn().mockResolvedValue(undefined),
    setBusca: vi.fn(),
    atualizarMoto: vi.fn(),
    busca: undefined,
    ...concluidos,
  };
  const handles = [emAndamentoHandle, concluidosHandle];
  let callIndex = 0;
  useMotosOficinaMock.mockImplementation(
    () => handles[callIndex++ % handles.length]
  );
  return { emAndamento: emAndamentoHandle, concluidos: concluidosHandle };
}

beforeEach(() => {
  vi.clearAllMocks();
  installIntersectionObserverMock();
});

afterEach(() => {
  restoreIntersectionObserver();
});

// ============================================================================
// Testes — ciclo 9
// ============================================================================
describe("Oficina — ciclo 9 (scroll infinito + busca + reset sub-aba)", () => {
  it("consulta cada aba com seu statusEntrega no servidor", () => {
    mockUseMotosOficina();

    render(<Oficina />);

    expect(useMotosOficinaMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        statusEntrega: ["pendente"],
      })
    );
    expect(useMotosOficinaMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        statusEntrega: ["entregue", "retirado"],
      })
    );
  });

  it("observa o sentinel de Concluídos quando ele surge após a carga inicial", async () => {
    const motoConcluida = {
      ...makeMoto("con-1"),
      statusEntrega: "entregue" as const,
    };
    const { concluidos } = mockUseMotosOficina(
      {},
      { motos: [], total: 3, hasMore: true }
    );

    const view = render(<Oficina />);
    expect(screen.queryByTestId("oficina-concluidos-sentinel")).toBeNull();

    concluidos.motos.push(motoConcluida);
    view.rerender(<Oficina />);

    const sentinel = await screen.findByTestId("oficina-concluidos-sentinel");
    const observer = MockIntersectionObserver.instances.find(instance =>
      instance.observed.includes(sentinel)
    );

    expect(observer).toBeDefined();
    act(() => {
      observer?.__trigger([{ isIntersecting: true }]);
    });
    expect(concluidos.carregarMais).toHaveBeenCalledTimes(1);
  });

  it("(a) digitar busca dispara 1 request após 300ms (debounce via setBusca)",async () => {
    // A página DEVE invocar setBusca do hook ao digitar no input. O
    // comportamento de debounce 300ms é responsabilidade do próprio
    // hook (já coberto em `useMotosOficina.test.ts` ciclo 6). Aqui
    // verificamos o contrato: a página faz a chamada de setBusca
    // exatamente uma vez por keystroke significativo.
    const { emAndamento, concluidos } = mockUseMotosOficina();

    render(<Oficina />);

    // Aguarda o input da aba Em Andamento (default) entrar no DOM.
    const input = await screen.findByTestId("oficina-em-andamento-busca");

    // Digita um valor curto. O debounce do hook é de 300ms — a
    // verificação a nível de componente é que a página DELEGA ao
    // hook via setBusca; o hook é que faz o debounce.
    fireEvent.change(input, { target: { value: "h" } });

    // setBusca da instância "Em Andamento" foi chamado com "h"
    expect(emAndamento.setBusca).toHaveBeenCalledTimes(1);
    expect(emAndamento.setBusca).toHaveBeenCalledWith("h");

    // A instância "Concluídos" NÃO recebeu setBusca
    expect(concluidos.setBusca).not.toHaveBeenCalled();
  });

  it("(b) trocar aba zera paginação: recarregar é disparado na nova aba", async () => {
    const { emAndamento, concluidos } = mockUseMotosOficina();

    render(<Oficina />);

    // Aguarda a aba padrão (Em Andamento) renderizar.
    await screen.findByTestId("oficina-em-andamento-busca");

    // Após o mount, a página chama `recarregar()` em AMBAS as
    // instâncias (useEffect inicial). Capturamos o baseline para
    // detectar o incremento vindo da troca de aba.
    const concluidosCallsBefore = concluidos.recarregar.mock.calls.length;
    const emAndamentoCallsBefore = emAndamento.recarregar.mock.calls.length;

    // Clica na aba "Concluídos". Radix Tabs usa `onMouseDown` (não
    // `onClick`) para disparar `onValueChange`; simulamos o evento
    // mousedown com `fireEvent` para casar com o handler interno.
    const tabConcluidos = screen.getByRole("tab", { name: /concluídos/i });
    act(() => {
      fireEvent.pointerDown(tabConcluidos, { button: 0, ctrlKey: false });
      fireEvent.mouseDown(tabConcluidos, { button: 0 });
      fireEvent.click(tabConcluidos);
    });

    // Após trocar, recarregar da instância "Concluídos" foi chamado
    // MAIS UMA VEZ (reset para page=1).
    await waitFor(() => {
      expect(concluidos.recarregar.mock.calls.length).toBe(
        concluidosCallsBefore + 1
      );
    });

    // A instância "Em Andamento" NÃO foi recarregada por conta da
    // troca de aba (seu call count permanece intacto).
    expect(emAndamento.recarregar.mock.calls.length).toBe(
      emAndamentoCallsBefore
    );
  });

  it("(c) scroll dispara carregarMais em cada aba independentemente", async () => {
    // O sentinel só é renderizado quando há itens na lista. Providenciamos
    // 1 item em cada aba para que ambos os sentinels existam no DOM.
    // A página filtra a aba "Concluídos" por `statusEntrega === "entregue"`
    // (ou "retirado"), então o moto do mock precisa ter esse valor para
    // passar pelo filtro client-side.
    const emMoto = makeMoto("em-1");
    const conMoto = {
      ...makeMoto("con-1"),
      statusEntrega: "entregue" as const,
    };

    const { emAndamento, concluidos } = mockUseMotosOficina(
      {
        motos: [emMoto],
        total: 5,
        hasMore: true,
      },
      {
        motos: [conMoto],
        total: 3,
        hasMore: true,
      }
    );

    render(<Oficina />);

    // Sentinel da aba Em Andamento (aba default).
    const sentinelEmAndamento = await screen.findByTestId(
      "oficina-em-andamento-sentinel"
    );
    const observerEmAndamento = MockIntersectionObserver.instances.find(
      (obs) => obs.observed.includes(sentinelEmAndamento)
    )!;
    expect(observerEmAndamento).toBeDefined();

    // Dispara a interseção do sentinel "Em Andamento".
    act(() => {
      observerEmAndamento.__trigger([{ isIntersecting: true }]);
    });

    // carregarMais da instância "Em Andamento" foi chamado; o de
    // "Concluídos" NÃO.
    expect(emAndamento.carregarMais).toHaveBeenCalledTimes(1);
    expect(concluidos.carregarMais).not.toHaveBeenCalled();

    // Troca para a aba "Concluídos". Radix Tabs usa `onMouseDown` (não
    // `onClick`) para disparar `onValueChange`; simulamos o evento
    // mousedown com `fireEvent` para casar com o handler interno.
    const tabConcluidos = screen.getByRole("tab", { name: /concluídos/i });
    act(() => {
      fireEvent.pointerDown(tabConcluidos, { button: 0, ctrlKey: false });
      fireEvent.mouseDown(tabConcluidos, { button: 0 });
      fireEvent.click(tabConcluidos);
    });

    // Sentinel da aba "Concluídos".
    const sentinelConcluidos = await screen.findByTestId(
      "oficina-concluidos-sentinel"
    );

    // O `useInfiniteScroll` cria o IntersectionObserver num `useEffect`
    // que roda após a montagem do sentinel. Esperamos o observer ser
    // registrado antes de tentar dispará-lo.
    const observerConcluidos = await waitFor(() =>
      MockIntersectionObserver.instances.find((obs) =>
        obs.observed.includes(sentinelConcluidos)
      )
    );
    expect(observerConcluidos).toBeDefined();

    // Dispara a interseção do sentinel "Concluídos".
    act(() => {
      observerConcluidos.__trigger([{ isIntersecting: true }]);
    });

    // carregarMais da instância "Concluídos" foi chamado; o de
    // "Em Andamento" permanece com 1 chamada (a anterior, não
    // incrementada).
    expect(concluidos.carregarMais).toHaveBeenCalledTimes(1);
    expect(emAndamento.carregarMais).toHaveBeenCalledTimes(1);
  });

  it("(d) 'Mostrando X de Y' abaixo do input reflete motos.length / total", async () => {
    mockUseMotosOficina(
      {
        // 3 itens, total 25 — aba Em Andamento (default)
        motos: [makeMoto("em-1"), makeMoto("em-2"), makeMoto("em-3")],
        total: 25,
        hasMore: true,
      },
      {
        // vazio — aba Concluídos não exibe contador
        motos: [],
        total: 0,
        hasMore: false,
      }
    );

    render(<Oficina />);

    // O contador discreto aparece abaixo do input da aba Em Andamento
    // quando há itens carregados.
    expect(
      await screen.findByText(/mostrando 3 de 25/i)
    ).toBeInTheDocument();
  });
});

// ============================================================================
// Adicionar Foto de Status — toast mostra a mensagem real do hook
// ----------------------------------------------------------------------------
// Garante que o `toast.error` exibe a mensagem retornada pelo hook
// (cobre os mutantes NoCoverage da linha `toast.error(adicionarFotoError
// || "Erro ao adicionar foto")`).
// ============================================================================
describe("Oficina — toast de erro em Adicionar Foto de Status", () => {
  it("exibe a mensagem real do hook (não o genérico) quando o upload falha", async () => {
    const adicionarMock = vi.fn().mockResolvedValue(null);
    useAdicionarFotoStatusMock.mockReturnValue({
      adicionar: adicionarMock,
      loading: false,
      error: "imageVariants: thumb webp vazio (0 bytes) ao processar foto.jpg",
    });

    mockUseMotosOficina({
      motos: [makeMoto("em-1")],
      total: 1,
      hasMore: false,
    });

    const { toast } = await import("sonner");

    render(<Oficina />);

    // Abre o modal
    const abrir = await screen.findByRole("button", { name: /adicionar foto/i });
    fireEvent.click(abrir);

    // Seleciona arquivo
    const fileInput = await screen.findByLabelText(/foto/i);
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Clica em Salvar
    const salvar = await screen.findByRole("button", { name: /^salvar$/i });
    fireEvent.click(salvar);

    await waitFor(() => {
      expect(adicionarMock).toHaveBeenCalledTimes(1);
    });

    // O toast exibe a mensagem REAL do hook, não o genérico.
    expect(toast.error).toHaveBeenCalledWith(
      "imageVariants: thumb webp vazio (0 bytes) ao processar foto.jpg"
    );
    // E NÃO com o genérico.
    expect(toast.error).not.toHaveBeenCalledWith("Erro ao adicionar foto");
  });

  it("cai no genérico quando o hook retorna erro null (defesa em profundidade)", async () => {
    const adicionarMock = vi.fn().mockResolvedValue(null);
    useAdicionarFotoStatusMock.mockReturnValue({
      adicionar: adicionarMock,
      loading: false,
      error: null, // sem erro definido (caso degenerado)
    });

    mockUseMotosOficina({
      motos: [makeMoto("em-1")],
      total: 1,
      hasMore: false,
    });

    const { toast } = await import("sonner");

    render(<Oficina />);

    const abrir = await screen.findByRole("button", { name: /adicionar foto/i });
    fireEvent.click(abrir);

    const fileInput = await screen.findByLabelText(/foto/i);
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const salvar = await screen.findByRole("button", { name: /^salvar$/i });
    fireEvent.click(salvar);

    await waitFor(() => {
      expect(adicionarMock).toHaveBeenCalledTimes(1);
    });

    // Sem error no hook, cai no genérico.
    expect(toast.error).toHaveBeenCalledWith("Erro ao adicionar foto");
  });
});

// ============================================================================
// Conclusão de serviço espelha statusEntrega → aba "Concluídos"
// ----------------------------------------------------------------------------
// A aba "Concluídos" filtra server-side por `statusEntrega IN
// ('entregue', 'retirado')`. O fluxo "Concluir" (= confirmar
// pagamento) precisa setar `statusEntrega: "entregue"` no payload do
// `atualizarProgresso` e na atualização otimista `atualizarMoto` em
// AMBAS as instâncias de `useMotosOficina` (Em Andamento e
// Concluídos) — sem isso, o card fica preso na aba "Em Andamento"
// mesmo com `status="concluido"`. Espelha o padrão já existente do
// "Reabrir" (`Oficina.tsx:302-335`), que reseta
// `statusEntrega: "pendente"`.
// ============================================================================
describe("Oficina — concluir move moto para a aba 'Concluídos' (statusEntrega)", () => {
  it("'Concluir' → confirmar pagamento envia statusEntrega:'entregue' no payload e na otimista", async () => {
    // Mock dedicado: vi.clearAllMocks() zera call history mas mantém
    // mockReturnValue de testes anteriores — resetamos aqui para
    // garantir isolamento.
    useAtualizarProgressoStatusMock.mockReset();
    const atualizarMock = vi.fn().mockResolvedValue(true);
    useAtualizarProgressoStatusMock.mockReturnValue({
      atualizar: atualizarMock,
      loading: false,
      error: null,
    });

    // Moto na aba "Em Andamento" com status='alinhando' (o botão
    // "Concluir" só é renderizado para esse status, ver
    // `Oficina.tsx:770-801`).
    const motoAlinhando = {
      ...makeMoto("em-1"),
      status: "alinhando" as const,
    };
    const { emAndamento, concluidos } = mockUseMotosOficina(
      { motos: [motoAlinhando], total: 1, hasMore: false },
      { motos: [], total: 0, hasMore: false }
    );

    render(<Oficina />);

    // 1. Clicar no botão "Concluir" do card.
    const botaoConcluir = await screen.findByRole("button", {
      name: /^concluir$/i,
    });
    fireEvent.click(botaoConcluir);

    // 2. Modal de pagamento abre → selecionar "Pix".
    const botaoPix = await screen.findByRole("button", { name: /^pix$/i });
    fireEvent.click(botaoPix);

    // 3. Botão "Confirmar" (habilitado após escolher forma de
    //    pagamento, `Oficina.tsx:1228`).
    const botaoConfirmar = screen.getByRole("button", {
      name: /^confirmar$/i,
    });
    fireEvent.click(botaoConfirmar);

    // 4. atualizarProgresso chamado UMA vez com o payload correto.
    await waitFor(() => {
      expect(atualizarMock).toHaveBeenCalledTimes(1);
    });
    // statusEntrega: 'entregue' faz a moto aparecer na aba
    // "Concluídos" no próximo load server-side. Hoje essa
    // asserção FALHA (código omite o campo) — é o RED do TDD.
    expect(atualizarMock).toHaveBeenCalledWith(
      "em-1",
      expect.objectContaining({
        status: "concluido",
        statusEntrega: "entregue",
        formaPagamento: "pix",
      })
    );

    // 5. Atualização otimista: ambas as instâncias recebem
    //    statusEntrega: 'entregue' para que o card SUMA da lista
    //    "Em Andamento" (filtro client-side `statusEntrega ===
    //    'pendente'`, `Oficina.tsx:514`) e APAREÇA na lista
    //    "Concluídos" (`Oficina.tsx:519`).
    expect(emAndamento.atualizarMoto).toHaveBeenCalledWith(
      "em-1",
      expect.objectContaining({ statusEntrega: "entregue" })
    );
    expect(concluidos.atualizarMoto).toHaveBeenCalledWith(
      "em-1",
      expect.objectContaining({ statusEntrega: "entregue" })
    );
  });

  it("(regressão) 'Reabrir' continua resetando statusEntrega para 'pendente'", async () => {
    useAtualizarProgressoStatusMock.mockReset();
    const atualizarMock = vi.fn().mockResolvedValue(true);
    useAtualizarProgressoStatusMock.mockReturnValue({
      atualizar: atualizarMock,
      loading: false,
      error: null,
    });

    // Moto na aba "Concluídos" com status='concluido' e
    // statusEntrega='entregue' (o botão "Reabrir" só é renderizado
    // quando moto.status === 'concluido').
    const motoConcluida = {
      ...makeMoto("con-1"),
      status: "concluido" as const,
      statusEntrega: "entregue" as const,
    };
    mockUseMotosOficina(
      { motos: [], total: 0, hasMore: false },
      { motos: [motoConcluida], total: 1, hasMore: false }
    );

    render(<Oficina />);

    // Trocar para a aba "Concluídos" (default é "Em Andamento";
    // o filtro client-side da aba Em Andamento exclui esta moto).
    // Radix Tabs usa pointer/mouseDown + click (mesmo padrão do
    // teste "(b) trocar aba zera paginação" acima).
    const tabConcluidos = screen.getByRole("tab", { name: /concluídos/i });
    act(() => {
      fireEvent.pointerDown(tabConcluidos, { button: 0, ctrlKey: false });
      fireEvent.mouseDown(tabConcluidos, { button: 0 });
      fireEvent.click(tabConcluidos);
    });

    // Botão "Reabrir" do card.
    const botaoReabrir = await screen.findByRole("button", {
      name: /^reabrir$/i,
    });
    fireEvent.click(botaoReabrir);

    await waitFor(() => {
      expect(atualizarMock).toHaveBeenCalledTimes(1);
    });
    // statusEntrega: 'pendente' é o que faz a moto voltar para a
    // aba "Em Andamento" (filtro server-side).
    expect(atualizarMock).toHaveBeenCalledWith(
      "con-1",
      expect.objectContaining({
        status: "pendente",
        statusEntrega: "pendente",
      })
    );
  });
});

// ============================================================================
// Ciclo 3 — `MotoCompleta.fotos` migra para `Foto[]` + `Oficina` consome
// ----------------------------------------------------------------------------
// A página não deve mais embrulhar `string` num `Foto` com
// `thumbPath: null`/`fullPath: null`; ela propaga os `Foto[]` que o
// `SupabaseEntradaRepository.buscarPagina` devolve (com `thumbPath`/
// `fullPath` populados ou null no caso de foto legada).
// ============================================================================
describe("Oficina — ciclo 3 (galeria de fotos da moto consome Foto[])", () => {
  beforeEach(() => {
    // Limpa o spy entre testes para que `mock.calls` reflita apenas
    // o cenário atual.
    galeriaFotosMotoSpy.mockClear();
  });

  it("passa Foto[] com thumbPath populado para GaleriaFotosMoto (foto nova)", async () => {
    // Foto NOVA — thumbPath/fullPath populados pelo repositório.
    const fotoNova = {
      id: "foto-1",
      entradaId: "entrada-em-1",
      url: "https://signed.example/full.webp",
      thumbPath: "https://signed.example/thumb.webp",
      fullPath: "https://signed.example/full.webp",
      tipo: "moto" as const,
      criadoEm: new Date("2025-01-01T00:00:00Z"),
    };
    const moto = makeMoto("em-1");
    moto.fotos = [fotoNova];

    mockUseMotosOficina({
      motos: [moto],
      total: 1,
      hasMore: false,
    });

    render(<Oficina />);

    // Abre a galeria de fotos do orçamento (o nome do botão é
    // "{N} foto(s) do orçamento" — usamos expressão regular para
    // tolerar "1 foto(s)" embora convenção pt-BR sugeriria "1 foto").
    const toggle = await screen.findByRole("button", {
      name: /foto\(s\) do orçamento/i,
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(galeriaFotosMotoSpy).toHaveBeenCalled();
    });

    const lastCall = galeriaFotosMotoSpy.mock.calls.at(-1)?.[0] as {
      fotos: Array<{ id: string; thumbPath: string | null; fullPath: string | null; tipo: string }>;
    };
    expect(lastCall).toBeDefined();
    expect(lastCall.fotos).toHaveLength(1);
    // thumbPath/fullPath CHEGARAM ao GaleriaFotosMoto (não foram
    // sobrescritos para null pelo embrulho de string→Foto do código
    // legado).
    expect(lastCall.fotos[0]).toEqual(
      expect.objectContaining({
        id: "foto-1",
        thumbPath: "https://signed.example/thumb.webp",
        fullPath: "https://signed.example/full.webp",
        tipo: "moto",
      })
    );
  });

  it("passa Foto[] com thumbPath/fullPath null para fotos legadas", async () => {
    // Foto LEGADA — sem pipeline de 2 variantes. O repositório devolve
    // `thumbPath: null` / `fullPath: null`; a GaleriaFotosMoto cai no
    // `thumbPath ?? url` para o fallback.
    const fotoLegada = {
      id: "foto-legada",
      entradaId: "entrada-em-1",
      url: "https://signed.example/legada.jpg",
      thumbPath: null,
      fullPath: null,
      tipo: "moto" as const,
      criadoEm: new Date("2025-01-01T00:00:00Z"),
    };
    const moto = makeMoto("em-1");
    moto.fotos = [fotoLegada];

    mockUseMotosOficina({
      motos: [moto],
      total: 1,
      hasMore: false,
    });

    render(<Oficina />);

    const toggle = await screen.findByRole("button", {
      name: /foto\(s\) do orçamento/i,
    });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(galeriaFotosMotoSpy).toHaveBeenCalled();
    });

    const lastCall = galeriaFotosMotoSpy.mock.calls.at(-1)?.[0] as {
      fotos: Array<{ id: string; thumbPath: string | null; fullPath: string | null; tipo: string }>;
    };
    expect(lastCall.fotos).toHaveLength(1);
    expect(lastCall.fotos[0]).toEqual(
      expect.objectContaining({
        id: "foto-legada",
        thumbPath: null,
        fullPath: null,
        tipo: "moto",
      })
    );
  });
});
