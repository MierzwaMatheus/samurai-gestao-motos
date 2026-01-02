import { Plus, Wrench, FileText } from "lucide-react";
import { Link } from "wouter";

interface BottomNavProps {
  active: "cadastro" | "oficina" | "orcamentos";
}

export default function BottomNav({ active }: BottomNavProps) {
  const navItems = [
    { id: "cadastro", label: "Cadastro", icon: Plus, href: "/" },
    { id: "oficina", label: "Oficina", icon: Wrench, href: "/oficina" },
    { id: "orcamentos", label: "Orçamentos", icon: FileText, href: "/orcamentos" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-foreground/10 px-4 py-3 flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;

        return (
          <Link key={item.id} href={item.href}>
            <a className="flex flex-col items-center gap-1 p-2 transition-colors">
              <Icon
                size={24}
                className={isActive ? "text-accent" : "text-foreground/40"}
              />
              <span
                className={`text-xs font-sans ${
                  isActive ? "text-accent" : "text-foreground/40"
                }`}
              >
                {item.label}
              </span>
            </a>
          </Link>
        );
      })}
    </nav>
  );
}
