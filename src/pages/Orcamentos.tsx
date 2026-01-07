import { useState, useMemo } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { OrcamentoCompleto } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, Loader2, Phone, MapPin, Truck, Image as ImageIcon, Wrench, ClipboardList, Trash2, Settings, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SupabaseOrcamentoRepository } from "@/infrastructure/repositories/SupabaseOrcamentoRepository";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { SupabaseTipoServicoRepository } from "@/infrastructure/repositories/SupabaseTipoServicoRepository";
import { SupabaseServicoPersonalizadoRepository } from "@/infrastructure/repositories/SupabaseServicoPersonalizadoRepository";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { ConverterOrcamentoEntradaUseCase } from "@/domain/usecases/ConverterOrcamentoEntradaUseCase";
import { useGerarOS } from "@/hooks/useGerarOS";
import { PrepararDadosOrcamentoParaOSUseCase } from "@/domain/usecases/PrepararDadosOrcamentoParaOSUseCase";
import { useDeletarOrcamento } from "@/hooks/useDeletarOrcamento";
import { useLocation } from "wouter";
import { HistoryModal } from "@/components/HistoryModal";

type FilterType = "ativos" | "expirados";

export default function Orcamentos() {
  const [filtro, setFiltro] = useState<FilterType>("ativos");
  const [, setLocation] = useLocation();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<string | null>(null);

  const orcamentoRepo = useMemo(() => new SupabaseOrcamentoRepository(), []);
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const fotoRepo = useMemo(() => new SupabaseFotoRepository(), []);
  const tipoServicoRepo = useMemo(() => new SupabaseTipoServicoRepository(), []);
  const servicoPersonalizadoRepo = useMemo(() => new SupabaseServicoPersonalizadoRepository(), []);

  // Converte filtro UI para status do banco
  const statusBanco = filtro === "ativos" ? "ativo" : "expirado";
  const { orcamentos, loading, error, recarregar, removerOrcamento } = useOrcamentos(orcamentoRepo, statusBanco, tipoServicoRepo, servicoPersonalizadoRepo);

  const converterOrcamentoEntradaUseCase = useMemo(
    () => new ConverterOrcamentoEntradaUseCase(orcamentoRepo, entradaRepo),
    [orcamentoRepo, entradaRepo]
  );

  const prepararDadosOSUseCase = useMemo(
    () => new PrepararDadosOrcamentoParaOSUseCase(
      orcamentoRepo,
      entradaRepo,
      clienteRepo,
      motoRepo,
      fotoRepo,
      tipoServicoRepo
    ),
    [orcamentoRepo, entradaRepo, clienteRepo, motoRepo, fotoRepo, tipoServicoRepo]
  );

  const { gerar: gerarOS, loading: loadingOS } = useGerarOS(
    entradaRepo,
    clienteRepo,
    motoRepo,
    fotoRepo,
    tipoServicoRepo
  );

  const { deletar: deletarOrcamento, loading: loadingDeletar } = useDeletarOrcamento(orcamentoRepo);

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
      const mensagem = err instanceof Error ? err.message : "Erro ao converter orçamento";
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
      sessionStorage.setItem("dadosOrcamentoParaOS", JSON.stringify(dadosCadastro));

      // Navega para a página de Cadastro
      setLocation("/");
      toast.success("Dados do orçamento carregados! Preencha os campos restantes.");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao preparar dados do orçamento";
      toast.error(mensagem);
    }
  };

  const handleDeletarOrcamento = async (orcamentoId: string) => {
    if (!confirm("Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.")) {
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
              className={`px-6 py-2 rounded-full font-sans font-semibold text-sm transition-all ${filtro === "ativos"
                ? "bg-accent text-white shadow-lg shadow-accent/20"
                : "bg-card border border-foreground/10 text-foreground/60 hover:text-foreground"
                }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setFiltro("expirados")}
              className={`px-6 py-2 rounded-full font-sans font-semibold text-sm transition-all ${filtro === "expirados"
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
                <p className="font-sans text-foreground/60">Carregando orçamentos...</p>
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
              orcamentos.map((orcamento) => {
                const diasRestantes = calcularDiasRestantes(
                  orcamento.dataExpiracao
                );
                const estaProximoDeExpirar = diasRestantes < 3 && diasRestantes >= 0;
                const estaExpirado = diasRestantes < 0;

                return (
                  <Card
                    key={orcamento.id}
                    className="card-samurai hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    <div className="flex gap-4">
                      {/* Foto da Moto */}
                      {orcamento.fotoMoto ? (
                        <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-foreground/10 bg-foreground/5">
                          <img
                            src={orcamento.fotoMoto}
                            alt={orcamento.moto}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Se a imagem falhar, esconde o container
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-24 h-24 rounded-lg border border-foreground/10 bg-foreground/5 flex items-center justify-center">
                          <ImageIcon size={32} className="text-foreground/20" />
                        </div>
                      )}

                      {/* Informações Principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <h3 className="font-serif text-lg text-foreground truncate">
                                {orcamento.moto}
                              </h3>
                              <button
                                onClick={() => handleDeletarOrcamento(orcamento.id)}
                                disabled={loadingDeletar}
                                className="text-foreground/40 hover:text-red-600 transition-colors p-1 flex-shrink-0"
                                title="Excluir orçamento"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                            <div className="flex justify-between items-center">
                              <p className="font-sans text-sm text-foreground/60 truncate">
                                {orcamento.cliente || "Cliente não informado"}
                              </p>
                              <button
                                onClick={() => handleOpenHistory(orcamento.id)}
                                className="text-foreground/40 hover:text-accent transition-colors p-1"
                                title="Ver histórico"
                              >
                                <History size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="text-right ml-2 flex-shrink-0">
                            <p className="font-serif text-2xl text-accent">
                              R$ {(orcamento.valor + (orcamento.frete || 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Informações Adicionais */}
                        <div className="space-y-1.5 mb-3">
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

                          {/* Telefone */}
                          {orcamento.telefone && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                              <Phone size={12} />
                              <span>{orcamento.telefone}</span>
                            </div>
                          )}

                          {/* Endereço */}
                          {orcamento.endereco && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                              <MapPin size={12} />
                              <span className="truncate">{orcamento.endereco}</span>
                              {orcamento.cep && (
                                <span className="text-foreground/40">({orcamento.cep})</span>
                              )}
                            </div>
                          )}

                          {/* Detalhes do Valor */}
                        <div className="space-y-1.5 mb-3">
                          {/* Valor dos Serviços */}
                          <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                            <Wrench size={12} />
                            <span>Serviços: R$ {orcamento.valor.toFixed(2)}</span>
                          </div>

                          {/* Frete */}
                          {orcamento.frete > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                              <Truck size={12} />
                              <span>Frete: R$ {orcamento.frete.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                          {/* Descrição */}
                          {orcamento.descricao && (
                            <p className="font-sans text-xs text-foreground/40 line-clamp-2">
                              {orcamento.descricao}
                            </p>
                          )}

                          {/* Tipos de Serviço */}
                          {orcamento.tiposServico && orcamento.tiposServico.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {orcamento.tiposServico.map((tipo) => (
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
                          {orcamento.servicosPersonalizados && orcamento.servicosPersonalizados.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {orcamento.servicosPersonalizados.map((servico) => (
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
                    </div>

                    {/* Contagem Regressiva */}
                    <div
                      className={`flex items-center gap-2 mb-4 p-3 rounded-sm ${estaProximoDeExpirar || estaExpirado
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
                        className={`font-sans text-sm ${estaProximoDeExpirar || estaExpirado
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
                    <div className="flex flex-col gap-2">
                      {orcamento.status === "ativo" && (
                        <>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleConverterEntrada(orcamento.id)}
                              variant="outline"
                              className="flex-1 text-sm"
                            >
                              <CheckCircle2 size={16} className="mr-2" />
                              Converter em Entrada
                            </Button>
                            <Button
                              onClick={() => handlePreencherFormulario(orcamento.id)}
                              variant="outline"
                              className="flex-1 text-sm"
                            >
                              <ClipboardList size={16} className="mr-2" />
                              Preencher Formulário
                            </Button>
                          </div>
                          <Button
                            onClick={() => handleGerarOS(orcamento.id)}
                            variant="default"
                            className="w-full text-sm bg-accent hover:brightness-110"
                            disabled={loadingOS}
                          >
                            <FileText size={16} className="mr-2" />
                            {loadingOS ? "Gerando..." : "Gerar OS"}
                          </Button>
                        </>
                      )}
                      {orcamento.status === "expirado" && (
                        <Button
                          onClick={() => handleConverterEntrada(orcamento.id)}
                          variant="outline"
                          className="w-full text-sm"
                        >
                          Reativar Orçamento
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
