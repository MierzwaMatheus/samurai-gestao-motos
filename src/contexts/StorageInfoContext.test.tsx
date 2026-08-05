import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { StorageInfoProvider, useStorageInfoContext } from "@/contexts/StorageInfoContext";

// Mock do useAuth para o Provider não crashar
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-1" },
    session: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe("StorageInfoProvider — singleton e deduplicação", () => {
  it("executa apenas 1 chamada real mesmo com N chamadas concorrentes", async () => {
    // Issue #14b: o `useStorageInfo` era instanciado em 2 lugares
    // (Header.StorageBar + StorageManager). Cada um criava o seu
    // próprio useCase e o seu useEffect de mount. As chamadas
    // concorrentes à Edge Function `consultar-uso-storage` não
    // convergiam na cache (TTL check só funciona para chamadas
    // sequenciais). O Provider singleton usa `inFlightRef` para
    // garantir 1 request HTTP por tick.
    const consultarEspacoBucketMock = vi
      .fn()
      .mockResolvedValue({
        espacoUsadoBytes: 500_000_000,
        espacoTotalBytes: 1_073_741_824,
        espacoDisponivelBytes: 573_741_824,
        percentualUsado: 46.5,
      });
    const storageApi = { consultarEspacoBucket: consultarEspacoBucketMock };
    const { useStorageInfo, ConsultarEspacoStorageUseCase } = await import(
      "@/hooks/useStorageInfo"
    );
    // Substitui a implementação para usar o mock
    vi.mocked(useStorageInfo);

    // Componente que dispara 5 chamadas concorrentes
    function Consumer({ id }: { id: number }) {
      const { carregarInfo } = useStorageInfoContext();
      return (
        <button data-testid={`btn-${id}`} onClick={() => carregarInfo()}>
          Carregar {id}
        </button>
      );
    }

    // Renderiza o Provider com 5 consumidores dentro
    const { getByTestId } = render(
      <StorageInfoProvider storageApi={storageApi as never}>
        <Consumer id={1} />
        <Consumer id={2} />
        <Consumer id={3} />
        <Consumer id={4} />
        <Consumer id={5} />
      </StorageInfoProvider>
    );

    // Dispara 5 chamadas concorrentes
    for (let i = 1; i <= 5; i++) {
      getByTestId(`btn-${i}`).click();
    }

    await waitFor(() => {
      expect(consultarEspacoBucketMock).toHaveBeenCalledTimes(1);
    });
  });
});
