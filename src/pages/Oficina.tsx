import { useMemo } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ImagePlus, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { useMotosOficina } from "@/hooks/useMotosOficina";

export default function Oficina() {
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const { motos, loading, error } = useMotosOficina(entradaRepo, clienteRepo, motoRepo);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "alinhando":
        return "EM ALINHAMENTO";
      case "concluido":
        return "CONCLUÍDO";
      case "pendente":
        return "PENDENTE";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "alinhando":
        return "text-accent";
      case "concluido":
        return "text-green-600";
      case "pendente":
        return "text-foreground/40";
      default:
        return "text-foreground";
    }
  };

  const handleAdicionarFoto = (motoId: string) => {
    toast.success("Foto adicionada com sucesso!");
    // Implementar upload de foto
  };

  const handleEditar = (motoId: string) => {
    toast.info("Edição de moto - Funcionalidade em desenvolvimento");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Oficina" />

      <main className="pt-20 pb-32 px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {loading ? (
            <Card className="card-samurai text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
              <p className="font-sans text-foreground/60">Carregando motos...</p>
            </Card>
          ) : error ? (
            <Card className="card-samurai text-center py-12">
              <p className="font-sans text-red-500">{error}</p>
            </Card>
          ) : motos.length === 0 ? (
            <Card className="card-samurai text-center py-12">
              <p className="font-sans text-foreground/60">
                Nenhuma moto em processamento
              </p>
            </Card>
          ) : (
            motos.map((moto) => (
              <Card
                key={moto.id}
                className="card-samurai hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-serif text-xl text-foreground">
                      {moto.modelo}
                    </h3>
                    <p className="font-sans text-sm text-foreground/60">
                      {moto.placa ? `Placa: ${moto.placa} • ` : ""}{moto.cliente}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEditar(moto.id)}
                    className="text-foreground/40 hover:text-accent transition-colors"
                  >
                    <Edit2 size={20} />
                  </button>
                </div>

                {/* Barra de Progresso */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`font-serif text-xs tracking-tighter ${getStatusColor(
                        moto.status
                      )}`}
                    >
                      {getStatusLabel(moto.status)}
                    </span>
                    <span className="font-sans text-xs text-foreground/60">
                      {moto.progresso}%
                    </span>
                  </div>
                  <Progress
                    value={moto.progresso}
                    className="h-2 bg-foreground/10"
                  />
                </div>

                {/* Botão Ação Rápida */}
                <button
                  onClick={() => handleAdicionarFoto(moto.id)}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-card border border-foreground/10 hover:border-accent/30 hover:bg-foreground/5 transition-all rounded-sm"
                >
                  <ImagePlus size={18} className="text-accent" />
                  <span className="font-sans text-sm text-foreground/80">
                    Adicionar Foto de Status
                  </span>
                </button>
              </Card>
            ))
          )}
        </div>
      </main>

      <BottomNav active="oficina" />
    </div>
  );
}
