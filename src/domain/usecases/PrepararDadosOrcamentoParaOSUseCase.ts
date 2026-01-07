import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { FotoRepository } from "@/domain/interfaces/FotoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { DadosCadastro } from "@shared/types";

/**
 * Caso de uso: Preparar dados do orçamento para preencher formulário de OS
 * Segue o princípio de Responsabilidade Única (SRP)
 * 
 * Este caso de uso busca todos os dados necessários de um orçamento
 * e os formata para preencher o formulário de cadastro de OS/Entrada
 */
export class PrepararDadosOrcamentoParaOSUseCase {
  constructor(
    private orcamentoRepo: OrcamentoRepository,
    private entradaRepo: EntradaRepository,
    private clienteRepo: ClienteRepository,
    private motoRepo: MotoRepository,
    private fotoRepo: FotoRepository,
    private tipoServicoRepo: TipoServicoRepository,
    private servicoPersonalizadoRepo: ServicoPersonalizadoRepository
  ) { }

  async execute(orcamentoId: string): Promise<DadosCadastro> {
    // Busca orçamento
    const orcamento = await this.orcamentoRepo.buscarPorId(orcamentoId);
    if (!orcamento) {
      throw new Error("Orçamento não encontrado");
    }

    // Busca entrada relacionada
    const entrada = await this.entradaRepo.buscarPorId(orcamento.entradaId);
    if (!entrada) {
      throw new Error("Entrada não encontrada");
    }

    // Busca cliente e moto
    const [cliente, moto] = await Promise.all([
      this.clienteRepo.buscarPorId(entrada.clienteId),
      this.motoRepo.buscarPorId(entrada.motoId),
    ]);

    if (!cliente || !moto) {
      throw new Error("Cliente ou moto não encontrados");
    }

    // Busca fotos da entrada (opcional)
    const fotos = await this.fotoRepo.buscarPorEntradaId(entrada.id);
    const fotosUrls = fotos.length > 0 ? fotos.map((f) => f.url) : [];

    // Busca tipos de serviço da entrada (opcional)
    const tiposServico = await this.tipoServicoRepo.buscarPorEntradaId(entrada.id);
    const tiposServicoIds = tiposServico.length > 0 ? tiposServico.map((t) => t.id) : [];

    // Busca serviços personalizados da entrada (opcional)
    const servicosPersonalizados = await this.servicoPersonalizadoRepo.buscarPorEntradaId(entrada.id);

    // Prepara dados para o formulário
    // IMPORTANTE:
    // - Campos obrigatórios são sempre preenchidos
    // - Campos opcionais só são preenchidos se existirem e não forem vazios
    // - observações NÃO é preenchido automaticamente

    const servicosSelecionados = tiposServico.map(t => ({
      tipoServicoId: t.id,
      quantidade: t.quantidade,
      comOleo: t.comOleo
    }));

    const servicosPersonalizadosInput = servicosPersonalizados.map(sp => ({
      nome: sp.nome,
      valor: sp.valor,
      quantidade: sp.quantidade
    }));

    const dadosCadastro: DadosCadastro = {
      tipo: entrada.tipo,
      // Campos obrigatórios
      cliente: cliente.nome,
      clienteId: cliente.id,
      moto: moto.modelo,
      valorCobrado: entrada.valorCobrado,
      // Campos opcionais - só preenche se existirem e não forem vazios
      telefone: (cliente.telefone && cliente.telefone.trim() !== "") ? cliente.telefone : "",
      endereco: (entrada.endereco && entrada.endereco.trim() !== "")
        ? entrada.endereco
        : (cliente.endereco && cliente.endereco.trim() !== "") ? cliente.endereco : "",
      cep: (entrada.cep && entrada.cep.trim() !== "")
        ? entrada.cep
        : (cliente.cep && cliente.cep.trim() !== "") ? cliente.cep : "",
      placa: (moto.placa && moto.placa.trim() !== "") ? moto.placa : "",
      finalNumeroQuadro: (entrada.finalNumeroQuadro && entrada.finalNumeroQuadro.trim() !== "")
        ? entrada.finalNumeroQuadro
        : (moto.finalNumeroQuadro && moto.finalNumeroQuadro.trim() !== "") ? moto.finalNumeroQuadro : "",
      descricao: (entrada.descricao && entrada.descricao.trim() !== "") ? entrada.descricao : "",
      observacoes: "", // NÃO preenche observações/detalhes
      fotos: fotosUrls, // Array vazio se não houver fotos
      frete: entrada.frete || 0,
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

