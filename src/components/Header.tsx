import { LogOut, Settings, HardDrive } from "lucide-react";
import { JapaneseThemeSwitch } from "./JapaneseThemeSwitch";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { useLocation } from "wouter";
import { StorageManager } from "./StorageManager";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { useStorageInfo } from "@/hooks/useStorageInfo";
import { useEffect } from "react";

interface HeaderProps {
  title: string;
}

const storageApi = new SupabaseStorageApi();

function StorageBar() {
  const { info, loading, carregarInfo } = useStorageInfo(storageApi);

  useEffect(() => {
    carregarInfo();
    const interval = setInterval(carregarInfo, 30000);
    return () => clearInterval(interval);
  }, [carregarInfo]);

  return (
    <StorageManager storageApi={storageApi}>
      <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
        <HardDrive size={18} className="text-muted-foreground" />
        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
          {info ? (
            <div
              className={`h-full transition-all ${info.corBarra}`}
              style={{ width: `${info.percentualUsado}%` }}
            />
          ) : (
            <div className="h-full bg-muted-foreground/20 animate-pulse" />
          )}
        </div>
        <span className="text-xs text-muted-foreground min-w-[60px]">
          {info ? `${info.percentualUsado.toFixed(0)}%` : "..."}
        </span>
      </div>
    </StorageManager>
  );
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
        <StorageBar />
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
