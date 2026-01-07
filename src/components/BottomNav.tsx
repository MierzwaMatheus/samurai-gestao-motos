import { Plus, Wrench, FileText, Users, Cog, UserCog, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useEffect, useState } from "react";
import { SupabaseUsuarioRepository } from "@/infrastructure/repositories/SupabaseUsuarioRepository";

interface BottomNavProps {
  active: "cadastro" | "oficina" | "orcamentos" | "clientes" | "servicos" | "usuarios" | "configuracoes" | "relatorios";
}

export default function BottomNav({ active }: BottomNavProps) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const usuarioRepo = useMemo(() => new SupabaseUsuarioRepository(), []);

  useEffect(() => {
    const verificarAdmin = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      try {
        const usuario = await usuarioRepo.buscarPorId(user.id);
        setIsAdmin(usuario?.permissao === "admin" && usuario?.ativo === true);
      } catch {
        setIsAdmin(false);
      }
    };

    verificarAdmin();
  }, [user?.id, usuarioRepo]);

  const navItems = [
    { id: "cadastro", label: "Cadastro", icon: Plus, href: "/" },
    { id: "oficina", label: "Oficina", icon: Wrench, href: "/oficina" },
    { id: "orcamentos", label: "Orçamentos", icon: FileText, href: "/orcamentos" },
    { id: "clientes", label: "Clientes", icon: Users, href: "/clientes" },
    { id: "servicos", label: "Serviços", icon: Cog, href: "/servicos" },
    { id: "relatorios", label: "Relatórios", icon: BarChart3, href: "/relatorios" },
    ...(isAdmin
      ? [{ id: "usuarios", label: "Usuários", icon: UserCog, href: "/usuarios" }]
      : []),
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-foreground/10 overflow-x-auto no-scrollbar">
      <nav className="flex min-w-max px-2 py-2">
        <div className="flex mx-auto gap-4 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[60px] ${
                  isActive ? 'bg-accent/10' : 'hover:bg-foreground/5'
                }`}
              >
                <Icon
                  size={20}
                  className={isActive ? "text-accent" : "text-foreground/60"}
                />
                <span
                  className={`text-xs font-medium font-sans ${
                    isActive ? "text-accent" : "text-foreground/60"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
