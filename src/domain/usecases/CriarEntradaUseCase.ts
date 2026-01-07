import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
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
    private orcamentoRepo: OrcamentoRepository,
    private tipoServicoRepo: TipoServicoRepository,
    private servicoPersonalizadoRepo: ServicoPersonalizadoRepository
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

    // 3. Calcular data de entrega se data de entrada foi fornecida
    // Data de entrega = 2 semanas (14 dias) após a data de entrada
    let dataEntrega = dados.dataEntrega;
    const dataEntrada = dados.dataEntrada || (dados.tipo === "entrada" ? new Date() : undefined);
    
    if (dataEntrada && !dataEntrega) {
      dataEntrega = new Date(dataEntrada);
      dataEntrega.setDate(dataEntrega.getDate() + 14); // 2 semanas = 14 dias
    }

    // 4. Criar entrada (valorCobrado será calculado automaticamente pelos triggers do banco)
    const entrada = await this.entradaRepo.criar({
      tipo: dados.tipo,
      clienteId,
      motoId: moto.id,
      endereco: dados.endereco,
      cep: dados.cep?.replace(/\D/g, ""),
      telefone: dados.telefone,
      frete: dados.frete || 0,
      valorCobrado: 0, // Será calculado automaticamente pelos triggers
      descricao: dados.descricao,
      observacoes: dados.observacoes,
      dataOrcamento: dados.dataOrcamento,
      dataEntrada,
      dataEntrega,
      status: dados.tipo === "entrada" ? "pendente" : "pendente",
      statusEntrega: "pendente",
      progresso: 0,
      tipoPreco: dados.tipoPreco || "oficina",
    });

    // 5. Vincular tipos de serviço à entrada (se houver)
    if (dados.servicos && dados.servicos.length > 0) {
      await this.tipoServicoRepo.vincularTiposServicoAEntrada(
        entrada.id,
        dados.servicos
      );
      // O contador quantidade_servicos será incrementado automaticamente pelo trigger do banco
      // apenas se o tipo da entrada for "entrada" (não "orcamento")
    }

    // 6. Criar serviços personalizados (se houver)
    if (dados.servicosPersonalizados && dados.servicosPersonalizados.length > 0) {
      await Promise.all(
        dados.servicosPersonalizados.map((servico) =>
          this.servicoPersonalizadoRepo.criar(entrada.id, servico)
        )
      );
    }

    // 7. Buscar valor cobrado atualizado (calculado pelos triggers)
    const entradaAtualizada = await this.entradaRepo.buscarPorId(entrada.id);
    const valorCobrado = entradaAtualizada?.valorCobrado || 0;

    // 8. Se for orçamento, criar orçamento
    let orcamentoId: string | undefined;
    if (dados.tipo === "orcamento" && valorCobrado > 0) {
      const dataExpiracao = dados.dataOrcamento 
        ? new Date(dados.dataOrcamento.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 dias após data do orçamento
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias a partir de agora

      const orcamento = await this.orcamentoRepo.criar({
        entradaId: entrada.id,
        valor: valorCobrado,
        dataExpiracao,
        status: "ativo",
      });
      orcamentoId = orcamento.id;
    }

    return { entradaId: entrada.id, orcamentoId };
  }
}

