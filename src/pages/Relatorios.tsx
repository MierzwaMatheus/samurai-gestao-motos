import React from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Users,
  Wrench,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useFaturamentoMensal,
  useTopClientes,
  useServicosMaisRealizados,
  useStatusEntradas,
  useStatusEntrega,
  useDistribuicaoCategoria,
  useMetricasPerformance,
  useConversaoOrcamentos,
  useResumoDiario,
} from "@/hooks/useRelatorios";
import { useRelatorioExcel, exportToExcel } from "@/hooks/useRelatorioExcel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FiltrosRelatorio } from "@/domain/interfaces/relatorios";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export function Relatorios() {
  const [periodo, setPeriodo] =
    React.useState<FiltrosRelatorio["periodo"]>("12m");

  const { data: faturamentoMensal, isLoading: loadingFaturamento } =
    useFaturamentoMensal(periodo);
  const { data: topClientes, isLoading: loadingClientes } = useTopClientes(10);
  const { data: servicosMaisRealizados, isLoading: loadingServicos } =
    useServicosMaisRealizados();
  const { data: statusEntradas, isLoading: loadingStatus } =
    useStatusEntradas();
  const { data: statusEntrega, isLoading: loadingEntrega } = useStatusEntrega();
  const { data: distribuicaoCategoria, isLoading: loadingCategoria } =
    useDistribuicaoCategoria();
  const { data: metricas, isLoading: loadingMetricas } =
    useMetricasPerformance();
  const { data: conversaoOrcamentos, isLoading: loadingConversao } =
    useConversaoOrcamentos(periodo);
  const { data: resumoDiario, isLoading: loadingResumo } =
    useResumoDiario(periodo);

  const {
    data: dadosExcel,
    isLoading: loadingExcel,
    fetchRelatorio,
  } = useRelatorioExcel();
  const [dataInicio, setDataInicio] = React.useState("");
  const [dataFim, setDataFim] = React.useState("");

  const handleExportExcel = () => {
    if (dadosExcel && dadosExcel.length > 0) {
      exportToExcel(dadosExcel, "relatorio_servicos");
    }
  };

  const handleLoadRelatorio = () => {
    const inicio = dataInicio ? new Date(dataInicio) : undefined;
    const fim = dataFim ? new Date(dataFim) : undefined;
    fetchRelatorio(inicio, fim);
  };

  const formatarMoeda = (valor: number | null | undefined) => {
    if (valor === null || valor === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
  };

  const dadosFaturamentoChart = Array.isArray(faturamentoMensal)
    ? faturamentoMensal
        .slice()
        .reverse()
        .map((d: any) => ({
          ...d,
          mesFormatado: formatarData(d.mes),
        }))
    : [];

  const dadosConversaoChart = Array.isArray(conversaoOrcamentos)
    ? conversaoOrcamentos
        .slice()
        .reverse()
        .map((d: any) => ({
          ...d,
          mesFormatado: formatarData(d.mes),
        }))
    : [];

  const dadosResumoChart = Array.isArray(resumoDiario)
    ? resumoDiario
        .slice()
        .reverse()
        .slice(0, 30)
        .map((d: any) => ({
          ...d,
          dataFormatada: new Date(d.data).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          }),
        }))
    : [];

  if (loadingMetricas) {
    return (
      <div className="flex items-center justify-center h-screen">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Relatórios" />
      <div className="container mx-auto p-6 space-y-6 pb-24 pt-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Relatórios e Métricas
            </h1>
            <p className="text-muted-foreground">
              Acompanhe o desempenho do seu negócio
            </p>
          </div>
          <Select
            value={periodo}
            onValueChange={(v: FiltrosRelatorio["periodo"]) => setPeriodo(v)}
          >
            <SelectTrigger className="w-[180px] hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="tudo">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Faturamento Total"
            value={formatarMoeda(
              metricas &&
                typeof metricas === "object" &&
                !Array.isArray(metricas)
                ? metricas.faturamento_total
                : null
            )}
            icon={<DollarSign className="h-4 w-4" />}
            description="Total de serviços concluídos"
            trend="+12.5%"
          />
          <MetricCard
            title="Total de Entradas"
            value={
              metricas &&
              typeof metricas === "object" &&
              !Array.isArray(metricas)
                ? metricas.total_entradas?.toString()
                : "0"
            }
            icon={<Package className="h-4 w-4" />}
            description="Ordens de serviço"
            trend="+8.2%"
          />
          <MetricCard
            title="Clientes Únicos"
            value={
              metricas &&
              typeof metricas === "object" &&
              !Array.isArray(metricas)
                ? metricas.clientes_unicos?.toString()
                : "0"
            }
            icon={<Users className="h-4 w-4" />}
            description="Base de clientes"
            trend="+5.1%"
          />
          <MetricCard
            title="Ticket Médio"
            value={formatarMoeda(
              metricas &&
                typeof metricas === "object" &&
                !Array.isArray(metricas)
                ? metricas.ticket_medio_geral
                : null
            )}
            icon={<TrendingUp className="h-4 w-4" />}
            description="Valor médio por serviço"
            trend="+3.8%"
          />
        </div>

        <Tabs defaultValue="faturamento" className="space-y-4">
          <TabsList>
            <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="excel">Exportar Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="faturamento" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Faturamento Mensal</CardTitle>
                  <CardDescription>
                    Evolução do faturamento por mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dadosFaturamentoChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mesFormatado" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => formatarMoeda(value)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="faturamento_total"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Faturamento"
                      />
                      <Line
                        type="monotone"
                        dataKey="total_frete"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Frete (excl. retiradas)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resumo Diário</CardTitle>
                  <CardDescription>
                    Atividade dos últimos 30 dias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dadosResumoChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dataFormatada" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="novas_entradas"
                        fill="#3b82f6"
                        name="Novas Entradas"
                      />
                      <Bar
                        dataKey="concluidos"
                        fill="#10b981"
                        name="Concluídos"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="servicos" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Serviços Mais Realizados</CardTitle>
                  <CardDescription>
                    Top 15 serviços por quantidade
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {Array.isArray(servicosMaisRealizados) &&
                      servicosMaisRealizados.length > 0 ? (
                        servicosMaisRealizados.map(
                          (servico: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant="outline"
                                    className="w-6 h-6 flex items-center justify-center p-0"
                                  >
                                    {index + 1}
                                  </Badge>
                                  <span className="font-medium">
                                    {servico.servico}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      servico.categoria === "alinhamento"
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {servico.categoria || "padrao"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {servico.entradas_diferentes || 0}{" "}
                                    entrada(s)
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-lg">
                                  {servico.total_execucoes || 0}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  execuções
                                </div>
                              </div>
                            </div>
                          )
                        )
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          Nenhum serviço realizado ainda
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Categoria</CardTitle>
                  <CardDescription>
                    Faturamento por categoria de serviço
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={
                          Array.isArray(distribuicaoCategoria)
                            ? distribuicaoCategoria
                            : []
                        }
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ categoria, percentual }) => {
                          const p =
                            typeof percentual === "number"
                              ? percentual
                              : parseFloat(percentual || "0");
                          return `${categoria}: ${p.toFixed(0)}%`;
                        }}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="faturamento_categoria"
                      >
                        {Array.isArray(distribuicaoCategoria)
                          ? distribuicaoCategoria.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))
                          : null}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatarMoeda(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {Array.isArray(distribuicaoCategoria) &&
                      distribuicaoCategoria.map((cat: any) => (
                        <div
                          key={cat.categoria}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor:
                                  COLORS[
                                    distribuicaoCategoria.indexOf(cat) %
                                      COLORS.length
                                  ],
                              }}
                            />
                            <span className="capitalize">{cat.categoria}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">
                              {formatarMoeda(cat.faturamento_categoria)}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              (
                              {typeof cat.percentual === "number"
                                ? cat.percentual.toFixed(1)
                                : parseFloat(cat.percentual || "0").toFixed(1)}
                              %)
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clientes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Clientes por Faturamento</CardTitle>
                <CardDescription>
                  Clientes que mais geraram receita
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(topClientes) &&
                    topClientes.map((cliente: any, index: number) => (
                      <div
                        key={cliente.cliente_id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                            <span className="font-bold text-primary">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">
                              {cliente.cliente_nome}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {cliente.total_entradas} serviços •{" "}
                              {cliente.numero_servicos} no cadastro
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            {formatarMoeda(cliente.faturamento_total)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ticket médio: {formatarMoeda(cliente.ticket_medio)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Status das Entradas</CardTitle>
                  <CardDescription>
                    Distribuição por status atual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={
                          Array.isArray(statusEntradas) ? statusEntradas : []
                        }
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ status, percentual }) =>
                          `${status}: ${percentual.toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="quantidade"
                      >
                        {Array.isArray(statusEntradas)
                          ? statusEntradas.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))
                          : null}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {Array.isArray(statusEntradas) &&
                      statusEntradas.map((status: any) => (
                        <div
                          key={status.status}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {getStatusIcon(status.status)}
                            <span className="capitalize">{status.status}</span>
                          </div>
                          <span className="font-medium">
                            {status.quantidade} ({status.percentual}%)
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status de Entrega</CardTitle>
                  <CardDescription>Situação das entregas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Array.isArray(statusEntrega) ? statusEntrega : []}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="status_entrega"
                        type="category"
                        width={100}
                      />
                      <Tooltip />
                      <Bar dataKey="quantidade" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {Array.isArray(statusEntrega) &&
                      statusEntrega.map((status: any) => (
                        <div
                          key={status.status_entrega}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {getEntregaIcon(status.status_entrega)}
                            <span className="capitalize">
                              {status.status_entrega}
                            </span>
                          </div>
                          <span className="font-medium">
                            {status.quantidade} ({status.percentual}%)
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="excel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Exportar Relatório para Excel</CardTitle>
                <CardDescription>
                  Gere um relatório detalhado de serviços concluídos por período
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Data Início</label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={e => setDataInicio(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Data Fim</label>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={e => setDataFim(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleLoadRelatorio}
                      disabled={loadingExcel}
                      className="w-full"
                    >
                      {loadingExcel ? "Carregando..." : "Buscar Dados"}
                    </Button>
                  </div>
                </div>

                {dadosExcel && dadosExcel.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">
                          {dadosExcel.length} registros encontrados
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total:{" "}
                          {formatarMoeda(
                            dadosExcel.reduce(
                              (acc, row) => acc + row["Total"],
                              0
                            )
                          )}
                        </div>
                      </div>
                      <Button onClick={handleExportExcel} variant="default">
                        Baixar Excel (.CSV)
                      </Button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <ScrollArea className="h-[400px]">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-3 text-left">Data Entrada</th>
                              <th className="p-3 text-left">Data Saída</th>
                              <th className="p-3 text-left">Cliente</th>
                              <th className="p-3 text-left">Moto</th>
                              <th className="p-3 text-left">Placa</th>
                              <th className="p-3 text-left">Forma Pgto</th>
                              <th className="p-3 text-left">Status Pgto</th>
                              <th className="p-3 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dadosExcel.slice(0, 100).map((row, index) => (
                              <tr key={index} className="border-t">
                                <td className="p-3">
                                  {row["Data Entrada"]
                                    ? new Date(
                                        row["Data Entrada"]
                                      ).toLocaleDateString("pt-BR")
                                    : "-"}
                                </td>
                                <td className="p-3">
                                  {row["Data Saída"]
                                    ? new Date(
                                        row["Data Saída"]
                                      ).toLocaleDateString("pt-BR")
                                    : "-"}
                                </td>
                                <td className="p-3">{row["Nome Cliente"]}</td>
                                <td className="p-3">{row["Modelo Moto"]}</td>
                                <td className="p-3">{row["Placa"] || "-"}</td>
                                <td className="p-3">
                                  {formatarFormaPagamento(
                                    row["Forma Pagamento"]
                                  )}
                                </td>
                                <td className="p-3">
                                  <Badge
                                    variant={
                                      row["Status Pagamento"] === "pago"
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {formatarStatusPagamento(
                                      row["Status Pagamento"]
                                    )}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {formatarMoeda(row["Total"])}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>
                    {dadosExcel.length > 100 && (
                      <p className="text-sm text-muted-foreground">
                        Mostrando 100 de {dadosExcel.length} registros. O
                        arquivo Excel conterá todos os dados.
                      </p>
                    )}
                  </div>
                )}

                {dadosExcel && dadosExcel.length === 0 && !loadingExcel && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado. Selecione um período e clique em
                    "Buscar Dados".
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav active="relatorios" />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  description,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  trend: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case "pendente":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "alinhando":
      return <Wrench className="h-4 w-4 text-blue-500" />;
    case "concluido":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
}

function getEntregaIcon(status: string) {
  switch (status) {
    case "pendente":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "entregue":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "retirado":
      return <Package className="h-4 w-4 text-blue-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
}

function formatarFormaPagamento(forma: string | null): string {
  if (!forma) return "-";
  const mapeamento: Record<string, string> = {
    pix: "Pix",
    credito: "Cartão Crédito",
    debito: "Cartão Débito",
    boleto: "Boleto",
  };
  return mapeamento[forma] || forma;
}

function formatarStatusPagamento(status: string | null): string {
  if (!status) return "Pendente";
  return status === "pago" ? "Pago" : "Pendente";
}
