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
vi.mock("@/components/GaleriaFotosMoto", () => ({
  default: () => null,
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
