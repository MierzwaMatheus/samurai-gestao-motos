import { useMemo, useState, useEffect, useRef } from "react";
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
  History,
  DollarSign,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { SupabaseTipoServicoRepository } from "@/infrastructure/repositories/SupabaseTipoServicoRepository";
import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { SupabaseServicoPersonalizadoRepository } from "@/infrastructure/repositories/SupabaseServicoPersonalizadoRepository";
import { Badge } from "@/components/ui/badge";
import { useMotosOficina } from "@/hooks/useMotosOficina";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { AdicionarFotoStatusUseCase } from "@/domain/usecases/AdicionarFotoStatusUseCase";
import { AtualizarProgressoStatusUseCase } from "@/domain/usecases/AtualizarProgressoStatusUseCase";
import { useAdicionarFotoStatus } from "@/hooks/useAdicionarFotoStatus";
import { useAtualizarProgressoStatus } from "@/hooks/useAtualizarProgressoStatus";
import { useDeletarEntrada } from "@/hooks/useDeletarEntrada";
import { MotoCompleta } from "@shared/types";
import GaleriaFotos from "@/components/GaleriaFotos";
import GaleriaFotosMoto from "@/components/GaleriaFotosMoto";
import { HistoryModal } from "@/components/HistoryModal";
import { useGerarOS } from "@/hooks/useGerarOS";
import { FileText } from "lucide-react";
import { FormaPagamento } from "@shared/types";
import { usePagamento } from "@/hooks/usePagamento";
import { PrepararDadosEntradaParaEdicaoUseCase } from "@/domain/usecases/PrepararDadosEntradaParaEdicaoUseCase";
import { sortMotosEmAndamento, sortMotosConcluidas } from "@/utils/sorting";

type Aba = "em-andamento" | "concluidos";

export default function Oficina() {
  const [, setLocation] = useLocation();
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const tipoServicoRepo = useMemo(
    () => new SupabaseTipoServicoRepository(),
    []
  );
  const fotoRepo = useMemo(() => new SupabaseFotoRepository(), []);
  const storageApi = useMemo(() => new SupabaseStorageApi(), []);
  const servicoPersonalizadoRepo = useMemo(
    () => new SupabaseServicoPersonalizadoRepository(),
    []
  );

  // Duas instâncias independentes de `useMotosOficina` — uma por aba.
  // Cada aba tem sua própria paginação, busca debounced e sentinel
  // (issue #11 ciclo 9). O split entre as abas é feito server-side via
  // `statusEntrega`:
  //   - Em Andamento  → status_entrega = 'pendente' (em processamento)
  //   - Concluídos    → status_entrega IN ('entregue', 'retirado')
  // A coluna `status` da entrada (sempre 'concluido' para entradas já
  // processadas) NÃO serve para esse split — usar `statusEntrega`.
  const oficinaEmAndamento = useMotosOficina(entradaRepo, {
    pageSize: 10,
    tipo: "entrada",
    statusEntrega: ["pendente"],
  });
  const oficinaConcluidos = useMotosOficina(entradaRepo, {
    pageSize: 10,
    tipo: "entrada",
    statusEntrega: ["entregue", "retirado"],
  });

  // Helper que atualiza uma moto em ambas as instâncias (a moto pode
  // estar em qualquer das duas listas paginadas).
  const atualizarMoto = (
    entradaId: string,
    atualizacoes: Partial<MotoCompleta>
  ) => {
    oficinaEmAndamento.atualizarMoto(entradaId, atualizacoes);
    oficinaConcluidos.atualizarMoto(entradaId, atualizacoes);
  };

  // Helper que recarrega ambas as instâncias (usado após ações que
  // afetam a lista: salvar foto, deletar entrada, gerar OS).
  const recarregar = () => {
    void oficinaEmAndamento.recarregar();
    void oficinaConcluidos.recarregar();
  };

  // Carga inicial: ambas as instâncias disparam a primeira página.
  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { atualizarStatusPagamento, atualizarFormaPagamento } = usePagamento();

  const [entradaSelecionada, setEntradaSelecionada] = useState<string | null>(
    null
  );
  const [mostrarModalFoto, setMostrarModalFoto] = useState(false);
  const [mostrarGaleria, setMostrarGaleria] = useState<Record<string, boolean>>(
    {}
  );
  const [mostrarGaleriaMoto, setMostrarGaleriaMoto] = useState<
    Record<string, boolean>
  >({});
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [observacaoFoto, setObservacaoFoto] = useState("");
  const [progressoFoto, setProgressoFoto] = useState<number | undefined>(
    undefined
  );
  const [buscaEmAndamento, setBuscaEmAndamento] = useState("");
  const [buscaConcluidos, setBuscaConcluidos] = useState("");
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedEntradaId, setSelectedEntradaId] = useState<string | null>(
    null
  );
  const [mostrarModalPagamento, setMostrarModalPagamento] = useState(false);
  const [entradaPagamentoId, setEntradaPagamentoId] = useState<string | null>(
    null
  );
  const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] =
    useState<FormaPagamento | null>(null);
  const [statusPagamentoSelecionado, setStatusPagamentoSelecionado] = useState<
    "pendente" | "pago" | null
  >(null);
  const [isEdicaoPagamento, setIsEdicaoPagamento] = useState(false);

  // Ler parâmetro 'cliente' da URL e preencher a busca
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clienteParam = params.get("cliente");
    if (clienteParam) {
      const nomeCliente = decodeURIComponent(clienteParam);
      setBuscaEmAndamento(nomeCliente);
      setBuscaConcluidos(nomeCliente);
      oficinaEmAndamento.setBusca(nomeCliente);
      oficinaConcluidos.setBusca(nomeCliente);
      // Limpar o parâmetro da URL após ler
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adicionarFotoStatusUseCase = useMemo(
    () => new AdicionarFotoStatusUseCase(entradaRepo, storageApi),
    [entradaRepo, storageApi]
  );
  const atualizarProgressoStatusUseCase = useMemo(
    () => new AtualizarProgressoStatusUseCase(entradaRepo),
    [entradaRepo]
  );

  const { adicionar: adicionarFoto, loading: loadingFoto } =
    useAdicionarFotoStatus(adicionarFotoStatusUseCase);
  const { atualizar: atualizarProgresso, loading: loadingProgresso } =
    useAtualizarProgressoStatus(atualizarProgressoStatusUseCase);
  const { deletar: deletarEntrada, loading: loadingDeletar } =
    useDeletarEntrada(entradaRepo);

  const { gerar: gerarOS, loading: loadingOS } = useGerarOS(
    entradaRepo,
    clienteRepo,
    motoRepo,
    fotoRepo,
    tipoServicoRepo,
    servicoPersonalizadoRepo,
    storageApi
  );

  const prepararDadosEdicaoUseCase = useMemo(
    () =>
      new PrepararDadosEntradaParaEdicaoUseCase(
        entradaRepo,
        clienteRepo,
        motoRepo,
        fotoRepo,
        tipoServicoRepo,
        servicoPersonalizadoRepo
      ),
    [
      entradaRepo,
      clienteRepo,
      motoRepo,
      fotoRepo,
      tipoServicoRepo,
      servicoPersonalizadoRepo,
    ]
  );

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
    const moto =
      oficinaEmAndamento.motos.find(m => m.entradaId === entradaId) ??
      oficinaConcluidos.motos.find(m => m.entradaId === entradaId);
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

  const handleAtualizarProgresso = async (
    entradaId: string,
    novoProgresso: number
  ) => {
    const sucesso = await atualizarProgresso(entradaId, {
      progresso: novoProgresso,
    });
    if (sucesso) {
      atualizarMoto(entradaId, { progresso: novoProgresso });
      toast.success("Progresso atualizado!");
    } else {
      toast.error("Erro ao atualizar progresso");
    }
  };

  const handleAtualizarStatus = async (
    entradaId: string,
    novoStatus: "pendente" | "alinhando" | "concluido"
  ) => {
    if (novoStatus === "concluido") {
      setEntradaPagamentoId(entradaId);
      setFormaPagamentoSelecionada(null);
      setMostrarModalPagamento(true);
      return;
    }

    const sucesso = await atualizarProgresso(entradaId, {
      status: novoStatus,
      dataConclusao: null,
      formaPagamento: null,
    });
    if (sucesso) {
      atualizarMoto(entradaId, {
        status: novoStatus,
        dataConclusao: null,
        formaPagamento: null,
      });
      toast.success("Status atualizado!");
    } else {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleCancelarPagamento = () => {
    setMostrarModalPagamento(false);
    setEntradaPagamentoId(null);
    setFormaPagamentoSelecionada(null);
    setStatusPagamentoSelecionado(null);
    setIsEdicaoPagamento(false);
  };

  const handleAbrirModalPagamento = (
    entradaId: string,
    formaPagamentoExistente?: string | null,
    statusPagamentoExistente?: string | null,
    ehEdicao = false
  ) => {
    setEntradaPagamentoId(entradaId);
    setFormaPagamentoSelecionada(
      formaPagamentoExistente as FormaPagamento | null
    );
    setStatusPagamentoSelecionado(
      statusPagamentoExistente as "pendente" | "pago" | null
    );
    setIsEdicaoPagamento(ehEdicao);
    setMostrarModalPagamento(true);
  };

  const handleConfirmarPagamento = async () => {
    if (!entradaPagamentoId || !formaPagamentoSelecionada) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    if (isEdicaoPagamento) {
      await atualizarFormaPagamento(
        entradaPagamentoId,
        formaPagamentoSelecionada
      );
      await atualizarStatusPagamento(
        entradaPagamentoId,
        statusPagamentoSelecionado || "pago"
      );
      atualizarMoto(entradaPagamentoId, {
        formaPagamento: formaPagamentoSelecionada,
        statusPagamento: statusPagamentoSelecionado || "pago",
      });
      toast.success("Pagamento atualizado!");
      handleCancelarPagamento();
      return;
    }

    const sucesso = await atualizarProgresso(entradaPagamentoId, {
      status: "concluido",
      dataConclusao: new Date(),
      formaPagamento: formaPagamentoSelecionada,
    });

    if (sucesso) {
      await atualizarStatusPagamento(entradaPagamentoId, "pendente");
      atualizarMoto(entradaPagamentoId, {
        status: "concluido",
        dataConclusao: new Date(),
        formaPagamento: formaPagamentoSelecionada,
        statusPagamento: "pendente",
      });
      toast.success("Serviço concluído! Pagamento pendente.");
      handleCancelarPagamento();
    } else {
      toast.error("Erro ao concluir entrada");
    }
  };

  const handleDeletarEntrada = async (entradaId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta entrada? Esta ação não pode ser desfeita."
      )
    ) {
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

  const handleGerarOS = async (entradaId: string) => {
    try {
      await gerarOS(entradaId);
      toast.success("Ordem de Serviço gerada com sucesso!");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao gerar OS";
      toast.error(mensagem);
    }
  };

  const handleEditarEntrada = async (entradaId: string) => {
    try {
      const dados = await prepararDadosEdicaoUseCase.execute(entradaId);
      sessionStorage.setItem("dadosOrcamentoParaOS", JSON.stringify(dados));
      setLocation("/");
      toast.success("Dados carregados para edição!");
    } catch (err) {
      const mensagem =
        err instanceof Error ? err.message : "Erro ao carregar dados";
      toast.error(mensagem);
    }
  };

  const toggleGaleria = (entradaId: string) => {
    setMostrarGaleria(prev => ({
      ...prev,
      [entradaId]: !prev[entradaId],
    }));
  };

  const toggleGaleriaMoto = (entradaId: string) => {
    setMostrarGaleriaMoto(prev => ({
      ...prev,
      [entradaId]: !prev[entradaId],
    }));
  };

  const handleOpenHistory = (entradaId: string) => {
    setSelectedEntradaId(entradaId);
    setHistoryModalOpen(true);
  };

  // Sub-aba ativa (Em Andamento / Concluídos). O Radix Tabs é controlado
  // para que possamos chamar `recarregar()` na aba recém-ativada
  // — assim, ao alternar entre as duas listas, cada uma zera a
  // paginação e recarrega do zero (issue #11 ciclo 9).
  const [abaSelecionada, setAbaSelecionada] = useState<Aba>("em-andamento");

  const handleTabChange = (value: string) => {
    const novaAba = (value as Aba) ?? "em-andamento";
    setAbaSelecionada(novaAba);
    if (novaAba === "em-andamento") {
      void oficinaEmAndamento.recarregar();
    } else {
      void oficinaConcluidos.recarregar();
    }
  };

  // Sentinels de scroll infinito, um por aba. Cada um é observado pelo
  // `useInfiniteScroll` com o `carregarMais` da sua própria instância
  // — daí o comportamento independente entre as abas.
  const sentinelEmAndamentoRef = useRef<HTMLDivElement | null>(null);
  const sentinelConcluidosRef = useRef<HTMLDivElement | null>(null);

  useInfiniteScroll(sentinelEmAndamentoRef, {
    onIntersect: oficinaEmAndamento.carregarMais,
    hasMore: oficinaEmAndamento.hasMore,
    loading: oficinaEmAndamento.loading,
  });

  useInfiniteScroll(sentinelConcluidosRef, {
    onIntersect: oficinaConcluidos.carregarMais,
    hasMore: oficinaConcluidos.hasMore,
    loading: oficinaConcluidos.loading,
  });

  // Combina loading/error de ambas as instâncias para o overlay global.
  const loadingGlobal =
    oficinaEmAndamento.loading || oficinaConcluidos.loading;
  const erroGlobal =
    oficinaEmAndamento.error || oficinaConcluidos.error;

  // Separar motos por status_entrega. A partir do ciclo 9, a busca é
  // server-side (via `oficinaX.setBusca`) — não há mais `filtrarMotos`
  // client-side. O split entre as abas também é server-side via
  // `statusEntrega`, mas mantemos um filtro em memória como salvaguarda
  // (defesa em profundidade) caso a paginação traga um item fora do
  // esperado por race condition.
  const motosEmAndamento = sortMotosEmAndamento(
    oficinaEmAndamento.motos.filter(moto => moto.statusEntrega === "pendente")
  );
  const motosConcluidas = sortMotosConcluidas(
    oficinaConcluidos.motos.filter(
      moto =>
        moto.statusEntrega === "entregue" || moto.statusEntrega === "retirado"
    )
  );

  const renderMotoCard = (moto: MotoCompleta, posicao?: number) => (
    <Card
      key={moto.entradaId}
      className="card-samurai hover:shadow-lg transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              {posicao !== undefined && (
                <Badge className="bg-accent text-white font-serif">
                  {posicao}º
                </Badge>
              )}
              <h3 className="font-serif text-xl text-foreground">
                {moto.modelo}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {posicao !== undefined && (
                <button
                  onClick={() => handleEditarEntrada(moto.entradaId)}
                  className="text-foreground/40 hover:text-accent transition-colors p-1"
                  title="Editar entrada"
                >
                  <Edit size={18} />
                </button>
              )}
              <button
                onClick={() => handleDeletarEntrada(moto.entradaId)}
                disabled={loadingDeletar}
                className="text-foreground/40 hover:text-red-600 transition-colors p-1"
                title="Excluir entrada"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="font-sans text-sm text-foreground/60">
              {moto.placa ? `Placa: ${moto.placa} • ` : ""}
              {moto.cliente}
              {moto.telefone && (
                <span
                  onClick={() => {
                    navigator.clipboard.writeText(moto.telefone!);
                    toast.success(`Telefone ${moto.telefone} copiado!`);
                  }}
                  className="ml-2 text-accent cursor-pointer hover:underline"
                  title="Clique para copiar o telefone"
                >
                  📞 {moto.telefone}
                </span>
              )}
            </p>
            <button
              onClick={() => handleOpenHistory(moto.entradaId)}
              className="text-foreground/40 hover:text-accent transition-colors p-1"
              title="Ver histórico"
            >
              <History size={16} />
            </button>
            {moto.status === "concluido" && (
              <button
                onClick={() =>
                  handleAbrirModalPagamento(
                    moto.entradaId,
                    moto.formaPagamento,
                    moto.statusPagamento,
                    true
                  )
                }
                className="text-foreground/40 hover:text-green-600 transition-colors p-1"
                title="Editar pagamento"
              >
                <DollarSign size={16} />
              </button>
            )}
          </div>
          {(moto.marca || moto.ano || moto.cilindrada) && (
            <p className="font-sans text-xs text-foreground/50 mt-1">
              {[moto.marca, moto.ano, moto.cilindrada]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
          {moto.status === "concluido" && moto.dataConclusao && (
            <p className="font-sans text-xs text-foreground/60 mt-1">
              Concluído em{" "}
              {new Date(moto.dataConclusao).toLocaleDateString("pt-BR")}
            </p>
          )}
          {moto.status === "concluido" && (
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant={
                  moto.statusPagamento === "pago" ? "default" : "secondary"
                }
                className="flex items-center gap-1"
              >
                {moto.statusPagamento === "pago" ? "💰 Pago" : "⏳ Pendente"}
              </Badge>
              {moto.formaPagamento && (
                <Badge variant="outline" className="text-xs">
                  {formatarFormaPagamento(moto.formaPagamento)}
                </Badge>
              )}
            </div>
          )}
          {/* Tipos de Serviço */}
          {moto.tiposServico && moto.tiposServico.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {moto.tiposServico.map(tipo => (
                <Badge
                  key={tipo.id}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  <Wrench size={10} />
                  {tipo.nome}
                  {tipo.categoria === "alinhamento" && (
                    <span className="ml-1 text-[10px] opacity-70">
                      {tipo.comOleo ? "(Com Óleo)" : "(Sem Óleo)"}
                    </span>
                  )}
                  {tipo.quantidade > 1 && ` (${tipo.quantidade}x)`}
                </Badge>
              ))}
            </div>
          )}
          {/* Serviços Personalizados */}
          {moto.servicosPersonalizados &&
            moto.servicosPersonalizados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {moto.servicosPersonalizados.map(servico => (
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
              onClick={() =>
                handleAtualizarProgresso(
                  moto.entradaId,
                  Math.max(0, moto.progresso - 10)
                )
              }
              className="text-foreground/40 hover:text-accent transition-colors"
              disabled={loadingProgresso}
            >
              <ChevronDown size={16} />
            </button>
            <span className="font-sans text-xs text-foreground/60 min-w-12 text-center">
              {moto.progresso}%
            </span>
            <button
              onClick={() =>
                handleAtualizarProgresso(
                  moto.entradaId,
                  Math.min(100, moto.progresso + 10)
                )
              }
              className="text-foreground/40 hover:text-accent transition-colors"
              disabled={loadingProgresso}
            >
              <ChevronUp size={16} />
            </button>
          </div>
        </div>
        <Progress value={moto.progresso} className="h-2 bg-foreground/10" />
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
          onClick={() =>
            handleAtualizarStatus(
              moto.entradaId,
              moto.status === "pendente"
                ? "alinhando"
                : moto.status === "alinhando"
                  ? "concluido"
                  : "pendente"
            )
          }
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

      {/* Botão Gerar OS (Apenas Concluídos) */}
      {moto.status === "concluido" && (
        <Button
          onClick={() => handleGerarOS(moto.entradaId)}
          variant="outline"
          className="w-full mt-2 text-sm"
          disabled={loadingOS}
        >
          <FileText size={16} className="mr-2" />
          {loadingOS ? "Gerando..." : "Gerar OS"}
        </Button>
      )}
    </Card>
  );

  return (
    <div className="min-h-screen bg-background admin-background">
      <Header title="Oficina" />

      <main className="pt-20 pb-32 px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {loadingGlobal ? (
            <Card className="card-samurai text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
              <p className="font-sans text-foreground/60">
                Carregando motos...
              </p>
            </Card>
          ) : erroGlobal ? (
            <Card className="card-samurai text-center py-12">
              <p className="font-sans text-red-500">{erroGlobal}</p>
            </Card>
          ) : (
            <Tabs
              value={abaSelecionada}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <TabsList className="w-full flex overflow-x-auto no-scrollbar rounded-lg bg-muted p-1">
                <TabsTrigger
                  value="em-andamento"
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-sm whitespace-nowrap rounded-md transition-colors"
                >
                  <Wrench size={16} className="shrink-0" />
                  <span className="truncate">Em Andamento</span>
                  {motosEmAndamento.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-xs bg-accent/20 text-accent rounded-full">
                      {motosEmAndamento.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="concluidos"
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-sm whitespace-nowrap rounded-md transition-colors"
                >
                  <CheckCircle size={16} className="shrink-0" />
                  <span className="truncate">Concluídos</span>
                  {motosConcluidas.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-xs bg-green-600/20 text-green-600 rounded-full">
                      {motosConcluidas.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/*
                `forceMount` em ambos os TabsContent garante que os
                sentinels e seus IntersectionObservers existam desde o
                primeiro render — sem isso, o observer da aba inativa
                nunca seria criado (o `useInfiniteScroll` cria o
                observer uma única vez por mount). O Radix Tabs esconde
                o conteúdo inativo via `hidden`; o IntersectionObserver
                não dispara para sentinels fora do viewport.
              */}
              <TabsContent
                value="em-andamento"
                forceMount
                className="space-y-6 mt-6 data-[state=inactive]:hidden"
              >
                {/* Barra de busca */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40"
                    size={18}
                  />
                  <Input
                    placeholder="Buscar por modelo, placa, cliente ou serviço..."
                    value={buscaEmAndamento}
                    onChange={e => {
                      setBuscaEmAndamento(e.target.value);
                      // Delega ao hook (debounce 300ms server-side)
                      oficinaEmAndamento.setBusca(e.target.value);
                    }}
                    className="pl-10 bg-card border-foreground/10"
                    data-testid="oficina-em-andamento-busca"
                  />
                </div>

                {/* Contador discreto "Mostrando X de Y" abaixo do input */}
                {oficinaEmAndamento.motos.length > 0 && (
                  <p
                    className="font-sans text-xs text-foreground/40"
                    data-testid="oficina-em-andamento-contador"
                  >
                    Mostrando {oficinaEmAndamento.motos.length} de{" "}
                    {oficinaEmAndamento.total}
                  </p>
                )}

                {motosEmAndamento.length === 0 ? (
                  <Card className="card-samurai text-center py-12">
                    <p className="font-sans text-foreground/60">
                      {buscaEmAndamento
                        ? "Nenhuma moto encontrada"
                        : "Nenhuma moto em processamento"}
                    </p>
                  </Card>
                ) : (
                  motosEmAndamento.map(
                    (moto: MotoCompleta, index: number) =>
                      renderMotoCard(moto, index + 1)
                  )
                )}

                {/* Sentinel observado pelo useInfiniteScroll da aba */}
                {motosEmAndamento.length > 0 && (
                  <div
                    ref={sentinelEmAndamentoRef}
                    data-testid="oficina-em-andamento-sentinel"
                    className="pt-2 pb-6 flex flex-col items-center gap-1"
                  >
                    {!oficinaEmAndamento.hasMore && (
                      <p className="font-sans text-[11px] text-foreground/30">
                        Fim da lista
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="concluidos"
                forceMount
                className="space-y-6 mt-6 data-[state=inactive]:hidden"
              >
                {/* Barra de busca */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40"
                    size={18}
                  />
                  <Input
                    placeholder="Buscar por modelo, placa, cliente ou serviço..."
                    value={buscaConcluidos}
                    onChange={e => {
                      setBuscaConcluidos(e.target.value);
                      oficinaConcluidos.setBusca(e.target.value);
                    }}
                    className="pl-10 bg-card border-foreground/10"
                    data-testid="oficina-concluidos-busca"
                  />
                </div>

                {/* Contador discreto "Mostrando X de Y" abaixo do input */}
                {oficinaConcluidos.motos.length > 0 && (
                  <p
                    className="font-sans text-xs text-foreground/40"
                    data-testid="oficina-concluidos-contador"
                  >
                    Mostrando {oficinaConcluidos.motos.length} de{" "}
                    {oficinaConcluidos.total}
                  </p>
                )}

                {motosConcluidas.length === 0 ? (
                  <Card className="card-samurai text-center py-12">
                    <p className="font-sans text-foreground/60">
                      {buscaConcluidos
                        ? "Nenhuma moto encontrada"
                        : "Nenhum serviço concluído"}
                    </p>
                  </Card>
                ) : (
                  motosConcluidas.map((moto: MotoCompleta) =>
                    renderMotoCard(moto)
                  )
                )}

                {/* Sentinel observado pelo useInfiniteScroll da aba */}
                {motosConcluidas.length > 0 && (
                  <div
                    ref={sentinelConcluidosRef}
                    data-testid="oficina-concluidos-sentinel"
                    className="pt-2 pb-6 flex flex-col items-center gap-1"
                  >
                    {!oficinaConcluidos.hasMore && (
                      <p className="font-sans text-[11px] text-foreground/30">
                        Fim da lista
                      </p>
                    )}
                  </div>
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
              <h3 className="font-serif text-lg text-foreground">
                Adicionar Foto de Status
              </h3>
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
                  onChange={e => setArquivoFoto(e.target.files?.[0] || null)}
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
                  onChange={e =>
                    setProgressoFoto(
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Textarea
                  id="observacao"
                  value={observacaoFoto}
                  onChange={e => setObservacaoFoto(e.target.value)}
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

      {mostrarModalPagamento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="card-samurai max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg text-foreground">
                Forma de pagamento
              </h3>
              <button
                onClick={handleCancelarPagamento}
                className="text-foreground/40 hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {isEdicaoPagamento && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-widest">
                    Status do Pagamento
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={
                        statusPagamentoSelecionado === "pendente"
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setStatusPagamentoSelecionado("pendente")}
                      className={
                        statusPagamentoSelecionado === "pendente"
                          ? "bg-yellow-500 hover:bg-yellow-600"
                          : ""
                      }
                    >
                      ⏳ Pendente
                    </Button>
                    <Button
                      type="button"
                      variant={
                        statusPagamentoSelecionado === "pago"
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setStatusPagamentoSelecionado("pago")}
                      className={
                        statusPagamentoSelecionado === "pago"
                          ? "bg-green-500 hover:bg-green-600"
                          : ""
                      }
                    >
                      💰 Pago
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest">
                  Forma de Pagamento
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={
                      formaPagamentoSelecionada === "pix"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setFormaPagamentoSelecionada("pix")}
                  >
                    Pix
                  </Button>
                  <Button
                    type="button"
                    variant={
                      formaPagamentoSelecionada === "credito"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setFormaPagamentoSelecionada("credito")}
                  >
                    Crédito
                  </Button>
                  <Button
                    type="button"
                    variant={
                      formaPagamentoSelecionada === "debito"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setFormaPagamentoSelecionada("debito")}
                  >
                    Débito
                  </Button>
                  <Button
                    type="button"
                    variant={
                      formaPagamentoSelecionada === "boleto"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setFormaPagamentoSelecionada("boleto")}
                  >
                    Boleto
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCancelarPagamento}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarPagamento}
                  className="flex-1 bg-accent hover:brightness-110"
                  disabled={!formaPagamentoSelecionada}
                >
                  {isEdicaoPagamento ? "Salvar" : "Confirmar"}
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

function formatarFormaPagamento(forma: string | null | undefined): string {
  if (!forma) return "";
  const mapeamento: Record<string, string> = {
    pix: "Pix",
    credito: "Cartão Crédito",
    debito: "Cartão Débito",
    boleto: "Boleto",
  };
  return mapeamento[forma] || forma;
}
