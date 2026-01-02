import { useState, useMemo } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { OrcamentoCompleto } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SupabaseOrcamentoRepository } from "@/infrastructure/repositories/SupabaseOrcamentoRepository";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { AtualizarOrcamentoUseCase } from "@/domain/usecases/AtualizarOrcamentoUseCase";
import { useGerarOS } from "@/hooks/useGerarOS";

type FilterType = "ativos" | "expirados";

export default function Orcamentos() {
  const [filtro, setFiltro] = useState<FilterType>("ativos");
  
  const orcamentoRepo = useMemo(() => new SupabaseOrcamentoRepository(), []);
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const fotoRepo = useMemo(() => new SupabaseFotoRepository(), []);
  
  // Converte filtro UI para status do banco
  const statusBanco = filtro === "ativos" ? "ativo" : "expirado";
  const { orcamentos, loading, error, recarregar } = useOrcamentos(orcamentoRepo, statusBanco);
  
  const atualizarOrcamentoUseCase = useMemo(
    () => new AtualizarOrcamentoUseCase(orcamentoRepo),
    [orcamentoRepo]
  );

  const { gerar: gerarOS, loading: loadingOS } = useGerarOS(
    entradaRepo,
    clienteRepo,
    motoRepo,
    fotoRepo
  );

  const calcularDiasRestantes = (data: Date): number => {
    const agora = new Date();
    const diferenca = data.getTime() - agora.getTime();
    return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
  };

  const handleConverterEntrada = async (orcamentoId: string) => {
    try {
      await atualizarOrcamentoUseCase.execute(orcamentoId, "convertido");
      toast.success("Orçamento convertido em entrada!");
      recarregar();
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

      await gerarOS(orcamento.entradaId);
      toast.success("Ordem de Serviço gerada com sucesso!");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao gerar OS";
      toast.error(mensagem);
    }
  };

  return (
    <div className="min-h-screen bg-background">
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
                    className="card-samurai hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="font-serif text-lg text-foreground">
                          {orcamento.moto}
                        </h3>
                        <p className="font-sans text-sm text-foreground/60">
                          {orcamento.cliente || "Cliente não informado"}
                        </p>
                        {orcamento.descricao && (
                          <p className="font-sans text-xs text-foreground/40 mt-1">
                            {orcamento.descricao}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-serif text-2xl text-accent">
                          R$ {orcamento.valor.toFixed(2)}
                        </p>
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
                    <div className="flex gap-2">
                      {orcamento.status === "ativo" && (
                        <>
                          <Button
                            onClick={() => handleConverterEntrada(orcamento.id)}
                            variant="outline"
                            className="flex-1 text-sm"
                          >
                            <CheckCircle2 size={16} className="mr-2" />
                            Converter em Entrada
                          </Button>
                          <Button
                            onClick={() => handleGerarOS(orcamento.id)}
                            variant="default"
                            className="flex-1 text-sm bg-accent hover:brightness-110"
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
    </div>
  );
}
