import { useState, useMemo } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { OrcamentoCompleto } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  Phone,
  MapPin,
  Truck,
  Image as ImageIcon,
  Wrench,
  ClipboardList,
  Trash2,
  Settings,
  History,
  RefreshCw,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SupabaseOrcamentoRepository } from "@/infrastructure/repositories/SupabaseOrcamentoRepository";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { SupabaseTipoServicoRepository } from "@/infrastructure/repositories/SupabaseTipoServicoRepository";
import { SupabaseServicoPersonalizadoRepository } from "@/infrastructure/repositories/SupabaseServicoPersonalizadoRepository";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { ConverterOrcamentoEntradaUseCase } from "@/domain/usecases/ConverterOrcamentoEntradaUseCase";
import { useGerarOS } from "@/hooks/useGerarOS";
import { PrepararDadosOrcamentoParaOSUseCase } from "@/domain/usecases/PrepararDadosOrcamentoParaOSUseCase";
import { useDeletarOrcamento } from "@/hooks/useDeletarOrcamento";
import { useLocation } from "wouter";
import { HistoryModal } from "@/components/HistoryModal";

type FilterType = "ativos" | "expirados";

// Helper para verificar se o orçamento é retirada
const isRetirada = (frete: number | null | undefined): boolean => {
  return frete === null || frete === undefined || frete === 0;
};

export default function Orcamentos() {
  const [filtro, setFiltro] = useState<FilterType>("ativos");
  const [, setLocation] = useLocation();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<string | null>(
    null
  );

  const orcamentoRepo = useMemo(() => new SupabaseOrcamentoRepository(), []);
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const fotoRepo = useMemo(() => new SupabaseFotoRepository(), []);
  const tipoServicoRepo = useMemo(
    () => new SupabaseTipoServicoRepository(),
    []
  );
  const servicoPersonalizadoRepo = useMemo(
    () => new SupabaseServicoPersonalizadoRepository(),
    []
  );
  const storageApi = useMemo(() => new SupabaseStorageApi(), []);

  // Converte filtro UI para status do banco
  const statusBanco = filtro === "ativos" ? "ativo" : "expirado";
  const { orcamentos, loading, error, recarregar, removerOrcamento } =
    useOrcamentos(
      orcamentoRepo,
      statusBanco,
      tipoServicoRepo,
      servicoPersonalizadoRepo
    );

  const converterOrcamentoEntradaUseCase = useMemo(
    () => new ConverterOrcamentoEntradaUseCase(orcamentoRepo, entradaRepo),
    [orcamentoRepo, entradaRepo]
  );

  const prepararDadosOSUseCase = useMemo(
    () =>
      new PrepararDadosOrcamentoParaOSUseCase(
        orcamentoRepo,
        entradaRepo,
        clienteRepo,
        motoRepo,
        fotoRepo,
        tipoServicoRepo,
        servicoPersonalizadoRepo
      ),
    [
      orcamentoRepo,
      entradaRepo,
      clienteRepo,
      motoRepo,
      fotoRepo,
      tipoServicoRepo,
      servicoPersonalizadoRepo,
    ]
  );

  const { gerar: gerarOS, loading: loadingOS } = useGerarOS(
    entradaRepo,
    clienteRepo,
    motoRepo,
    fotoRepo,
    tipoServicoRepo,
    servicoPersonalizadoRepo,
    storageApi
  );

  const { deletar: deletarOrcamento, loading: loadingDeletar } =
    useDeletarOrcamento(orcamentoRepo);

  const calcularDiasRestantes = (data: Date): number => {
    const agora = new Date();
    const diferenca = data.getTime() - agora.getTime();
    return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
  };

  const handleConverterEntrada = async (orcamentoId: string) => {
    try {
      await converterOrcamentoEntradaUseCase.execute(orcamentoId);
      removerOrcamento(orcamentoId);
      toast.success("Orçamento convertido em entrada!");
    } catch (err) {
      const mensagem =
        err instanceof Error ? err.message : "Erro ao converter orçamento";
      toast.error(mensagem);
    }
  };

  const handleGerarOS = async (orcamentoId: string) => {
    try {
      // Busca entradaId do orçamento
      const orcamento = await orcamentoRepo.buscarPorId(orcamentoId);
      if (!orcamento) {
        toast.error("Orçamento não encontrado");
        return;
      }

      // Gera o PDF da OS
      await gerarOS(orcamento.entradaId);
      toast.success("Ordem de Serviço gerada com sucesso!");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao gerar OS";
      toast.error(mensagem);
    }
  };

  const handlePreencherFormulario = async (orcamentoId: string) => {
    try {
      // Prepara dados do orçamento para preencher o formulário
      const dadosCadastro = await prepararDadosOSUseCase.execute(orcamentoId);

      // Salva os dados no sessionStorage para a página de Cadastro acessar
      sessionStorage.setItem(
        "dadosOrcamentoParaOS",
        JSON.stringify(dadosCadastro)
      );

      // Navega para a página de Cadastro
      setLocation("/");
      toast.success(
        "Dados do orçamento carregados! Preencha os campos restantes."
      );
    } catch (err) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Erro ao preparar dados do orçamento";
      toast.error(mensagem);
    }
  };

  const handleDeletarOrcamento = async (orcamentoId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }

    const sucesso = await deletarOrcamento(orcamentoId);
    if (sucesso) {
      toast.success("Orçamento excluído com sucesso!");
      removerOrcamento(orcamentoId);
      recarregar();
    } else {
      toast.error("Erro ao excluir orçamento");
    }
  };

  const handleOpenHistory = (orcamentoId: string) => {
    setSelectedOrcamentoId(orcamentoId);
    setHistoryModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background admin-background">
      <Header title="Orçamentos" />

      <main className="pt-20 pb-32 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Filtros */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setFiltro("ativos")}
              className={`px-6 py-2 rounded-full font-sans font-semibold text-sm transition-all ${
                filtro === "ativos"
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "bg-card border border-foreground/10 text-foreground/60 hover:text-foreground"
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setFiltro("expirados")}
              className={`px-6 py-2 rounded-full font-sans font-semibold text-sm transition-all ${
                filtro === "expirados"
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "bg-card border border-foreground/10 text-foreground/60 hover:text-foreground"
              }`}
            >
              Expirados
            </button>
          </div>

          {/* Lista de Orçamentos */}
          <div className="space-y-4">
            {loading ? (
              <Card className="card-samurai text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
                <p className="font-sans text-foreground/60">
                  Carregando orçamentos...
                </p>
              </Card>
            ) : error ? (
              <Card className="card-samurai text-center py-12">
                <p className="font-sans text-red-500">{error}</p>
              </Card>
            ) : orcamentos.length === 0 ? (
              <Card className="card-samurai text-center py-12">
                <p className="font-sans text-foreground/60">
                  Nenhum orçamento {filtro === "ativos" ? "ativo" : "expirado"}
                </p>
              </Card>
            ) : (
              orcamentos.map(orcamento => {
                const diasRestantes = calcularDiasRestantes(
                  orcamento.dataExpiracao
                );
                const estaProximoDeExpirar =
                  diasRestantes < 3 && diasRestantes >= 0;
                const estaExpirado = diasRestantes < 0;

                return (
                  <Card
                    key={orcamento.id}
                    className="card-samurai hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    <div className="flex gap-3 sm:gap-4">
                      {/* Foto da Moto */}
                      {orcamento.fotoMoto ? (
                        <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-foreground/10 bg-foreground/5">
                          <img
                            src={orcamento.fotoMoto}
                            alt={orcamento.moto}
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg border border-foreground/10 bg-foreground/5 flex items-center justify-center">
                          <ImageIcon size={28} className="text-foreground/20" />
                        </div>
                      )}

                      {/* Informações Principais */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Header: Nome, Valor e Ações */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-serif text-base sm:text-lg text-foreground truncate">
                                {orcamento.moto}
                              </h3>
                              <button
                                onClick={() =>
                                  handleDeletarOrcamento(orcamento.id)
                                }
                                disabled={loadingDeletar}
                                className="text-foreground/40 hover:text-red-600 transition-colors p-1 shrink-0"
                                title="Excluir orçamento"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <p className="font-sans text-xs sm:text-sm text-foreground/60 truncate">
                              {orcamento.cliente || "Cliente não informado"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-serif text-xl sm:text-2xl text-accent">
                              R${" "}
                              {(
                                orcamento.valor +
                                (isRetirada(orcamento.frete)
                                  ? 0
                                  : orcamento.frete || 0)
                              ).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Informações Essenciais (Mobile) */}
                        <div className="space-y-1">
                          {(orcamento.marca ||
                            orcamento.ano ||
                            orcamento.cilindrada) && (
                            <p className="font-sans text-[11px] text-foreground/50">
                              {[
                                orcamento.marca,
                                orcamento.ano,
                                orcamento.cilindrada,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          )}
                          {/* Placa / Final do Quadro */}
                          {(orcamento.placa || orcamento.finalNumeroQuadro) && (
                            <div className="flex items-center gap-2 text-xs text-foreground/60">
                              {orcamento.placa && (
                                <span className="font-mono bg-foreground/5 px-2 py-0.5 rounded">
                                  {orcamento.placa}
                                </span>
                              )}
                              {orcamento.finalNumeroQuadro && (
                                <span className="text-foreground/40">
                                  Final: {orcamento.finalNumeroQuadro}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Telefone e Endereço - Mobile Compacto */}
                          <div className="flex items-center gap-3 text-xs text-foreground/60">
                            {orcamento.telefone && (
                              <div className="flex items-center gap-1">
                                <Phone size={12} />
                                <span className="truncate max-w-24">
                                  {orcamento.telefone}
                                </span>
                              </div>
                            )}
                            {orcamento.endereco && (
                              <div className="flex items-center gap-1 truncate">
                                <MapPin size={12} />
                                <span className="truncate max-w-32">
                                  {orcamento.endereco}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Serviços - Compacto */}
                          <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                            <Wrench size={12} />
                            <span>
                              Serviços: R$ {orcamento.valor.toFixed(2)}
                            </span>
                            {isRetirada(orcamento.frete) ? (
                              <span className="text-foreground/40 flex items-center gap-1">
                                • <Store size={10} /> Retirada
                              </span>
                            ) : (
                              <span className="text-foreground/40">
                                • Frete: R$ {(orcamento.frete || 0).toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Tipos de Serviço - Compacto */}
                          {(orcamento.tiposServico?.length || 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(orcamento.tiposServico || [])
                                .slice(0, 2)
                                .map(tipo => (
                                  <Badge
                                    key={tipo.id}
                                    variant="secondary"
                                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5"
                                  >
                                    <Wrench size={8} />
                                    {tipo.nome}
                                    {tipo.quantidade > 1 &&
                                      ` (${tipo.quantidade}x)`}
                                  </Badge>
                                ))}
                              {(orcamento.tiposServico?.length || 0) > 2 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0.5"
                                >
                                  +{(orcamento.tiposServico?.length || 0) - 2}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Serviços Personalizados - Compacto */}
                          {(orcamento.servicosPersonalizados?.length || 0) >
                            0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(orcamento.servicosPersonalizados || [])
                                .slice(0, 2)
                                .map(servico => (
                                  <Badge
                                    key={servico.id}
                                    variant="outline"
                                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 border-accent/30"
                                  >
                                    <Settings size={8} />
                                    {servico.nome}
                                    {servico.quantidade > 1 &&
                                      ` (${servico.quantidade}x)`}
                                  </Badge>
                                ))}
                              {(orcamento.servicosPersonalizados?.length || 0) >
                                2 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0.5 border-accent/30"
                                >
                                  +
                                  {(orcamento.servicosPersonalizados?.length ||
                                    0) - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Descrição - Mobile Apenas se curta */}
                        {orcamento.descricao &&
                          orcamento.descricao.length < 60 && (
                            <p className="font-sans text-xs text-foreground/40 line-clamp-1">
                              {orcamento.descricao}
                            </p>
                          )}

                        {/* Botão Histórico - Mobile */}
                        <button
                          onClick={() => handleOpenHistory(orcamento.id)}
                          className="text-xs text-foreground/40 hover:text-accent transition-colors flex items-center gap-1"
                        >
                          <History size={12} />
                          Ver histórico
                        </button>
                      </div>
                    </div>

                    {/* Contagem Regressiva */}
                    <div
                      className={`flex items-center gap-2 mb-4 p-3 rounded-sm ${
                        estaProximoDeExpirar || estaExpirado
                          ? "bg-accent/10"
                          : "bg-foreground/5"
                      }`}
                    >
                      <Clock
                        size={18}
                        className={
                          estaProximoDeExpirar || estaExpirado
                            ? "text-accent"
                            : "text-foreground/40"
                        }
                      />
                      <span
                        className={`font-sans text-sm ${
                          estaProximoDeExpirar || estaExpirado
                            ? "text-accent font-semibold"
                            : "text-foreground/60"
                        }`}
                      >
                        {estaExpirado
                          ? "Expirado há " +
                            Math.abs(diasRestantes) +
                            " dia" +
                            (Math.abs(diasRestantes) !== 1 ? "s" : "")
                          : "Expira em " +
                            diasRestantes +
                            " dia" +
                            (diasRestantes !== 1 ? "s" : "")}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="space-y-2 w-full">
                      {orcamento.status === "ativo" && (
                        <>
                          <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <Button
                              onClick={() =>
                                handleConverterEntrada(orcamento.id)
                              }
                              variant="outline"
                              className="w-full sm:flex-1 text-sm py-2 h-auto min-h-10"
                            >
                              <CheckCircle2
                                size={16}
                                className="mr-2 shrink-0"
                              />
                              <span className="truncate">
                                Converter em Entrada
                              </span>
                            </Button>
                            <Button
                              onClick={() =>
                                handlePreencherFormulario(orcamento.id)
                              }
                              variant="outline"
                              className="w-full sm:flex-1 text-sm py-2 h-auto min-h-10"
                            >
                              <ClipboardList
                                size={16}
                                className="mr-2 shrink-0"
                              />
                              <span className="truncate">
                                Preencher Formulário
                              </span>
                            </Button>
                          </div>
                          <Button
                            onClick={() => handleGerarOS(orcamento.id)}
                            variant="default"
                            className="w-full text-sm bg-accent hover:brightness-110 py-2 h-auto min-h-10"
                            disabled={loadingOS}
                          >
                            <FileText size={16} className="mr-2 shrink-0" />
                            <span className="truncate">
                              {loadingOS ? "Gerando..." : "Gerar OS"}
                            </span>
                          </Button>
                        </>
                      )}
                      {orcamento.status === "expirado" && (
                        <Button
                          onClick={() => handleConverterEntrada(orcamento.id)}
                          variant="outline"
                          className="w-full text-sm py-2 h-auto min-h-10"
                        >
                          <RefreshCw size={16} className="mr-2 shrink-0" />
                          <span className="truncate">Reativar Orçamento</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>

      <BottomNav active="orcamentos" />

      {selectedOrcamentoId && (
        <HistoryModal
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setSelectedOrcamentoId(null);
          }}
          entidadeId={selectedOrcamentoId}
          entidadeTipo="orcamento"
        />
      )}
    </div>
  );
}
