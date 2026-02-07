import { useCallback } from "react";
import { supabase } from "@/infrastructure/supabase/client";
import { toast } from "sonner";

export function usePagamento() {
  const atualizarStatusPagamento = useCallback(
    async (
      entradaId: string,
      statusPagamento: "pendente" | "pago",
      formaPagamento?: string
    ) => {
      const updates: Record<string, any> = {
        status_pagamento: statusPagamento,
        atualizado_em: new Date().toISOString(),
      };

      if (statusPagamento === "pago") {
        updates.data_pagamento = new Date().toISOString();
      }

      if (formaPagamento) {
        updates.forma_pagamento = formaPagamento;
      }

      const { error } = await supabase
        .from("entradas")
        .update(updates)
        .eq("id", entradaId);

      if (error) {
        toast.error("Erro ao atualizar pagamento");
        throw error;
      }

      toast.success(
        statusPagamento === "pago"
          ? "Pagamento marcado como pago!"
          : "Pagamento marcado como pendente!"
      );
      return true;
    },
    []
  );

  const atualizarFormaPagamento = useCallback(
    async (entradaId: string, formaPagamento: string) => {
      const updates = {
        forma_pagamento: formaPagamento,
        atualizado_em: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("entradas")
        .update(updates)
        .eq("id", entradaId);

      if (error) {
        toast.error("Erro ao atualizar forma de pagamento");
        throw error;
      }

      toast.success("Forma de pagamento atualizada!");
      return true;
    },
    []
  );

  return {
    atualizarStatusPagamento,
    atualizarFormaPagamento,
  };
}
