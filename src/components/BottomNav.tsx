import { Plus, Wrench, FileText, Users, Cog, UserCog } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useEffect, useState } from "react";
import { SupabaseUsuarioRepository } from "@/infrastructure/repositories/SupabaseUsuarioRepository";

interface BottomNavProps {
  active: "cadastro" | "oficina" | "orcamentos" | "clientes" | "servicos" | "usuarios" | "configuracoes";
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
    ...(isAdmin
      ? [{ id: "usuarios", label: "Usuários", icon: UserCog, href: "/usuarios" }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-foreground/10 px-4 py-2 flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;

        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors"
          >
            <Icon
              size={20}
              className={isActive ? "text-accent" : "text-foreground/40"}
            />
            <span
              className={`text-xs font-sans ${
                isActive ? "text-accent" : "text-foreground/40"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
