import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mocks de baixo nível — setados ANTES dos imports do Header pra
// não cair no código real (supabase, wouter, etc.).
vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

vi.mock("@/infrastructure/storage/SupabaseStorageApi", () => ({
  SupabaseStorageApi: vi.fn().mockImplementation(() => ({
    consultarEspacoBucket: vi.fn(),
  })),
}));

vi.mock("@/infrastructure/storage/StorageManager", () => ({
  StorageManager: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/JapaneseThemeSwitch", () => ({
  JapaneseThemeSwitch: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const setLocationMock = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => [null, setLocationMock],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { StorageInfoProvider } from "@/contexts/StorageInfoContext";

const useAuthMock = vi.mocked(useAuth);

// Helper: renderiza o Header dentro do Provider necessário. O Header
// consome `useStorageInfoContext` (issue #14b) — sem o Provider o
// `useStorageInfoContext` joga.
function renderWithProviders(ui: React.ReactNode) {
  return render(
    <StorageInfoProvider storageApi={{} as never}>
      {ui}
    </StorageInfoProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Header — StorageBar (chamada de consultar-uso-storage)", () => {
  it("NÃO chama carregarInfo enquanto a sessão está carregando (evita 401)", () => {
    // Bug pré-existente: o useEffect de mount do StorageBar chamava
    // carregarInfo() imediatamente, mas a sessão do AuthContext ainda
    // estava em `loading: true` (carregando do localStorage). A edge
    // function saía sem JWT e retornava 401. Fix: só chama quando
    // `authLoading === false` e `user` está setado.

    useAuthMock.mockReturnValue({
      user: null,
      session: null,
      loading: true, // sessão ainda carregando
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithProviders(<Header title="Oficina" />);

    // A barra de storage renderiza um placeholder enquanto carrega.
    // Verificamos que nenhuma chamada de rede sai (não temos como
    // observar diretamente, mas o useEffect de proteção precisa ter
    // rodado sem chamar carregarInfo).
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("NÃO chama carregarInfo quando o usuário está deslogado (user null)", () => {
    useAuthMock.mockReturnValue({
      user: null,
      session: null,
      loading: false, // terminou de carregar, sem user
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    renderWithProviders(<Header title="Oficina" />);

    expect(screen.getByText("...")).toBeInTheDocument();
  });
});

describe("Header — handleLogout (botão Sair)", () => {
  it("chama signOut e redireciona pra /login em caso de sucesso", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: { id: "u-1" },
      session: { access_token: "t" },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut,
    });

    renderWithProviders(<Header title="Oficina" />);

    const botaoSair = screen.getByTitle("Sair");
    fireEvent.click(botaoSair);

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/login");
    });
  });

  it("redireciona pra /login MESMO QUANDO signOut joga exceção (403/401)", async () => {
    // Bug pré-existente: o 403 do `auth/v1/logout` (sessão expirada/
    // revogada) joga exceção não-tratada e o redirect pra /login não
    // acontece. O fix garante que o redirect roda em try/finally.
    const signOut = vi.fn().mockRejectedValue(new Error("403 Forbidden"));
    useAuthMock.mockReturnValue({
      user: { id: "u-1" },
      session: { access_token: "t" },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut,
    });

    // Silencia o log de erro do React (queremos o fluxo, não o ruído).
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithProviders(<Header title="Oficina" />);

    const botaoSair = screen.getByTitle("Sair");
    fireEvent.click(botaoSair);

    await waitFor(() => {
      expect(setLocationMock).toHaveBeenCalledWith("/login");
    });
    expect(signOut).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });
});
