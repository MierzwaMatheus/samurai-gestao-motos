import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";

// ============================================================================
// Mocks de dependências da página
// ----------------------------------------------------------------------------
// A página `Orcamentos.tsx` instancia repositórios concretos do Supabase via
// `useMemo(() => new SupabaseXRepository(), [])` e usa hooks de domínio
// (`useOrcamentos`, `useGerarOS`, `useDeletarOrcamento`). Para isolar o teste
// ao comportamento de paginação/scroll/contador que o ciclo 8 introduz,
// mockamos:
//   1. as classes de repositório (precisam existir como construtores);
//   2. os hooks de domínio (controlam o estado da lista paginada);
//   3. componentes pesados sem lógica de paginação (Header, BottomNav,
//      HistoryModal) — stubs simples;
//   4. dependências externas (supabase client, wouter, sonner, auth).
// ============================================================================

// Hooks de domínio — o `useOrcamentos` é o que carrega a paginação real da
// página; ele é exposto via spy para que os testes controlem `orcamentos`,
// `total`, `hasMore`, `loading`, e capturem chamadas a `recarregar()` e
// `carregarMais()`.
const useOrcamentosMock = vi.fn();
const useGerarOSMock = vi.fn(() => ({ gerar: vi.fn(), loading: false, error: null }));
const useDeletarOrcamentoMock = vi.fn(() => ({ deletar: vi.fn(), loading: false, error: null }));

vi.mock("@/hooks/useOrcamentos", () => ({
  useOrcamentos: (...args: unknown[]) => useOrcamentosMock(...args),
}));
vi.mock("@/hooks/useGerarOS", () => ({
  useGerarOS: (...args: unknown[]) => useGerarOSMock(...args),
}));
vi.mock("@/hooks/useDeletarOrcamento", () => ({
  useDeletarOrcamento: (...args: unknown[]) => useDeletarOrcamentoMock(...args),
}));

// Hook real de scroll infinito — testamos a integração com o sentinel
// usando o mock global de `IntersectionObserver` (instalado em
// `beforeEach`). NÃO mockamos `useInfiniteScroll` em si: queremos que o
// hook real crie o observer e dispare `carregarMais` quando o sentinel
// entra em viewport.

// Repositórios: precisamos apenas que `new SupabaseXRepository()` retorne
// `undefined` (a página nunca chama métodos neles — o estado vem do
// `useOrcamentos` mockado). Mas o `useDeletarOrcamento` constrói o
// `DeletarOrcamentoUseCase` com o repo, então retornamos um objeto mínimo.
const repoStub = (extra: Record<string, unknown> = {}) => ({
  buscarPorId: vi.fn(),
  buscarPagina: vi.fn(),
  ...extra,
});

vi.mock("@/infrastructure/repositories/SupabaseOrcamentoRepository", () => ({
  SupabaseOrcamentoRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseEntradaRepository", () => ({
  SupabaseEntradaRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseClienteRepository", () => ({
  SupabaseClienteRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseMotoRepository", () => ({
  SupabaseMotoRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseFotoRepository", () => ({
  SupabaseFotoRepository: vi.fn().mockImplementation(() => repoStub()),
}));
vi.mock("@/infrastructure/repositories/SupabaseTipoServicoRepository", () => ({
  SupabaseTipoServicoRepository: vi.fn().mockImplementation(() => repoStub()),
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
vi.mock("@/domain/usecases/ConverterOrcamentoEntradaUseCase", () => ({
  ConverterOrcamentoEntradaUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("@/domain/usecases/PrepararDadosOrcamentoParaOSUseCase", () => ({
  PrepararDadosOrcamentoParaOSUseCase: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({}),
  })),
}));

import Orcamentos from "@/pages/Orcamentos";

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
type OrcamentoMock = ReturnType<typeof makeOrcamento>;
function makeOrcamento(id: string, fotoMoto?: { url: string; thumbPath?: string | null; fullPath?: string | null }) {
  return {
    id,
    entradaId: `entrada-${id}`,
    valor: 100,
    dataExpiracao: new Date("2099-01-01T00:00:00Z"),
    status: "ativo" as const,
    criadoEm: new Date("2025-01-01T00:00:00Z"),
    atualizadoEm: new Date("2025-01-01T00:00:00Z"),
    cliente: `Cliente ${id}`,
    moto: `Moto ${id}`,
    frete: null,
    tiposServico: [],
    servicosPersonalizados: [],
    fotoMoto,
  };
}

interface UseOrcamentosHandle {
  orcamentos: OrcamentoMock[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  carregarMais: ReturnType<typeof vi.fn>;
  recarregar: ReturnType<typeof vi.fn>;
  atualizarOrcamento: ReturnType<typeof vi.fn>;
  removerOrcamento: ReturnType<typeof vi.fn>;
}

/**
 * Configura o mock de `useOrcamentos` para retornar o estado informado.
 * Os spies `recarregar` / `carregarMais` ficam acessíveis via
 * `useOrcamentosMock.mock.calls` para asserções de chamadas.
 */
function mockUseOrcamentos(state: Partial<UseOrcamentosHandle> = {}) {
  const handle: UseOrcamentosHandle = {
    orcamentos: [],
    total: 0,
    hasMore: false,
    loading: false,
    error: null,
    carregarMais: vi.fn().mockResolvedValue(undefined),
    recarregar: vi.fn().mockResolvedValue(undefined),
    atualizarOrcamento: vi.fn(),
    removerOrcamento: vi.fn(),
    ...state,
  };
  useOrcamentosMock.mockReturnValue(handle);
  return handle;
}

beforeEach(() => {
  vi.clearAllMocks();
  installIntersectionObserverMock();
});

afterEach(() => {
  restoreIntersectionObserver();
});

// ============================================================================
// Testes — ciclo 8
// ============================================================================
describe("Orcamentos — ciclo 8 (scroll infinito + contador + reset)", () => {
  it("(a) primeira carga: renderiza lista e prepara paginação com pageSize=10", async () => {
    const handle = mockUseOrcamentos({
      orcamentos: [makeOrcamento("orc-1"), makeOrcamento("orc-2")],
      total: 25,
      hasMore: true,
    });

    render(<Orcamentos />);

    // A página chama `useOrcamentos` com `(orcamentoRepo, status, _, _, opts)`;
    // o último argumento deve trazer `{ pageSize: 10 }` (paginação padrão).
    expect(useOrcamentosMock).toHaveBeenCalledTimes(1);
    const args = useOrcamentosMock.mock.calls[0];
    expect(args[0]).toBeDefined(); // orcamentoRepo instanciado
    expect(args[1]).toBe("ativo"); // status inicial = "ativos" → "ativo"
    expect(args[4]).toEqual({ pageSize: 10 });

    // A lista renderiza os dois orçamentos retornados.
    expect(screen.getByText(/Moto orc-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Moto orc-2/i)).toBeInTheDocument();

    // A página deve ter disparado `recarregar()` na montagem (via useEffect).
    await waitFor(() => {
      expect(handle.recarregar).toHaveBeenCalledTimes(1);
    });
  });

  it("(b) trocar filtro zera paginação: muda status e recarrega do zero", async () => {
    const handle = mockUseOrcamentos({
      orcamentos: [makeOrcamento("orc-1")],
      total: 5,
      hasMore: false,
    });

    render(<Orcamentos />);

    // Recarregar disparado na montagem.
    await waitFor(() => {
      expect(handle.recarregar).toHaveBeenCalledTimes(1);
    });

    // Captura os argumentos até agora: status deve ser "ativo".
    const callsBeforeSwitch = useOrcamentosMock.mock.calls.length;
    expect(useOrcamentosMock.mock.calls[callsBeforeSwitch - 1][1]).toBe("ativo");

    // Clica no filtro "Expirados".
    const botaoExpirados = screen.getByRole("button", { name: /expirados/i });
    act(() => {
      fireEvent.click(botaoExpirados);
    });

    // Após trocar o filtro:
    //  - o hook deve ter sido re-chamado com status "expirado";
    //  - `recarregar()` deve ter sido disparado novamente (page=1 reset).
    await waitFor(() => {
      const totalCalls = useOrcamentosMock.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(callsBeforeSwitch);
      expect(useOrcamentosMock.mock.calls[totalCalls - 1][1]).toBe("expirado");
    });

    await waitFor(() => {
      expect(handle.recarregar).toHaveBeenCalledTimes(2);
    });
  });

  it("(c) scroll até o sentinel dispara carregarMais", async () => {
    const carregarMais = vi.fn().mockResolvedValue(undefined);
    mockUseOrcamentos({
      orcamentos: [makeOrcamento("orc-1"), makeOrcamento("orc-2")],
      total: 25,
      hasMore: true,
      carregarMais,
    });

    render(<Orcamentos />);

    // Após a montagem, deve haver pelo menos 1 observer criado pelo
    // `useInfiniteScroll` (sentinel da lista).
    await waitFor(() => {
      expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0);
    });

    const observer = MockIntersectionObserver.instances.at(-1)!;

    // Antes do trigger, carregarMais não foi chamado.
    expect(carregarMais).not.toHaveBeenCalled();

    // Dispara a interseção do sentinel.
    act(() => {
      observer.__trigger([{ isIntersecting: true }]);
    });

    expect(carregarMais).toHaveBeenCalledTimes(1);
  });

  it("(d) 'Mostrando X de Y' reflete orcamentos.length / total", async () => {
    mockUseOrcamentos({
      orcamentos: [
        makeOrcamento("orc-1"),
        makeOrcamento("orc-2"),
        makeOrcamento("orc-3"),
      ],
      total: 25,
      hasMore: true,
    });

    render(<Orcamentos />);

    // O contador discreto aparece abaixo da lista quando há itens.
    expect(screen.getByText(/mostrando 3 de 25/i)).toBeInTheDocument();
  });

  it("(e) exibe 'Fim da lista' quando hasMore=false", async () => {
    mockUseOrcamentos({
      orcamentos: [makeOrcamento("orc-1")],
      total: 1,
      hasMore: false,
    });

    render(<Orcamentos />);

    expect(screen.getByText(/fim da lista/i)).toBeInTheDocument();
  });

  it("(f) oculta o sentinel e o contador quando não há orçamentos", async () => {
    mockUseOrcamentos({ orcamentos: [], total: 0, hasMore: false });

    render(<Orcamentos />);

    expect(screen.queryByTestId("orcamentos-sentinel")).toBeNull();
    expect(screen.queryByText(/mostrando 0 de 0/i)).toBeNull();
    expect(screen.getByText(/nenhum orçamento ativo/i)).toBeInTheDocument();
  });

  it("usa a thumb da foto da moto e cai na url para fotos legadas", () => {
    mockUseOrcamentos({
      orcamentos: [
        makeOrcamento("nova", { url: "full.jpg", thumbPath: "thumb.webp" }),
        makeOrcamento("legada", { url: "legacy.jpg", thumbPath: null }),
      ],
      total: 2,
    });
    render(<Orcamentos />);
    const imagens = screen.getAllByRole("img");
    expect(imagens[0]).toHaveAttribute("src", "thumb.webp");
    expect(imagens[1]).toHaveAttribute("src", "legacy.jpg");
  });
});
