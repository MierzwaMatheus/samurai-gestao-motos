import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { StorageApi } from "@/domain/interfaces/StorageApi";
import { Entrada } from "@shared/types";

/**
 * Caso de uso: Gerar Ordem de Serviço
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class GerarOSUseCase {
  constructor(
    private entradaRepo: EntradaRepository,
    private clienteRepo: ClienteRepository,
    private motoRepo: MotoRepository,
    private fotoRepo: FotoRepository,
    private tipoServicoRepo: TipoServicoRepository,
    private servicoPersonalizadoRepo: ServicoPersonalizadoRepository,
    private storageApi: StorageApi
  ) { }

  async execute(entradaId: string): Promise<{
    entrada: Entrada;
    cliente: { nome: string; telefone?: string; endereco?: string };
    moto: {
      modelo: string;
      placa?: string;
      finalNumeroQuadro?: string;
      ano?: string;
      marca?: string;
      cilindrada?: string;
    };
    fotos: Array<{ url: string; tipo: string }>;
    tiposServico: Array<{
      nome: string;
      categoria?: "padrao" | "alinhamento";
      comOleo?: boolean;
      quantidade?: number
    }>;
    servicosPersonalizados: Array<{
      nome: string;
      valor: number;
      quantidade: number;
    }>;
  }> {
    // Busca entrada
    const entrada = await this.entradaRepo.buscarPorId(entradaId);
    if (!entrada) {
      throw new Error("Entrada não encontrada");
    }

    // Busca cliente, moto, fotos, tipos de serviço e serviços personalizados em paralelo
    const [cliente, moto, fotos, tiposServico, servicosPersonalizados] = await Promise.all([
      this.clienteRepo.buscarPorId(entrada.clienteId),
      this.motoRepo.buscarPorId(entrada.motoId),
      this.fotoRepo.buscarPorEntradaId(entradaId),
      this.tipoServicoRepo.buscarPorEntradaId(entradaId),
      this.servicoPersonalizadoRepo.buscarPorEntradaId(entradaId),
    ]);



    if (!cliente || !moto) {
      throw new Error("Cliente ou moto não encontrados");
    }

    // Resolver URLs assinadas para fotos de status
    const fotosStatusFinal = await Promise.all(
      (entrada.fotosStatus || []).map(async (f) => {
        let url = f.url;
        // Se não for URL completa (http...), gera assinada
        if (!url.startsWith("http")) {
          // Tenta obter URL assinada. Se falhar, usa a original.
          try {
            url = await this.storageApi.obterUrlAssinada(f.url, 3600);
          } catch (e) {
            console.error("Erro ao gerar URL assinada para foto status:", e);
          }
        }
        return {
          url: url,
          tipo: "status"
        };
      })
    );

    return {
      entrada,
      cliente: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
      },
      moto: {
        modelo: moto.modelo,
        placa: moto.placa,
        finalNumeroQuadro: moto.finalNumeroQuadro,
        // Campos placeholders conforme solicitado
        ano: undefined,
        marca: undefined,
        cilindrada: undefined
      },
      fotos: [
        ...fotos.map((f) => ({ url: f.url, tipo: f.tipo })),
        ...fotosStatusFinal
      ],
      tiposServico: tiposServico.map((t) => ({
        nome: t.nome,
        categoria: t.categoria,
        comOleo: t.comOleo,
        quantidade: t.quantidade
      })),
      servicosPersonalizados: servicosPersonalizados.map((s) => ({
        nome: s.nome,
        valor: s.valor,
        quantidade: s.quantidade
      })),
    };
  }
}

