import { useState, useEffect, useMemo } from "react";
import { ListarEntradasUseCase } from "@/domain/usecases/ListarEntradasUseCase";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { MotoCompleta } from "@shared/types";

export function useMotosOficina(
  entradaRepo: EntradaRepository,
  clienteRepo: ClienteRepository,
  motoRepo: MotoRepository
) {
  const [motos, setMotos] = useState<MotoCompleta[]>([]);
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
      // Busca apenas entradas do tipo "entrada" (não orçamentos)
      const entradas = await useCase.execute();
      const entradasFiltradas = entradas.filter((e) => e.tipo === "entrada");

      // Busca dados completos (cliente e moto) para cada entrada
      const motosCompletas: MotoCompleta[] = await Promise.all(
        entradasFiltradas.map(async (entrada) => {
          const [cliente, moto] = await Promise.all([
            clienteRepo.buscarPorId(entrada.clienteId),
            motoRepo.buscarPorId(entrada.motoId),
          ]);

          return {
            id: moto?.id || entrada.motoId, // ID da moto, não da entrada
            clienteId: entrada.clienteId,
            modelo: moto?.modelo || "Modelo não informado",
            placa: moto?.placa,
            criadoEm: moto?.criadoEm || entrada.criadoEm,
            atualizadoEm: moto?.atualizadoEm || entrada.atualizadoEm,
            cliente: cliente?.nome || "Cliente não informado",
            status: entrada.status,
            progresso: entrada.progresso,
            fotos: [], // TODO: buscar fotos quando implementar
          };
        })
      );

      setMotos(motosCompletas);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao carregar motos";
      setError(mensagem);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [useCase, clienteRepo, motoRepo]);

  return { motos, loading, error, recarregar: carregar };
}

