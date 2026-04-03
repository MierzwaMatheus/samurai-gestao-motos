import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { DadosCadastro } from "@shared/types";

export class PrepararDadosEntradaParaEdicaoUseCase {
  constructor(
    private entradaRepo: EntradaRepository,
    private clienteRepo: ClienteRepository,
    private motoRepo: MotoRepository,
    private fotoRepo: FotoRepository,
    private tipoServicoRepo: TipoServicoRepository,
    private servicoPersonalizadoRepo: ServicoPersonalizadoRepository
  ) {}

  async execute(entradaId: string): Promise<DadosCadastro> {
    const entrada = await this.entradaRepo.buscarPorId(entradaId);
    if (!entrada) {
      throw new Error("Entrada não encontrada");
    }

    const [cliente, moto, fotos, tiposServico, servicosPersonalizados] =
      await Promise.all([
        this.clienteRepo.buscarPorId(entrada.clienteId),
        this.motoRepo.buscarPorId(entrada.motoId),
        this.fotoRepo.buscarPorEntradaId(entrada.id),
        this.tipoServicoRepo.buscarPorEntradaId(entrada.id),
        this.servicoPersonalizadoRepo.buscarPorEntradaId(entrada.id),
      ]);

    if (!cliente || !moto) {
      throw new Error("Cliente ou moto não encontrados");
    }

    const servicosSelecionados = tiposServico.map(t => ({
      tipoServicoId: t.id,
      quantidade: t.quantidade,
      comOleo: t.comOleo,
    }));

    const servicosPersonalizadosInput = servicosPersonalizados.map(sp => ({
      nome: sp.nome,
      valor: sp.valor,
      quantidade: sp.quantidade,
    }));

    const dadosCadastro: DadosCadastro = {
      tipo: entrada.tipo,
      entradaId: entrada.id,
      cliente: cliente.nome,
      clienteId: cliente.id,
      moto: moto.modelo,
      marca: moto.marca,
      ano: moto.ano,
      cilindrada: moto.cilindrada,
      valorCobrado: entrada.valorCobrado,
      telefone: cliente.telefone || "",
      endereco: entrada.endereco || cliente.endereco || "",
      cep: entrada.cep || cliente.cep || "",
      placa: moto.placa || "",
      finalNumeroQuadro:
        entrada.finalNumeroQuadro || moto.finalNumeroQuadro || "",
      descricao: entrada.descricao || "",
      observacoes: entrada.observacoes || "",
      fotos: fotos.map(f => f.url),
      frete: entrada.frete,
      isRetirada:
        entrada.frete === null ||
        entrada.frete === undefined ||
        entrada.frete === 0,
      dataOrcamento: entrada.dataOrcamento || undefined,
      dataEntrada: entrada.dataEntrada || undefined,
      dataEntrega: entrada.dataEntrega || undefined,
      tipoPreco: entrada.tipoPreco || "oficina",
      servicos: servicosSelecionados,
      servicosPersonalizados: servicosPersonalizadosInput,
    };

    return dadosCadastro;
  }
}
