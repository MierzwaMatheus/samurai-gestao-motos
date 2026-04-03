import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { MotoRepository } from "@/domain/interfaces/MotoRepository";
import { EntradaRepository } from "@/domain/interfaces/EntradaRepository";
import { OrcamentoRepository } from "@/domain/interfaces/OrcamentoRepository";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { ServicoPersonalizadoRepository } from "@/domain/interfaces/ServicoPersonalizadoRepository";
import { DadosCadastro } from "@shared/types";
import { HistoricoRepository } from "@/domain/interfaces/HistoricoRepository";

/**
 * Caso de uso: Atualizar entrada existente
 * Segue o princípio de Responsabilidade Única (SRP)
 */
export class AtualizarEntradaUseCase {
  constructor(
    private clienteRepo: ClienteRepository,
    private motoRepo: MotoRepository,
    private entradaRepo: EntradaRepository,
    private orcamentoRepo: OrcamentoRepository,
    private tipoServicoRepo: TipoServicoRepository,
    private servicoPersonalizadoRepo: ServicoPersonalizadoRepository,
    private historicoRepo: HistoricoRepository
  ) {}

  async execute(entradaId: string, dados: DadosCadastro): Promise<void> {
    // Validações de negócio
    if (!dados.cliente || !dados.moto) {
      throw new Error("Cliente e moto são obrigatórios");
    }

    // Busca entrada existente
    const entradaExistente = await this.entradaRepo.buscarPorId(entradaId);
    if (!entradaExistente) {
      throw new Error("Entrada não encontrada");
    }

    // Busca dados antigos ANTES de atualizar para comparação no histórico
    const motoAntiga = await this.motoRepo.buscarPorId(entradaExistente.motoId);
    const clienteAntigo = await this.clienteRepo.buscarPorId(
      entradaExistente.clienteId
    );

    console.log("[AtualizarEntradaUseCase] Moto antiga:", motoAntiga);
    console.log("[AtualizarEntradaUseCase] Cliente antigo:", clienteAntigo);
    console.log("[AtualizarEntradaUseCase] Dados novos:", dados);
    console.log(
      "[AtualizarEntradaUseCase] Entrada existente:",
      entradaExistente
    );

    // 1. Atualizar ou criar cliente
    let clienteId: string;

    if (dados.clienteId) {
      const clienteExistente = await this.clienteRepo.buscarPorId(
        dados.clienteId
      );
      if (!clienteExistente) {
        throw new Error("Cliente não encontrado");
      }
      clienteId = clienteExistente.id;
      // Atualiza telefone, endereço e CEP se fornecidos
      await this.clienteRepo.atualizar(clienteId, {
        telefone: dados.telefone,
        endereco: dados.endereco,
        cep: dados.cep?.replace(/\D/g, ""),
      });
    } else {
      const clientesExistentes = await this.clienteRepo.buscarPorNome(
        dados.cliente
      );
      const clienteExistente = clientesExistentes.find(
        c => c.nome === dados.cliente
      );

      if (clienteExistente) {
        clienteId = clienteExistente.id;
        await this.clienteRepo.atualizar(clienteId, {
          telefone: dados.telefone,
          endereco: dados.endereco,
          cep: dados.cep?.replace(/\D/g, ""),
        });
      } else {
        const novoCliente = await this.clienteRepo.criar({
          nome: dados.cliente,
          telefone: dados.telefone,
          endereco: dados.endereco,
          cep: dados.cep?.replace(/\D/g, ""),
          numeroServicos: 0,
        });
        clienteId = novoCliente.id;
      }
    }

    // 2. Atualizar moto
    await this.motoRepo.atualizar(entradaExistente.motoId, {
      modelo: dados.moto,
      marca: dados.marca,
      ano: dados.ano,
      cilindrada: dados.cilindrada,
      placa: dados.placa || undefined,
      finalNumeroQuadro: dados.finalNumeroQuadro || undefined,
    });

    // 3. Calcular data de entrega se data de entrada foi fornecida
    let dataEntrega = dados.dataEntrega;
    const dataEntrada = dados.dataEntrada || entradaExistente.dataEntrada;

    if (dataEntrada && !dataEntrega) {
      dataEntrega = new Date(dataEntrada);
      dataEntrega.setDate(dataEntrega.getDate() + 14);
    }

    // 4. Atualizar entrada
    await this.entradaRepo.atualizar(entradaId, {
      tipo: dados.tipo,
      clienteId,
      endereco: dados.endereco,
      cep: dados.cep?.replace(/\D/g, ""),
      telefone: dados.telefone,
      frete: dados.frete,
      descricao: dados.descricao,
      observacoes: dados.observacoes,
      dataOrcamento: dados.dataOrcamento,
      dataEntrada,
      dataEntrega,
      tipoPreco: dados.tipoPreco || "oficina",
    });

    // 5. Vincular tipos de serviço (o método já remove os antigos e cria novos)
    if (dados.servicos && dados.servicos.length > 0) {
      await this.tipoServicoRepo.vincularTiposServicoAEntrada(
        entradaId,
        dados.servicos
      );
    }

    // 6. Deletar serviços personalizados antigos e criar novos
    await this.servicoPersonalizadoRepo.deletarPorEntradaId(entradaId);
    if (
      dados.servicosPersonalizados &&
      dados.servicosPersonalizados.length > 0
    ) {
      await Promise.all(
        dados.servicosPersonalizados.map(servico =>
          this.servicoPersonalizadoRepo.criar(entradaId, servico)
        )
      );
    }

    // 7. Registrar atividade no histórico com o que foi alterado
    let historicoEntidadeId = entradaId;
    let historicoEntidadeTipo = "entrada";

    if (dados.orcamentoId) {
      historicoEntidadeId = dados.orcamentoId;
      historicoEntidadeTipo = "orcamento";
    } else if (entradaExistente.tipo === "orcamento") {
      const orcamentos = await this.orcamentoRepo.listar();
      const orcamento = orcamentos.find(o => o.entradaId === entradaId);
      if (orcamento) {
        historicoEntidadeId = orcamento.id;
        historicoEntidadeTipo = "orcamento";
      }
    }

    // Compara dados antigos com novos para registrar o que mudou
    const alteracoes: Record<string, any> = {};

    if (clienteAntigo && clienteAntigo.nome !== dados.cliente) {
      alteracoes.cliente = { antes: clienteAntigo.nome, depois: dados.cliente };
    }
    if (clienteAntigo && clienteAntigo.telefone !== dados.telefone) {
      alteracoes.telefone = {
        antes: clienteAntigo.telefone,
        depois: dados.telefone,
      };
    }
    if (clienteAntigo && clienteAntigo.endereco !== dados.endereco) {
      alteracoes.endereco = {
        antes: clienteAntigo.endereco,
        depois: dados.endereco,
      };
    }
    if (clienteAntigo && clienteAntigo.cep !== dados.cep) {
      alteracoes.cep = { antes: clienteAntigo.cep, depois: dados.cep };
    }
    if (motoAntiga && motoAntiga.modelo !== dados.moto) {
      alteracoes.moto = { antes: motoAntiga.modelo, depois: dados.moto };
    }
    if (motoAntiga && motoAntiga.marca !== dados.marca) {
      alteracoes.marca = { antes: motoAntiga.marca, depois: dados.marca };
    }
    if (motoAntiga && motoAntiga.ano !== dados.ano) {
      alteracoes.ano = { antes: motoAntiga.ano, depois: dados.ano };
    }
    if (motoAntiga && motoAntiga.cilindrada !== dados.cilindrada) {
      alteracoes.cilindrada = {
        antes: motoAntiga.cilindrada,
        depois: dados.cilindrada,
      };
    }
    if (motoAntiga && motoAntiga.placa !== dados.placa) {
      alteracoes.placa = { antes: motoAntiga.placa, depois: dados.placa };
    }
    if (
      motoAntiga &&
      motoAntiga.finalNumeroQuadro !== dados.finalNumeroQuadro
    ) {
      alteracoes.finalNumeroQuadro = {
        antes: motoAntiga.finalNumeroQuadro,
        depois: dados.finalNumeroQuadro,
      };
    }
    if (entradaExistente.descricao !== dados.descricao) {
      alteracoes.descricao = {
        antes: entradaExistente.descricao,
        depois: dados.descricao,
      };
    }
    if (entradaExistente.observacoes !== dados.observacoes) {
      alteracoes.observacoes = {
        antes: entradaExistente.observacoes,
        depois: dados.observacoes,
      };
    }
    if (entradaExistente.endereco !== dados.endereco) {
      alteracoes.enderecoEntrada = {
        antes: entradaExistente.endereco,
        depois: dados.endereco,
      };
    }
    if (entradaExistente.cep !== dados.cep) {
      alteracoes.cepEntrada = {
        antes: entradaExistente.cep,
        depois: dados.cep,
      };
    }
    if (entradaExistente.telefone !== dados.telefone) {
      alteracoes.telefoneEntrada = {
        antes: entradaExistente.telefone,
        depois: dados.telefone,
      };
    }
    if (entradaExistente.frete !== dados.frete) {
      alteracoes.frete = { antes: entradaExistente.frete, depois: dados.frete };
    }
    if (
      entradaExistente.dataOrcamento?.toISOString() !==
      dados.dataOrcamento?.toISOString()
    ) {
      alteracoes.dataOrcamento = {
        antes: entradaExistente.dataOrcamento,
        depois: dados.dataOrcamento,
      };
    }
    if (
      entradaExistente.dataEntrada?.toISOString() !==
      dados.dataEntrada?.toISOString()
    ) {
      alteracoes.dataEntrada = {
        antes: entradaExistente.dataEntrada,
        depois: dados.dataEntrada,
      };
    }
    if (
      entradaExistente.dataEntrega?.toISOString() !==
      dados.dataEntrega?.toISOString()
    ) {
      alteracoes.dataEntrega = {
        antes: entradaExistente.dataEntrega,
        depois: dados.dataEntrega,
      };
    }
    if (entradaExistente.tipoPreco !== dados.tipoPreco) {
      alteracoes.tipoPreco = {
        antes: entradaExistente.tipoPreco,
        depois: dados.tipoPreco,
      };
    }
    if (entradaExistente.tipo !== dados.tipo) {
      alteracoes.tipo = { antes: entradaExistente.tipo, depois: dados.tipo };
    }

    await this.historicoRepo.registrarAtividade({
      entidadeTipo: historicoEntidadeTipo as "entrada" | "orcamento",
      entidadeId: historicoEntidadeId,
      acao: "entrada_atualizada",
      detalhes: alteracoes,
    });
  }
}
