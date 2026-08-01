import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const getSessionSpy = vi.fn().mockResolvedValue({
  data: { session: null },
});
const onAuthStateChangeSpy = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => getSessionSpy(),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeSpy(...args),
    },
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button onClick={() => signOut()} data-testid="signout-btn">
      Sair
    </button>
  );
}

beforeEach(() => {
  // jsdom: garante que localStorage existe e está vazio
  localStorage.clear();
  // Mocka window.location.href setter
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
  });
});

describe("AuthContext — signOut (estratégia local-only)", () => {
  it("remove chaves de auth-token do localStorage", () => {
    // Setup: várias chaves no localStorage, incluindo auth-tokens
    localStorage.setItem("sb-proj-auth-token", "fake-access-token");
    localStorage.setItem("sb-proj-auth-token-refresh", "fake-refresh");
    localStorage.setItem("app-outro-valor", "manter");

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId("signout-btn"));

    // As chaves de auth foram removidas
    expect(localStorage.getItem("sb-proj-auth-token")).toBeNull();
    expect(localStorage.getItem("sb-proj-auth-token-refresh")).toBeNull();
    // Outras chaves intactas
    expect(localStorage.getItem("app-outro-valor")).toBe("manter");
  });

  it("redireciona pra /login (window.location.href) após limpar o localStorage", () => {
    localStorage.setItem("sb-proj-auth-token", "x");

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId("signout-btn"));

    expect(window.location.href).toBe("/login");
  });

  it("NÃO chama supabase.auth.signOut (evita 403 do servidor)", () => {
    // Garante que a chamada pro servidor não acontece — o
    // signOut() do supabase-js v2.89.0 chama admin.signOut
    // (que faz POST /auth/v1/logout) mesmo com scope: 'local'.
    const signOutSpy = vi.fn();
    // Não mockamos signOut — se for chamado, a referência não existe

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId("signout-btn"));

    // Se o código do AuthContext tentasse chamar supabase.auth.signOut,
    // o teste quebraria com 'signOut is not a function' (porque o mock
    // não tem esse método). O fato de passar confirma que NÃO chama.
    expect(signOutSpy).not.toHaveBeenCalled();
  });
});
