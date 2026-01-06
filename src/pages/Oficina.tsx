import { useMemo, useState, useEffect } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ImagePlus,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Camera,
  CheckCircle2,
  Clock,
  PlayCircle,
  Wrench,
  CheckCircle,
  Trash2,
  Settings,
  Search,
  History
} from "lucide-react";
import { toast } from "sonner";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { SupabaseTipoServicoRepository } from "@/infrastructure/repositories/SupabaseTipoServicoRepository";
import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { SupabaseServicoPersonalizadoRepository } from "@/infrastructure/repositories/SupabaseServicoPersonalizadoRepository";
import { Badge } from "@/components/ui/badge";
import { useMotosOficina } from "@/hooks/useMotosOficina";
import { AdicionarFotoStatusUseCase } from "@/domain/usecases/AdicionarFotoStatusUseCase";
import { AtualizarProgressoStatusUseCase } from "@/domain/usecases/AtualizarProgressoStatusUseCase";
import { useAdicionarFotoStatus } from "@/hooks/useAdicionarFotoStatus";
import { useAtualizarProgressoStatus } from "@/hooks/useAtualizarProgressoStatus";
import { useDeletarEntrada } from "@/hooks/useDeletarEntrada";
import { MotoCompleta } from "@shared/types";
import GaleriaFotos from "@/components/GaleriaFotos";
import GaleriaFotosMoto from "@/components/GaleriaFotosMoto";
import { HistoryModal } from "@/components/HistoryModal";

export default function Oficina() {
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const tipoServicoRepo = useMemo(() => new SupabaseTipoServicoRepository(), []);
  const fotoRepo = useMemo(() => new SupabaseFotoRepository(), []);
  const storageApi = useMemo(() => new SupabaseStorageApi(), []);
  const servicoPersonalizadoRepo = useMemo(() => new SupabaseServicoPersonalizadoRepository(), []);
  const { motos, loading, error, recarregar, atualizarMoto } = useMotosOficina(entradaRepo, clienteRepo, motoRepo, tipoServicoRepo, fotoRepo, servicoPersonalizadoRepo);

  const [entradaSelecionada, setEntradaSelecionada] = useState<string | null>(null);
  const [mostrarModalFoto, setMostrarModalFoto] = useState(false);
  const [mostrarGaleria, setMostrarGaleria] = useState<Record<string, boolean>>({});
  const [mostrarGaleriaMoto, setMostrarGaleriaMoto] = useState<Record<string, boolean>>({});
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [observacaoFoto, setObservacaoFoto] = useState("");
  const [progressoFoto, setProgressoFoto] = useState<number | undefined>(undefined);
  const [buscaEmAndamento, setBuscaEmAndamento] = useState("");
  const [buscaConcluidos, setBuscaConcluidos] = useState("");
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedEntradaId, setSelectedEntradaId] = useState<string | null>(null);

  // Ler parâmetro 'cliente' da URL e preencher a busca
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clienteParam = params.get("cliente");
    if (clienteParam) {
      const nomeCliente = decodeURIComponent(clienteParam);
      setBuscaEmAndamento(nomeCliente);
      setBuscaConcluidos(nomeCliente);
      // Limpar o parâmetro da URL após ler
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

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
  const { deletar: deletarEntrada, loading: loadingDeletar } = useDeletarEntrada(entradaRepo);

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
      atualizarMoto(entradaId, { progresso: novoProgresso });
      toast.success("Progresso atualizado!");
    } else {
      toast.error("Erro ao atualizar progresso");
    }
  };

  const handleAtualizarStatus = async (entradaId: string, novoStatus: "pendente" | "alinhando" | "concluido") => {
    const sucesso = await atualizarProgresso(entradaId, { status: novoStatus });
    if (sucesso) {
      atualizarMoto(entradaId, { status: novoStatus });
      toast.success("Status atualizado!");
    } else {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDeletarEntrada = async (entradaId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta entrada? Esta ação não pode ser desfeita.")) {
      return;
    }

    const sucesso = await deletarEntrada(entradaId);
    if (sucesso) {
      toast.success("Entrada excluída com sucesso!");
      recarregar();
    } else {
      toast.error("Erro ao excluir entrada");
    }
  };


  const toggleGaleria = (entradaId: string) => {
    setMostrarGaleria((prev) => ({
      ...prev,
      [entradaId]: !prev[entradaId],
    }));
  };

  const toggleGaleriaMoto = (entradaId: string) => {
    setMostrarGaleriaMoto((prev) => ({
      ...prev,
      [entradaId]: !prev[entradaId],
    }));
  };

  const handleOpenHistory = (entradaId: string) => {
    setSelectedEntradaId(entradaId);
    setHistoryModalOpen(true);
  };

  // Separar motos por status
  const motosEmAndamento = motos.filter(
    (moto) => moto.status === "pendente" || moto.status === "alinhando"
  );
  const motosConcluidas = motos.filter((moto) => moto.status === "concluido");

  // Filtrar motos por busca
  const filtrarMotos = (motosParaFiltrar: MotoCompleta[], busca: string) => {
    if (!busca.trim()) return motosParaFiltrar;

    const buscaLower = busca.toLowerCase();
    return motosParaFiltrar.filter((moto: MotoCompleta) => {
      const modeloMatch = moto.modelo?.toLowerCase().includes(buscaLower);
      const placaMatch = moto.placa?.toLowerCase().includes(buscaLower);
      const clienteMatch = moto.cliente?.toLowerCase().includes(buscaLower);
      const tiposServicoMatch = moto.tiposServico?.some(
        (tipo: any) => tipo.nome.toLowerCase().includes(buscaLower)
      );
      const servicosPersonalizadosMatch = moto.servicosPersonalizados?.some(
        (servico: any) => servico.nome.toLowerCase().includes(buscaLower)
      );

      return modeloMatch || placaMatch || clienteMatch || tiposServicoMatch || servicosPersonalizadosMatch;
    });
  };

  const motosEmAndamentoFiltradas = filtrarMotos(motosEmAndamento, buscaEmAndamento);
  const motosConcluidasFiltradas = filtrarMotos(motosConcluidas, buscaConcluidos);

  const renderMotoCard = (moto: MotoCompleta) => (
    <Card
      key={moto.entradaId}
      className="card-samurai hover:shadow-lg transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-serif text-xl text-foreground">
              {moto.modelo}
            </h3>
            <button
              onClick={() => handleDeletarEntrada(moto.entradaId)}
              disabled={loadingDeletar}
              className="text-foreground/40 hover:text-red-600 transition-colors p-1"
              title="Excluir entrada"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <p className="font-sans text-sm text-foreground/60">
              {moto.placa ? `Placa: ${moto.placa} • ` : ""}{moto.cliente}
            </p>
            <button
              onClick={() => handleOpenHistory(moto.entradaId)}
              className="text-foreground/40 hover:text-accent transition-colors p-1"
              title="Ver histórico"
            >
              <History size={16} />
            </button>
          </div>
          {/* Tipos de Serviço */}
          {moto.tiposServico && moto.tiposServico.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {moto.tiposServico.map((tipo) => (
                <Badge
                  key={tipo.id}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  <Wrench size={10} />
                  {tipo.nome}
                  {tipo.quantidade > 1 && ` (${tipo.quantidade}x)`}
                </Badge>
              ))}
            </div>
          )}
          {/* Serviços Personalizados */}
          {moto.servicosPersonalizados && moto.servicosPersonalizados.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {moto.servicosPersonalizados.map((servico) => (
                <Badge
                  key={servico.id}
                  variant="outline"
                  className="flex items-center gap-1 text-xs border-accent/30"
                >
                  <Settings size={10} />
                  {servico.nome}
                  {servico.quantidade > 1 && ` (${servico.quantidade}x)`}
                </Badge>
              ))}
            </div>
          )}
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

      {/* Galeria de Fotos da Moto (do orçamento) */}
      {moto.fotos && moto.fotos.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => toggleGaleriaMoto(moto.entradaId)}
            className="w-full flex items-center justify-between p-2 bg-foreground/5 rounded-sm hover:bg-foreground/10 transition-colors"
          >
            <span className="font-sans text-sm text-foreground/80">
              {moto.fotos.length} foto(s) do orçamento
            </span>
            {mostrarGaleriaMoto[moto.entradaId] ? (
              <ChevronUp size={16} className="text-foreground/40" />
            ) : (
              <ChevronDown size={16} className="text-foreground/40" />
            )}
          </button>
          {mostrarGaleriaMoto[moto.entradaId] && (
            <GaleriaFotosMoto fotos={moto.fotos} />
          )}
        </div>
      )}

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
  );

  return (
    <div className="min-h-screen bg-background admin-background">
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
          ) : (
            <Tabs defaultValue="em-andamento" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="em-andamento" className="flex items-center gap-2">
                  <Wrench size={16} />
                  Em Andamento
                  {motosEmAndamento.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent/20 text-accent rounded-full">
                      {motosEmAndamento.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="concluidos" className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  Concluídos
                  {motosConcluidas.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-600/20 text-green-600 rounded-full">
                      {motosConcluidas.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="em-andamento" className="space-y-6 mt-6">
                {/* Barra de busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40" size={18} />
                  <Input
                    placeholder="Buscar por modelo, placa, cliente ou serviço..."
                    value={buscaEmAndamento}
                    onChange={(e) => setBuscaEmAndamento(e.target.value)}
                    className="pl-10 bg-card border-foreground/10"
                  />
                </div>

                {motosEmAndamentoFiltradas.length === 0 ? (
                  <Card className="card-samurai text-center py-12">
                    <p className="font-sans text-foreground/60">
                      {buscaEmAndamento ? "Nenhuma moto encontrada" : "Nenhuma moto em processamento"}
                    </p>
                  </Card>
                ) : (
                  motosEmAndamentoFiltradas.map((moto: MotoCompleta) => renderMotoCard(moto))
                )}
              </TabsContent>

              <TabsContent value="concluidos" className="space-y-6 mt-6">
                {/* Barra de busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40" size={18} />
                  <Input
                    placeholder="Buscar por modelo, placa, cliente ou serviço..."
                    value={buscaConcluidos}
                    onChange={(e) => setBuscaConcluidos(e.target.value)}
                    className="pl-10 bg-card border-foreground/10"
                  />
                </div>

                {motosConcluidasFiltradas.length === 0 ? (
                  <Card className="card-samurai text-center py-12">
                    <p className="font-sans text-foreground/60">
                      {buscaConcluidos ? "Nenhuma moto encontrada" : "Nenhum serviço concluído"}
                    </p>
                  </Card>
                ) : (
                  motosConcluidasFiltradas.map((moto: MotoCompleta) => renderMotoCard(moto))
                )}
              </TabsContent>
            </Tabs>
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

      {selectedEntradaId && (
        <HistoryModal
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setSelectedEntradaId(null);
          }}
          entidadeId={selectedEntradaId}
          entidadeTipo="entrada"
        />
      )}
    </div>
  );
}
