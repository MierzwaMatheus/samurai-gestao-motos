import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Switch de tema com estilo japonês clássico
 * Inspirado em lanternas japonesas e portas shoji
 * Com animações suaves estilo Apple
 */
export function JapaneseThemeSwitch() {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex items-center justify-center",
        "w-16 h-9 rounded-full",
        "transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2",
        "active:scale-[0.97]",
        // Fundo com gradiente suave
        isDark
          ? "bg-gradient-to-r from-foreground/20 via-foreground/15 to-foreground/20"
          : "bg-gradient-to-r from-foreground/10 via-foreground/5 to-foreground/10",
        // Borda sutil
        "border border-foreground/20",
        // Sombra elegante com glow no modo escuro
        isDark
          ? "shadow-lg shadow-accent/20"
          : "shadow-lg shadow-foreground/10",
        // Hover effect
        "hover:shadow-xl",
        isDark
          ? "hover:shadow-accent/30"
          : "hover:shadow-foreground/20",
        "hover:border-foreground/30"
      )}
      aria-label={`Alternar para tema ${isDark ? "claro" : "escuro"}`}
      role="switch"
      aria-checked={isDark}
    >
      {/* Track com padrão shoji (linhas sutis) */}
      <div
        className={cn(
          "absolute inset-0 rounded-full",
          "transition-opacity duration-500",
          "opacity-0",
          isDark && "opacity-100"
        )}
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(255, 255, 255, 0.05) 2px,
              rgba(255, 255, 255, 0.05) 4px
            )
          `,
        }}
      />

      {/* Thumb (botão deslizante) com estilo de lanterna */}
      <div
        className={cn(
          "absolute left-1 top-1/2 -translate-y-1/2",
          "w-7 h-7 rounded-full",
          "flex items-center justify-center",
          "transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          // Sombra com glow no modo escuro
          isDark
            ? "shadow-lg shadow-accent/40"
            : "shadow-md shadow-foreground/20",
          // Transform suave estilo Apple com bounce sutil
          isDark ? "translate-x-7" : "translate-x-0",
          // Cores baseadas no tema
          isDark
            ? "bg-gradient-to-br from-accent via-accent to-accent/90"
            : "bg-gradient-to-br from-foreground/90 via-foreground to-foreground/80",
          // Brilho sutil
          "before:absolute before:inset-0 before:rounded-full",
          isDark
            ? "before:bg-gradient-to-br before:from-white/25 before:via-white/15 before:to-transparent"
            : "before:bg-gradient-to-br before:from-white/30 before:to-transparent"
        )}
      >
        {/* Ícone interno com animação suave */}
        <div
          className={cn(
            "relative z-10 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            isDark ? "rotate-0 scale-100 opacity-100" : "rotate-180 scale-0 opacity-0"
          )}
        >
          <Moon className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center z-10 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            !isDark ? "rotate-0 scale-100 opacity-100" : "rotate-180 scale-0 opacity-0"
          )}
        >
          <Sun className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>

        {/* Efeito de brilho interno (lanterna) */}
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "transition-opacity duration-700 ease-out",
            isDark ? "opacity-40" : "opacity-0"
          )}
          style={{
            background: "radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.15) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Partículas sutis de transição (opcional, estilo elegante) */}
      <div
        className={cn(
          "absolute inset-0 rounded-full pointer-events-none",
          "transition-opacity duration-300",
          "opacity-0"
        )}
        style={{
          background: isDark
            ? "radial-gradient(circle at 50% 50%, rgba(220, 38, 38, 0.1) 0%, transparent 70%)"
            : "radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.05) 0%, transparent 70%)",
        }}
      />
    </button>
  );
}

