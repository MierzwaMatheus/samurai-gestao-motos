import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ============================================================================
// Mocks de dependências da página
// ----------------------------------------------------------------------------
// `Cadastro.tsx` instancia repositórios/serviços concretos via `useMemo` e
// consome vários hooks de domínio. Para testar o campo CPF/CNPJ do cadastro
// de cliente novo, mockamos tudo que toca rede e mantemos apenas o
// formulário real, espionando o payload entregue a `useCriarEntrada`.
// ============================================================================

const criarEntradaMock = vi.fn();

vi.mock("@/hooks/useCriarEntrada", () => ({
  useCriarEntrada: () => ({
    criar: (...args: unknown[]) => criarEntradaMock(...args),
    loading: false,
    error: null,
  }),
}));
vi.mock("@/hooks/useAtualizarEntrada", () => ({
  useAtualizarEntrada: () => ({ atualizar: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/hooks/useUploadFoto", () => ({
  useUploadFoto: () => ({ upload: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/hooks/useBuscarCep", () => ({
  useBuscarCep: () => ({ buscar: vi.fn(), loading: false, error: null }),
}));
vi.mock("@/hooks/useCalcularFrete", () => ({
  useCalcularFrete: () => ({ calcular: vi.fn(), loading: false, error: null }),
}));

vi.mock("@/infrastructure/api/ViaCepService", () => ({ ViaCepService: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })) }));
vi.mock("@/infrastructure/api/SupabaseFreteApi", () => ({ SupabaseFreteApi: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })) }));
vi.mock("@/domain/usecases/BuscarEnderecoPorCepUseCase", () => ({
  BuscarEnderecoPorCepUseCase: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/domain/usecases/CalcularFreteUseCase", () => ({
  CalcularFreteUseCase: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseClienteRepository", () => ({
  SupabaseClienteRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseMotoRepository", () => ({
  SupabaseMotoRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseEntradaRepository", () => ({
  SupabaseEntradaRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseOrcamentoRepository", () => ({
  SupabaseOrcamentoRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseTipoServicoRepository", () => ({
  SupabaseTipoServicoRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseServicoPersonalizadoRepository", () => ({
  SupabaseServicoPersonalizadoRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseFotoRepository", () => ({
  SupabaseFotoRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/repositories/SupabaseHistoricoRepository", () => ({
  SupabaseHistoricoRepository: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/infrastructure/storage/SupabaseStorageApi", () => ({
  SupabaseStorageApi: vi.fn().mockImplementation(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("@/components/Header", () => ({
  default: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/components/BottomNav", () => ({ default: () => <div data-testid="bottom-nav" /> }));
vi.mock("@/components/ClienteSearch", () => ({ ClienteSearch: () => <div /> }));

// O gerenciador de serviços expõe um botão que injeta um serviço no
// formulário — o cadastro exige ao menos um serviço para registrar.
vi.mock("@/components/GerenciarServicos", () => ({
  GerenciarServicos: ({
    onServicosChange,
  }: {
    onServicosChange: (s: unknown[]) => void;
  }) => (
    <button
      data-testid="adicionar-servico"
      onClick={() => onServicosChange([{ tipoServicoId: "servico-1", quantidade: 1 }])}
    >
      add servico
    </button>
  ),
}));

vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: { auth: { getUser: vi.fn() }, from: vi.fn(), storage: { from: vi.fn() } },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/cadastro", vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

import Cadastro from "@/pages/Cadastro";

/** Preenche os campos obrigatórios de um cadastro de cliente novo. */
const preencherCadastroMinimo = () => {
  fireEvent.change(screen.getByLabelText(/Nome do Cliente/), {
    target: { value: "João Motoqueiro" },
  });
  fireEvent.change(screen.getByLabelText(/Telefone/), {
    target: { value: "11999998888" },
  });
  fireEvent.change(screen.getByLabelText(/Modelo da Moto/), {
    target: { value: "CB 500" },
  });
  fireEvent.click(screen.getByTestId("adicionar-servico"));
};

describe("Cadastro — CPF/CNPJ do cliente novo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    criarEntradaMock.mockResolvedValue({ entradaId: "entrada-1" });
  });

  it("aplica máscara de CPF enquanto o usuário digita", () => {
    render(<Cadastro />);

    const campo = screen.getByLabelText("CPF/CNPJ");
    fireEvent.change(campo, { target: { value: "52998224725" } });

    expect(campo).toHaveValue("529.982.247-25");
  });

  it("envia o documento junto com os dados da entrada", async () => {
    render(<Cadastro />);
    preencherCadastroMinimo();

    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), {
      target: { value: "529.982.247-25" },
    });
    fireEvent.click(screen.getByText("Registrar na Samurai"));

    await waitFor(() => {
      expect(criarEntradaMock).toHaveBeenCalledWith(
        expect.objectContaining({ cpfCnpj: "529.982.247-25" })
      );
    });
  });

  it("bloqueia o registro quando o documento informado é inválido", async () => {
    render(<Cadastro />);
    preencherCadastroMinimo();

    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), {
      target: { value: "529.982.247-26" },
    });
    fireEvent.click(screen.getByText("Registrar na Samurai"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("CPF/CNPJ inválido");
    });
    expect(criarEntradaMock).not.toHaveBeenCalled();
  });

  it("descarta o documento digitado ao alternar para cliente existente", () => {
    render(<Cadastro />);

    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), {
      target: { value: "529.982.247-25" },
    });
    // Liga e desliga o modo "cliente existente": o documento digitado
    // para o cliente novo não pode sobrar no formulário e acabar
    // gravado no cadastro de outra pessoa.
    fireEvent.click(screen.getByLabelText("Usar cliente existente"));
    fireEvent.click(screen.getByLabelText("Usar cliente existente"));

    expect(screen.getByLabelText("CPF/CNPJ")).toHaveValue("");
  });

  it("registra normalmente sem documento, por ser campo opcional", async () => {
    render(<Cadastro />);
    preencherCadastroMinimo();

    fireEvent.click(screen.getByText("Registrar na Samurai"));

    await waitFor(() => {
      expect(criarEntradaMock).toHaveBeenCalledWith(
        expect.objectContaining({ cpfCnpj: "" })
      );
    });
  });
});
