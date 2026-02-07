import { useState, useCallback } from "react";
import { supabase } from "@/infrastructure/supabase/client";

interface RelatorioExcelRow {
  "Data Entrada": string | null;
  "Data Saída": string | null;
  "Nome Cliente": string;
  Telefone: string | null;
  "Modelo Moto": string;
  Placa: string | null;
  "Forma Pagamento": string | null;
  "Status Pagamento": string | null;
  "Valor Serviço": number;
  Frete: number;
  Total: number;
}

export function useRelatorioExcel() {
  const [data, setData] = useState<RelatorioExcelRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRelatorio = useCallback(
    async (dataInicio?: Date, dataFim?: Date) => {
      setIsLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("vw_relatorio_excel")
          .select("*")
          .order('"Data Entrada"', { ascending: false });

        if (dataInicio) {
          query = query.gte('"Data Entrada"', dataInicio.toISOString());
        }
        if (dataFim) {
          query = query.lte('"Data Entrada"', dataFim.toISOString());
        }

        const { data: result, error: err } = await query;

        if (err) throw err;
        setData(result || []);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const atualizarStatusPagamento = useCallback(
    async (entradaId: string, statusPagamento: "pendente" | "pago") => {
      const updates = {
        status_pagamento: statusPagamento,
        data_pagamento:
          statusPagamento === "pago" ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from("entradas")
        .update(updates)
        .eq("id", entradaId);

      if (err) throw err;
    },
    []
  );

  const atualizarFormaPagamento = useCallback(
    async (entradaId: string, formaPagamento: string) => {
      const updates = {
        forma_pagamento: formaPagamento,
        atualizado_em: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from("entradas")
        .update(updates)
        .eq("id", entradaId);

      if (err) throw err;
    },
    []
  );

  return {
    data,
    isLoading,
    error,
    fetchRelatorio,
    atualizarStatusPagamento,
    atualizarFormaPagamento,
  };
}

export function exportToExcel(
  data: RelatorioExcelRow[],
  filename: string = "relatorio"
) {
  const headers = [
    "Data Entrada",
    "Data Saída",
    "Nome Cliente",
    "Telefone",
    "Modelo Moto",
    "Placa",
    "Forma Pagamento",
    "Status Pagamento",
    "Valor Serviço",
    "Frete",
    "Total",
  ];

  const rows = data.map(row => [
    row["Data Entrada"]
      ? new Date(row["Data Entrada"]).toLocaleDateString("pt-BR")
      : "",
    row["Data Saída"]
      ? new Date(row["Data Saída"]).toLocaleDateString("pt-BR")
      : "",
    row["Nome Cliente"] || "",
    row["Telefone"] || "",
    row["Modelo Moto"] || "",
    row["Placa"] || "",
    formatarFormaPagamento(row["Forma Pagamento"]),
    formatarStatusPagamento(row["Status Pagamento"]),
    formatarMoeda(row["Valor Serviço"]),
    formatarMoeda(row["Frete"]),
    formatarMoeda(row["Total"]),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}
