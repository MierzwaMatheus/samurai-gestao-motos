import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { DadosCadastro } from "@shared/types";

/**
 * Caso de uso: Criar entrada (entrada ou orçamento)
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class CriarEntradaUseCase {
  constructor(
    private clienteRepo: ClienteRepository,
    private motoRepo: MotoRepository,
    private entradaRepo: EntradaRepository,
    private orcamentoRepo: OrcamentoRepository
  ) {}

  async execute(dados: DadosCadastro): Promise<{ entradaId: string; orcamentoId?: string }> {
    // Validações de negócio
    if (!dados.cliente || !dados.moto) {
      throw new Error("Cliente e moto são obrigatórios");
    }

    // 1. Buscar ou criar cliente
    let clienteId: string;
    
    // Se clienteId foi fornecido, usar cliente existente
    if (dados.clienteId) {
      const clienteExistente = await this.clienteRepo.buscarPorId(dados.clienteId);
      if (!clienteExistente) {
        throw new Error("Cliente não encontrado");
      }
      clienteId = clienteExistente.id;
      // Atualiza telefone se fornecido
      if (dados.telefone && clienteExistente.telefone !== dados.telefone) {
        await this.clienteRepo.atualizar(clienteId, { telefone: dados.telefone });
      }
    } else {
      // Buscar cliente existente por nome ou criar novo
      const clientesExistentes = await this.clienteRepo.buscarPorNome(dados.cliente);
      const clienteExistente = clientesExistentes.find((c) => c.nome === dados.cliente);

      if (clienteExistente) {
        clienteId = clienteExistente.id;
        // Atualiza telefone se fornecido
        if (dados.telefone && clienteExistente.telefone !== dados.telefone) {
          await this.clienteRepo.atualizar(clienteId, { telefone: dados.telefone });
        }
      } else {
        const novoCliente = await this.clienteRepo.criar({
          nome: dados.cliente,
          telefone: dados.telefone,
          endereco: dados.endereco,
          cep: dados.cep?.replace(/\D/g, ""),
        });
        clienteId = novoCliente.id;
      }
    }

    // 2. Criar moto
    const moto = await this.motoRepo.criar({
      clienteId,
      modelo: dados.moto,
      placa: dados.placa || undefined,
      finalNumeroQuadro: dados.finalNumeroQuadro || undefined,
    });

    // 3. Criar entrada
    const entrada = await this.entradaRepo.criar({
      tipo: dados.tipo,
      clienteId,
      motoId: moto.id,
      endereco: dados.endereco,
      cep: dados.cep?.replace(/\D/g, ""),
      telefone: dados.telefone,
      frete: dados.frete || 0,
      valorCobrado: dados.valorCobrado,
      descricao: dados.descricao,
      observacoes: dados.observacoes,
      dataOrcamento: dados.dataOrcamento,
      dataEntrada: dados.dataEntrada || (dados.tipo === "entrada" ? new Date() : undefined),
      dataEntrega: dados.dataEntrega,
      status: dados.tipo === "entrada" ? "pendente" : "pendente",
      statusEntrega: "pendente",
      progresso: 0,
    });

    // 4. Se for orçamento, criar orçamento
    let orcamentoId: string | undefined;
    if (dados.tipo === "orcamento" && dados.descricao && dados.valorCobrado) {
      // Usa o valor cobrado informado
      const dataExpiracao = dados.dataOrcamento 
        ? new Date(dados.dataOrcamento.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 dias após data do orçamento
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias a partir de agora

      const orcamento = await this.orcamentoRepo.criar({
        entradaId: entrada.id,
        valor: dados.valorCobrado,
        dataExpiracao,
        status: "ativo",
      });
      orcamentoId = orcamento.id;
    }

    return { entradaId: entrada.id, orcamentoId };
  }
}

