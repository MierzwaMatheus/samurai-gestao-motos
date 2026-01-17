import { useState, useEffect, useMemo } from "react";
import { ListarEntradasUseCase } from "@/domain/usecases/ListarEntradasUseCase";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { MotoCompleta } from "@shared/types";

export function useMotosOficina(
  entradaRepo: EntradaRepository,
  clienteRepo: ClienteRepository,
  motoRepo: MotoRepository,
  tipoServicoRepo?: TipoServicoRepository,
  fotoRepo?: FotoRepository,
  servicoPersonalizadoRepo?: ServicoPersonalizadoRepository
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
      // Busca apenas entradas do tipo "entrada" (não orçamentos) e que não estão entregues
      const entradas = await useCase.execute();
      const entradasFiltradas = entradas.filter(
        (e) => e.tipo === "entrada" && e.statusEntrega !== "entregue" && e.statusEntrega !== "retirado"
      );

      // Busca dados completos (cliente e moto) para cada entrada
      const motosCompletas: MotoCompleta[] = await Promise.all(
        entradasFiltradas.map(async (entrada) => {
          const [cliente, moto, tiposServico, fotosMoto, servicosPersonalizados] = await Promise.all([
            clienteRepo.buscarPorId(entrada.clienteId),
            motoRepo.buscarPorId(entrada.motoId),
            tipoServicoRepo?.buscarPorEntradaId(entrada.id).catch(() => []) || Promise.resolve([]),
            fotoRepo?.buscarPorEntradaIdETipo(entrada.id, "moto").catch(() => []) || Promise.resolve([]),
            servicoPersonalizadoRepo?.buscarPorEntradaId(entrada.id).catch(() => []) || Promise.resolve([]),
          ]);

          return {
            id: entrada.id, // ID da entrada para ações
            entradaId: entrada.id,
            motoId: moto?.id || entrada.motoId,
            clienteId: entrada.clienteId,
            modelo: moto?.modelo || "Modelo não informado",
            marca: moto?.marca,
            ano: moto?.ano,
            cilindrada: moto?.cilindrada,
            placa: moto?.placa,
            criadoEm: moto?.criadoEm || entrada.criadoEm,
            atualizadoEm: moto?.atualizadoEm || entrada.atualizadoEm,
            cliente: cliente?.nome || "Cliente não informado",
            status: entrada.status,
            progresso: entrada.progresso,
            dataConclusao: entrada.dataConclusao ?? null,
            formaPagamento: entrada.formaPagamento ?? null,
            fotosStatus: entrada.fotosStatus || [],
            fotos: fotosMoto.map((foto) => foto.url), // URLs das fotos do tipo "moto"
            tiposServico: tiposServico || [],
            servicosPersonalizados: servicosPersonalizados || [],
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
  }, [useCase, clienteRepo, motoRepo, fotoRepo, tipoServicoRepo, servicoPersonalizadoRepo]);

  const atualizarMoto = (entradaId: string, atualizacoes: Partial<MotoCompleta>) => {
    setMotos((prevMotos) =>
      prevMotos.map((moto) =>
        moto.entradaId === entradaId ? { ...moto, ...atualizacoes } : moto
      )
    );
  };

  return { motos, loading, error, recarregar: carregar, atualizarMoto };
}

