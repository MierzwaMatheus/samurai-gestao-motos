import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import Cadastro from "@/pages/Cadastro";
import Oficina from "@/pages/Oficina";
import Orcamentos from "@/pages/Orcamentos";
import Clientes from "@/pages/Clientes";
import Configuracoes from "@/pages/Configuracoes";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Redireciona para login se não autenticado e não estiver na página de login
  if (!user && location !== "/login") {
    return <Login />;
  }

  // Redireciona para home se autenticado e estiver na página de login
  if (user && location === "/login") {
    return <Cadastro />;
  }

  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"}>
        <ProtectedRoute>
          <Cadastro />
        </ProtectedRoute>
      </Route>
      <Route path={"/oficina"}>
        <ProtectedRoute>
          <Oficina />
        </ProtectedRoute>
      </Route>
      <Route path={"/orcamentos"}>
        <ProtectedRoute>
          <Orcamentos />
        </ProtectedRoute>
      </Route>
      <Route path={"/clientes"}>
        <ProtectedRoute>
          <Clientes />
        </ProtectedRoute>
      </Route>
      <Route path={"/configuracoes"}>
        <ProtectedRoute>
          <Configuracoes />
        </ProtectedRoute>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider
          defaultTheme="light"
          switchable
        >
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
