import { ReactNode } from "react";

interface CardSamuraiProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

/**
 * Card com estética Shibui - minimalista, com textura sutil
 * Cores: Bege tradicional com borda preta sumi-e
 */
export default function CardSamurai({
  children,
  className = "",
  hover = true,
}: CardSamuraiProps) {
  return (
    <div
      className={`
        bg-card text-card-foreground 
        border border-foreground/5 
        p-6 rounded-sm 
        relative overflow-hidden
        ${hover ? "hover:shadow-lg hover:border-foreground/10" : ""}
        transition-all duration-200
        ${className}
      `}
    >
      {/* Padrão Shibui sutil de fundo */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          )`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
