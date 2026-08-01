import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const signOutSpy = vi.fn();
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
      signOut: (...args: unknown[]) => signOutSpy(...args),
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
  signOutSpy.mockReset();
  signOutSpy.mockResolvedValue({ error: null });
});

describe("AuthContext — signOut", () => {
  it("chama supabase.auth.signOut com scope: 'local' (evita 403 do global)", async () => {
    // Garante que o logout não dispara o endpoint /auth/v1/logout do
    // servidor (que devolve 403 quando o refresh token está expirado).
    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>
    );

    const btn = await screen.findByTestId("signout-btn");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });
    expect(signOutSpy).toHaveBeenCalledWith({ scope: "local" });
  });

  it("NÃO usa scope: 'global' (regressão — era o default que causava 403)", async () => {
    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>
    );

    const btn = await screen.findByTestId("signout-btn");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalledTimes(1);
    });
    const args = signOutSpy.mock.calls[0]?.[0] as { scope?: string } | undefined;
    expect(args?.scope).not.toBe("global");
  });
});
