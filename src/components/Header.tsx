import { Sword } from "lucide-react";
import { JapaneseThemeSwitch } from "./JapaneseThemeSwitch";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-foreground/10 px-6 py-4 flex justify-between items-center z-50">
      <h1 className="font-serif text-2xl text-foreground">{title}</h1>
      <div className="flex items-center gap-4">
        <JapaneseThemeSwitch />
        <Sword size={28} className="text-accent" />
      </div>
    </header>
  );
}
