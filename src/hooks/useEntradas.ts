import { useState, useEffect, useMemo } from "react";
import { ListarEntradasUseCase } from "@/domain/usecases/ListarEntradasUseCase";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { Entrada } from "@shared/types";

export function useEntradas(entradaRepo: EntradaRepository, status?: Entrada["status"]) {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new ListarEntradasUseCase(entradaRepo),
    [entradaRepo]
  );

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const dados = await useCase.execute(status);
      setEntradas(dados);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao carregar entradas";
      setError(mensagem);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [status, useCase]);

  return { entradas, loading, error, recarregar: carregar };
}

