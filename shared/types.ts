// Tipos compartilhados entre frontend e backend

export type EntryType = "entrada" | "orcamento";

export interface Endereco {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  coordenadas?: {
    latitude: number;
    longitude: number;
  };
}

export interface ServicoSelecionado {
  tipoServicoId: string;
  quantidade: number;
  comOleo?: boolean;
}

export interface ServicoPersonalizadoInput {
  nome: string;
  valor: number;
  quantidade: number;
}

export type TipoPreco = "oficina" | "particular";

export interface DadosCadastro {
  tipo: EntryType;
  cliente: string;
  clienteId?: string; // ID do cliente existente quando usar cliente existente
  telefone?: string;
  endereco?: string;
  cep?: string;
  moto: string;
  marca?: string;
  ano?: string;
  cilindrada?: string;
  placa?: string;
  finalNumeroQuadro?: string;
  valorCobrado?: number; // Calculado automaticamente, não editável
  descricao?: string;
  observacoes?: string;
  fotos: string[];
  frete: number | null; // null quando for retirada, number quando for frete
  isRetirada?: boolean; // Indica se é retirada (frete = null) ou frete
  dataOrcamento?: Date;
  dataEntrada?: Date;
  dataEntrega?: Date;
  enderecoCompleto?: Endereco;
  tipoPreco?: TipoPreco; // "oficina" (padrão) ou "particular"
  servicos?: ServicoSelecionado[]; // Tipos de serviço com quantidade
  servicosPersonalizados?: ServicoPersonalizadoInput[]; // Serviços personalizados (não salvos na tabela)
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cep?: string;
  numeroServicos: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Moto {
  id: string;
  clienteId: string;
  modelo: string;
  marca?: string;
  ano?: string;
  cilindrada?: string;
  placa?: string;
  finalNumeroQuadro?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type FormaPagamento = "pix" | "credito" | "debito" | "boleto";
export type StatusPagamento = "pendente" | "pago";

export interface RelatorioExcelRow {
  "Data Entrada": string | null;
  "Data Saída": string | null;
  "Nome Cliente": string;
  Telefone: string | null;
  "Modelo Moto": string;
  Placa: string | null;
  "Forma Pagamento": string | null;
  "Status Pagamento": string | null;
  "Valor Serviço": number;
  Frete: number;
  Total: number;
}

export interface Entrada {
  id: string;
  tipo: EntryType;
  clienteId: string;
  motoId: string;
  endereco?: string;
  cep?: string;
  telefone?: string;
  frete: number | null; // null quando for retirada
  valorCobrado?: number;
  descricao?: string;
  observacoes?: string;
  dataOrcamento?: Date;
  dataEntrada?: Date;
  dataEntrega?: Date;
  status: "pendente" | "alinhando" | "concluido";
  statusEntrega?: "pendente" | "entregue" | "retirado";
  progresso: number;
  finalNumeroQuadro?: string;
  osAssinadaUrl?: string;
  fotosStatus?: FotoStatus[];
  tipoPreco?: TipoPreco;
  dataConclusao?: Date | null;
  formaPagamento?: FormaPagamento | null;
  statusPagamento?: StatusPagamento | null;
  dataPagamento?: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Orcamento {
  id: string;
  entradaId: string;
  valor: number;
  dataExpiracao: Date;
  status: "ativo" | "expirado" | "convertido";
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Foto {
  id: string;
  entradaId: string;
  url: string;
  tipo: "moto" | "status" | "documento";
  criadoEm: Date;
}

export interface FotoStatus {
  url: string;
  data: Date;
  observacao?: string;
  progresso: number;
}

// Tipos para visualização (com joins)
export interface OrcamentoCompleto extends Orcamento {
  cliente: string;
  telefone?: string;
  moto: string;
  marca?: string;
  ano?: string;
  cilindrada?: string;
  placa?: string;
  finalNumeroQuadro?: string;
  descricao?: string;
  frete: number | null; // null quando for retirada
  fotoMoto?: string; // URL da primeira foto do tipo "moto"
  endereco?: string;
  cep?: string;
  valorCobrado?: number;
  dataOrcamento?: Date;
  tiposServico?: TipoServicoComQuantidade[];
  servicosPersonalizados?: ServicoPersonalizado[];
}

export interface MotoCompleta extends Moto {
  entradaId: string;
  cliente: string;
  telefone?: string;
  status: "pendente" | "alinhando" | "concluido";
  progresso: number;
  dataConclusao?: Date | null;
  formaPagamento?: FormaPagamento | null;
  statusPagamento?: StatusPagamento | null;
  fotosStatus?: FotoStatus[];
  fotos: string[]; // Legado - fotos do tipo "moto"
  tiposServico?: TipoServicoComQuantidade[];
  servicosPersonalizados?: ServicoPersonalizado[];
}

export interface TipoServico {
  id: string;
  nome: string;
  categoria?: "padrao" | "alinhamento";
  precoOficina: number;
  precoParticular: number;
  precoOficinaComOleo?: number;
  precoOficinaSemOleo?: number;
  precoParticularComOleo?: number;
  precoParticularSemOleo?: number;
  quantidadeServicos: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

// Tipo legado para compatibilidade (será removido gradualmente)
export interface TipoServicoLegado {
  id: string;
  nome: string;
  valor: number; // Mapeia para precoOficina
  quantidadeServicos: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface TipoServicoComQuantidade extends TipoServico {
  quantidade: number; // Quantidade usada nesta entrada/orçamento
  comOleo?: boolean;
}

export interface ServicoPersonalizado {
  id: string;
  entradaId: string;
  nome: string;
  valor: number;
  quantidade: number;
  criadoEm: Date;
}

export interface ConfiguracaoFrete {
  id: string;
  cepOrigem: string;
  valorPorKm: number;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type PermissaoUsuario = "admin" | "usuario";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  permissao: PermissaoUsuario;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  criadoPor?: string;
}

export interface CriarUsuarioInput {
  email: string;
  senha: string;
  nome: string;
  permissao?: PermissaoUsuario;
}

export interface AtualizarUsuarioInput {
  nome?: string;
  permissao?: PermissaoUsuario;
  ativo?: boolean;
}
