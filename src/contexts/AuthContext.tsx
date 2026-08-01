import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/infrastructure/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuta mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    // Estratégia manual em vez de `supabase.auth.signOut()`:
    //
    // O `_signOut` do supabase-js v2.89.0 (node_modules/.../GoTrueClient.ts
    // linhas 2148-2174) SEMPRE chama `admin.signOut(accessToken, scope)`
    // no servidor se tem accessToken — o `scope` só define o que o
    // servidor invalida, não se a chamada é feita. Quando o refresh
    // token está expirado, o servidor devolve 403 que o supabase-js
    // IGNORA internamente (linhas 2157-2164) mas a chamada de rede
    // aparece no DevTools.
    //
    // Pra SUMIR com a requisição:
    // 1. Remover manualmente as chaves de auth do localStorage
    // 2. `window.location.href = '/login'` força reload — recria o
    //    supabase client do zero (sem sessão em memória) e suprime
    //    também o `autoRefreshToken` que tentaria refresh com token
    //    expirado no background.
    if (typeof window !== "undefined" && window.localStorage) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.includes("auth-token")) {
          localStorage.removeItem(key);
        }
      }
    }
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

