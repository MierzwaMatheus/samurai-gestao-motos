import { EntryType } from "@/../../shared/types";

interface EntryTypeToggleProps {
  value: EntryType;
  onChange: (type: EntryType) => void;
}

export default function EntryTypeToggle({ value, onChange }: EntryTypeToggleProps) {
  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex bg-card border border-foreground/10 rounded-full p-1">
        <button
          onClick={() => onChange("entrada")}
          className={`px-6 py-2 rounded-full font-sans font-semibold text-sm transition-all ${
            value === "entrada"
              ? "bg-accent text-white shadow-lg shadow-accent/20"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          Entrada
        </button>
        <button
          onClick={() => onChange("orcamento")}
          className={`px-6 py-2 rounded-full font-sans font-semibold text-sm transition-all ${
            value === "orcamento"
              ? "bg-accent text-white shadow-lg shadow-accent/20"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          Orçamento
        </button>
      </div>
    </div>
  );
}
