import { useState, useMemo } from "react";
import { GerarOSUseCase } from "@/domain/usecases/GerarOSUseCase";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { gerarOSPDF, imprimirOS } from "@/utils/gerarOSPDF";

export function useGerarOS(
  entradaRepo: EntradaRepository,
  clienteRepo: ClienteRepository,
  motoRepo: MotoRepository,
  fotoRepo: FotoRepository,
  tipoServicoRepo: TipoServicoRepository
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCase = useMemo(
    () => new GerarOSUseCase(entradaRepo, clienteRepo, motoRepo, fotoRepo, tipoServicoRepo),
    [entradaRepo, clienteRepo, motoRepo, fotoRepo, tipoServicoRepo]
  );

  const gerar = async (entradaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const dados = await useCase.execute(entradaId);
      const htmlBlob = await gerarOSPDF(dados);
      const html = await htmlBlob.text();
      imprimirOS(html);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao gerar OS";
      setError(mensagem);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { gerar, loading, error };
}

