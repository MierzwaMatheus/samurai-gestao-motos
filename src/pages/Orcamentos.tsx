import { useState } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Orcamento } from "@/../../shared/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// Mock data
const ORCAMENTOS_MOCK: Orcamento[] = [
  {
    id: "1",
    cliente: "João Silva",
    moto: "Honda CB 500X",
    valor: 450.0,
    descricao: "Alinhamento completo com balanceamento",
    dataExpiracao: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 dias
    status: "ativo",
    criadoEm: new Date(),
  },
  {
    id: "2",
    cliente: "Maria Santos",
    moto: "Yamaha MT-07",
    valor: 350.0,
    descricao: "Alinhamento dianteiro",
    dataExpiracao: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 dias
    status: "ativo",
    criadoEm: new Date(),
  },
  {
    id: "3",
    cliente: "Pedro Costa",
    moto: "Kawasaki Ninja 400",
    valor: 300.0,
    descricao: "Alinhamento e balanceamento",
    dataExpiracao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
    status: "expirado",
    criadoEm: new Date(),
  },
];

type FilterType = "ativos" | "expirados";

export default function Orcamentos() {
  const [filtro, setFiltro] = useState<FilterType>("ativos");
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(ORCAMENTOS_MOCK);

  const orcamentosFiltrados = orcamentos.filter((o) => {
    if (filtro === "ativos") return o.status === "ativo";
    if (filtro === "expirados") return o.status === "expirado";
    return true;
  });

  const calcularDiasRestantes = (data: Date): number => {
    const agora = new Date();
    const diferenca = data.getTime() - agora.getTime();
    return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
  };

  const handleConverterEntrada = (orcamentoId: string) => {
    toast.success("Orçamento convertido em entrada!");
    setOrcamentos((prev) =>
      prev.map((o) =>
        o.id === orcamentoId ? { ...o, status: "convertido" as const } : o
      )
    );
  };

  const handleGerarOS = (orcamentoId: string) => {
    toast.success("Ordem de Serviço gerada com sucesso!");
    // Implementar geração de PDF
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
            {orcamentosFiltrados.length === 0 ? (
              <Card className="card-samurai text-center py-12">
                <p className="font-sans text-foreground/60">
                  Nenhum orçamento {filtro === "ativos" ? "ativo" : "expirado"}
                </p>
              </Card>
            ) : (
              orcamentosFiltrados.map((orcamento) => {
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
                          {orcamento.cliente}
                        </p>
                        <p className="font-sans text-xs text-foreground/40 mt-1">
                          {orcamento.descricao}
                        </p>
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
                          >
                            <FileText size={16} className="mr-2" />
                            Gerar OS
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
