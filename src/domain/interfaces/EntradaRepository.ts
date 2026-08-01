import { Entrada, MotoCompleta } from "@shared/types";
import { Pagina } from "@/domain/interfaces/OrcamentoRepository";

/**
 * Parâmetros para consulta paginada de entradas.
 * Filtros server-side já declarados na assinatura para que o repositório
 * consiga aplicá-los no backend (Supabase) sem precisar puxar tudo para o
 * cliente.
 *
 * - page: número da página (1-based)
 * - pageSize: quantidade de itens por página
 * - tipo: filtra entradas pelo tipo ("entrada" | "orcamento")
 * - status: lista de status da oficina aceitos ("pendente" | "alinhando" | "concluido")
 * - statusEntrega: lista de status de entrega aceitos ("pendente" | "entregue" | "retirado")
 * - busca: termo livre aplicado em cliente/moto/placa/serviço
 */
export interface BuscarPaginaEntradasParams {
  page: number;
  pageSize: number;
  tipo?: Entrada["tipo"];
  status?: Entrada["status"][];
  statusEntrega?: NonNullable<Entrada["statusEntrega"]>[];
  busca?: string;
}

/**
 * Interface para repositório de entradas
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface EntradaRepository {
  criar(entrada: Omit<Entrada, "id" | "criadoEm" | "atualizadoEm">): Promise<Entrada>;
  buscarPorId(id: string): Promise<Entrada | null>;
  buscarPorClienteId(clienteId: string): Promise<Entrada[]>;
  buscarPorMotoId(motoId: string): Promise<Entrada[]>;
  buscarPorStatus(status: Entrada["status"]): Promise<Entrada[]>;
  listar(): Promise<Entrada[]>;
  atualizar(id: string, dados: Partial<Entrada>): Promise<Entrada>;
  deletar(id: string): Promise<void>;
  /**
   * Busca uma página de entradas completas (com cliente, moto, fotos e
   * serviços) aplicando filtros server-side. Retorna também o total de
   * registros para suportar scroll infinito e contadores.
   */
  buscarPagina(params: BuscarPaginaEntradasParams): Promise<Pagina<MotoCompleta>>;
}

