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
    const clientesExistentes = await this.clienteRepo.buscarPorNome(dados.cliente);
    const clienteExistente = clientesExistentes.find((c) => c.nome === dados.cliente);

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const novoCliente = await this.clienteRepo.criar({
        nome: dados.cliente,
        endereco: dados.endereco,
        cep: dados.cep?.replace(/\D/g, ""),
      });
      clienteId = novoCliente.id;
    }

    // 2. Criar moto
    const moto = await this.motoRepo.criar({
      clienteId,
      modelo: dados.moto,
      placa: dados.placa || undefined,
    });

    // 3. Criar entrada
    const entrada = await this.entradaRepo.criar({
      tipo: dados.tipo,
      clienteId,
      motoId: moto.id,
      endereco: dados.endereco,
      cep: dados.cep?.replace(/\D/g, ""),
      frete: dados.frete || 0,
      descricao: dados.descricao,
      status: dados.tipo === "entrada" ? "pendente" : "pendente",
      progresso: 0,
    });

    // 4. Se for orçamento, criar orçamento
    let orcamentoId: string | undefined;
    if (dados.tipo === "orcamento" && dados.descricao) {
      // Calcula valor base (pode ser melhorado com lógica de negócio)
      const valorBase = 300; // Valor padrão, pode ser calculado baseado na descrição
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 7); // 7 dias para expirar

      const orcamento = await this.orcamentoRepo.criar({
        entradaId: entrada.id,
        valor: valorBase,
        dataExpiracao,
        status: "ativo",
      });
      orcamentoId = orcamento.id;
    }

    return { entradaId: entrada.id, orcamentoId };
  }
}

