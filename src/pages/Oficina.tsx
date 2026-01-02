import { useMemo, useState } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ImagePlus, 
  Loader2, 
  X, 
  ChevronDown, 
  ChevronUp,
  Camera,
  CheckCircle2,
  Clock,
  PlayCircle
} from "lucide-react";
import { toast } from "sonner";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { useMotosOficina } from "@/hooks/useMotosOficina";
import { AdicionarFotoStatusUseCase } from "@/domain/usecases/AdicionarFotoStatusUseCase";
import { AtualizarProgressoStatusUseCase } from "@/domain/usecases/AtualizarProgressoStatusUseCase";
import { useAdicionarFotoStatus } from "@/hooks/useAdicionarFotoStatus";
import { useAtualizarProgressoStatus } from "@/hooks/useAtualizarProgressoStatus";
import GaleriaFotos from "@/components/GaleriaFotos";

export default function Oficina() {
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const storageApi = useMemo(() => new SupabaseStorageApi(), []);
  const { motos, loading, error, recarregar } = useMotosOficina(entradaRepo, clienteRepo, motoRepo);

  const [entradaSelecionada, setEntradaSelecionada] = useState<string | null>(null);
  const [mostrarModalFoto, setMostrarModalFoto] = useState(false);
  const [mostrarGaleria, setMostrarGaleria] = useState<Record<string, boolean>>({});
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [observacaoFoto, setObservacaoFoto] = useState("");
  const [progressoFoto, setProgressoFoto] = useState<number | undefined>(undefined);

  const adicionarFotoStatusUseCase = useMemo(
    () => new AdicionarFotoStatusUseCase(entradaRepo, storageApi),
    [entradaRepo, storageApi]
  );
  const atualizarProgressoStatusUseCase = useMemo(
    () => new AtualizarProgressoStatusUseCase(entradaRepo),
    [entradaRepo]
  );

  const { adicionar: adicionarFoto, loading: loadingFoto } = useAdicionarFotoStatus(adicionarFotoStatusUseCase);
  const { atualizar: atualizarProgresso, loading: loadingProgresso } = useAtualizarProgressoStatus(atualizarProgressoStatusUseCase);

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

  const handleAbrirModalFoto = (entradaId: string) => {
    setEntradaSelecionada(entradaId);
    const moto = motos.find((m) => m.entradaId === entradaId);
    if (moto) {
      setProgressoFoto(moto.progresso);
    }
    setMostrarModalFoto(true);
  };

  const handleFecharModalFoto = () => {
    setMostrarModalFoto(false);
    setEntradaSelecionada(null);
    setArquivoFoto(null);
    setObservacaoFoto("");
    setProgressoFoto(undefined);
  };

  const handleSalvarFoto = async () => {
    if (!entradaSelecionada || !arquivoFoto) {
      toast.error("Selecione uma foto");
      return;
    }

    const foto = await adicionarFoto(
      entradaSelecionada,
      arquivoFoto,
      observacaoFoto || undefined,
      progressoFoto
    );

    if (foto) {
      toast.success("Foto adicionada com sucesso!");
      handleFecharModalFoto();
      recarregar();
    } else {
      toast.error("Erro ao adicionar foto");
    }
  };

  const handleAtualizarProgresso = async (entradaId: string, novoProgresso: number) => {
    const sucesso = await atualizarProgresso(entradaId, { progresso: novoProgresso });
    if (sucesso) {
      toast.success("Progresso atualizado!");
      recarregar();
    } else {
      toast.error("Erro ao atualizar progresso");
    }
  };

  const handleAtualizarStatus = async (entradaId: string, novoStatus: "pendente" | "alinhando" | "concluido") => {
    const sucesso = await atualizarProgresso(entradaId, { status: novoStatus });
    if (sucesso) {
      toast.success("Status atualizado!");
      recarregar();
    } else {
      toast.error("Erro ao atualizar status");
    }
  };


  const toggleGaleria = (entradaId: string) => {
    setMostrarGaleria((prev) => ({
      ...prev,
      [entradaId]: !prev[entradaId],
    }));
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
                key={moto.entradaId}
                className="card-samurai hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-serif text-xl text-foreground">
                      {moto.modelo}
                    </h3>
                    <p className="font-sans text-sm text-foreground/60">
                      {moto.placa ? `Placa: ${moto.placa} • ` : ""}{moto.cliente}
                    </p>
                  </div>
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAtualizarProgresso(moto.entradaId, Math.max(0, moto.progresso - 10))}
                        className="text-foreground/40 hover:text-accent transition-colors"
                        disabled={loadingProgresso}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <span className="font-sans text-xs text-foreground/60 min-w-[3rem] text-center">
                        {moto.progresso}%
                      </span>
                      <button
                        onClick={() => handleAtualizarProgresso(moto.entradaId, Math.min(100, moto.progresso + 10))}
                        className="text-foreground/40 hover:text-accent transition-colors"
                        disabled={loadingProgresso}
                      >
                        <ChevronUp size={16} />
                      </button>
                    </div>
                  </div>
                  <Progress
                    value={moto.progresso}
                    className="h-2 bg-foreground/10"
                  />
                </div>

                {/* Galeria de Fotos de Status */}
                {moto.fotosStatus && moto.fotosStatus.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => toggleGaleria(moto.entradaId)}
                      className="w-full flex items-center justify-between p-2 bg-foreground/5 rounded-sm hover:bg-foreground/10 transition-colors"
                    >
                      <span className="font-sans text-sm text-foreground/80">
                        {moto.fotosStatus.length} foto(s) de status
                      </span>
                      {mostrarGaleria[moto.entradaId] ? (
                        <ChevronUp size={16} className="text-foreground/40" />
                      ) : (
                        <ChevronDown size={16} className="text-foreground/40" />
                      )}
                    </button>
                    {mostrarGaleria[moto.entradaId] && (
                      <GaleriaFotos fotos={moto.fotosStatus} />
                    )}
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAbrirModalFoto(moto.entradaId)}
                    variant="outline"
                    className="flex-1 text-sm"
                  >
                    <Camera size={16} className="mr-2" />
                    Adicionar Foto
                  </Button>
                  <Button
                    onClick={() => handleAtualizarStatus(moto.entradaId, moto.status === "pendente" ? "alinhando" : moto.status === "alinhando" ? "concluido" : "pendente")}
                    variant="default"
                    className="flex-1 text-sm bg-accent hover:brightness-110"
                    disabled={loadingProgresso}
                  >
                    {moto.status === "pendente" ? (
                      <>
                        <PlayCircle size={16} className="mr-2" />
                        Iniciar
                      </>
                    ) : moto.status === "alinhando" ? (
                      <>
                        <CheckCircle2 size={16} className="mr-2" />
                        Concluir
                      </>
                    ) : (
                      <>
                        <Clock size={16} className="mr-2" />
                        Reabrir
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Modal para Adicionar Foto */}
      {mostrarModalFoto && entradaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="card-samurai max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg text-foreground">Adicionar Foto de Status</h3>
              <button
                onClick={handleFecharModalFoto}
                className="text-foreground/40 hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="foto">Foto</Label>
                <Input
                  id="foto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArquivoFoto(e.target.files?.[0] || null)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="progresso">Progresso (%)</Label>
                <Input
                  id="progresso"
                  type="number"
                  min="0"
                  max="100"
                  value={progressoFoto ?? ""}
                  onChange={(e) => setProgressoFoto(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Textarea
                  id="observacao"
                  value={observacaoFoto}
                  onChange={(e) => setObservacaoFoto(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleFecharModalFoto}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSalvarFoto}
                  disabled={!arquivoFoto || loadingFoto}
                  className="flex-1 bg-accent hover:brightness-110"
                >
                  {loadingFoto ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <BottomNav active="oficina" />
    </div>
  );
}
