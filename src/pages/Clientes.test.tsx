import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ============================================================================
// Mocks de dependências da página
// ----------------------------------------------------------------------------
// `Clientes.tsx` instancia o repositório concreto via `useMemo(() => new
// SupabaseClienteRepository(), [])` e consome o hook `useClientes`. Para
// isolar o comportamento do campo CPF/CNPJ, mockamos o repositório (cujo
// `atualizar` é o alvo das asserções), o hook de listagem e as
// dependências externas (wouter, sonner, supabase, auth).
// ============================================================================

const atualizarMock = vi.fn();
const useClientesMock = vi.fn();

vi.mock("@/infrastructure/repositories/SupabaseClienteRepository", () => ({
  SupabaseClienteRepository: vi.fn().mockImplementation(() => ({
    atualizar: (...args: unknown[]) => atualizarMock(...args),
    deletar: vi.fn(),
  })),
}));

vi.mock("@/hooks/useClientes", () => ({
  useClientes: (...args: unknown[]) => useClientesMock(...args),
}));

vi.mock("@/components/Header", () => ({
  default: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/components/BottomNav", () => ({
  default: () => <div data-testid="bottom-nav" />,
}));

vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(), storage: { from: vi.fn() } },
}));

vi.mock("wouter", () => ({
  useLocation: () => [null, vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastErrorMock(...args) },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

import Clientes from "@/pages/Clientes";

const clienteFake = (overrides: Record<string, unknown> = {}) => ({
  id: "cliente-1",
  nome: "João Motoqueiro",
  telefone: "11999998888",
  email: "joao@example.com",
  endereco: "Rua das Motos, 10",
  cep: "01310000",
  numeroServicos: 2,
  criadoEm: new Date("2026-01-10"),
  atualizadoEm: new Date("2026-01-10"),
  ...overrides,
});

const renderComClientes = (clientes: unknown[]) => {
  useClientesMock.mockReturnValue({
    clientes,
    loading: false,
    error: null,
    recarregar: vi.fn(),
    atualizarCliente: vi.fn(),
    removerCliente: vi.fn(),
  });
  return render(<Clientes />);
};

/** Abre o dialog de edição do primeiro cliente da lista. */
const abrirEdicao = () => {
  fireEvent.click(screen.getAllByTestId("botao-editar-cliente")[0]);
};

describe("Clientes — campo CPF/CNPJ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atualizarMock.mockResolvedValue(clienteFake());
  });

  it("exibe o CPF do cliente mascarado na listagem, revelando só os 3 primeiros dígitos", () => {
    renderComClientes([clienteFake({ cpfCnpj: "52998224725" })]);

    expect(screen.getByText("529.***.***-**")).toBeInTheDocument();
    expect(screen.queryByText("529.982.247-25")).not.toBeInTheDocument();
  });

  it("não exibe nada de documento quando o cliente não tem CPF/CNPJ", () => {
    renderComClientes([clienteFake()]);

    expect(screen.queryByText(/\*\*\*/)).not.toBeInTheDocument();
  });

  it("preenche o campo com o documento formatado ao abrir a edição", () => {
    renderComClientes([clienteFake({ cpfCnpj: "11222333000181" })]);
    abrirEdicao();

    expect(screen.getByLabelText("CPF/CNPJ")).toHaveValue("11.222.333/0001-81");
  });

  it("aplica máscara enquanto o usuário digita", () => {
    renderComClientes([clienteFake()]);
    abrirEdicao();

    const campo = screen.getByLabelText("CPF/CNPJ");
    fireEvent.change(campo, { target: { value: "52998224725" } });

    expect(campo).toHaveValue("529.982.247-25");
  });

  it("salva o documento sem pontuação quando o CPF é válido", async () => {
    renderComClientes([clienteFake()]);
    abrirEdicao();

    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), {
      target: { value: "529.982.247-25" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(atualizarMock).toHaveBeenCalledWith(
        "cliente-1",
        expect.objectContaining({ cpfCnpj: "52998224725" })
      );
    });
  });

  it("bloqueia o salvamento e avisa quando o CPF/CNPJ é inválido", async () => {
    renderComClientes([clienteFake()]);
    abrirEdicao();

    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), {
      target: { value: "529.982.247-26" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("CPF/CNPJ inválido");
    });
    expect(atualizarMock).not.toHaveBeenCalled();
  });

  it("salva normalmente quando o documento é deixado em branco (campo opcional)", async () => {
    renderComClientes([clienteFake({ cpfCnpj: "52998224725" })]);
    abrirEdicao();

    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      expect(atualizarMock).toHaveBeenCalledWith(
        "cliente-1",
        expect.objectContaining({ cpfCnpj: undefined })
      );
    });
  });
});
