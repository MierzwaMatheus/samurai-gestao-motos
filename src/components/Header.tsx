import { LogOut, Settings } from "lucide-react";
import { JapaneseThemeSwitch } from "./JapaneseThemeSwitch";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { useLocation } from "wouter";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { signOut } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await signOut();
    setLocation("/login");
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-foreground/10 px-6 py-4 flex justify-between items-center z-50">
      <h1 className="font-serif text-2xl text-foreground">{title}</h1>
      <div className="flex items-center gap-4">
        <JapaneseThemeSwitch />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/configuracoes")}
          className="text-foreground/60 hover:text-foreground"
          title="Configurações"
        >
          <Settings size={20} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-foreground/60 hover:text-foreground"
          title="Sair"
        >
          <LogOut size={20} />
        </Button>
      </div>
    </header>
  );
}
