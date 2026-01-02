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

export interface DadosCadastro {
  tipo: EntryType;
  cliente: string;
  telefone?: string;
  endereco?: string;
  cep?: string;
  moto: string;
  placa?: string;
  finalNumeroQuadro?: string;
  valorCobrado?: number;
  descricao?: string;
  observacoes?: string;
  fotos: string[];
  frete: number;
  dataOrcamento?: Date;
  dataEntrada?: Date;
  dataEntrega?: Date;
  enderecoCompleto?: Endereco;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cep?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Moto {
  id: string;
  clienteId: string;
  modelo: string;
  placa?: string;
  finalNumeroQuadro?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Entrada {
  id: string;
  tipo: EntryType;
  clienteId: string;
  motoId: string;
  endereco?: string;
  cep?: string;
  telefone?: string;
  frete: number;
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

// Tipos para visualização (com joins)
export interface OrcamentoCompleto extends Orcamento {
  cliente: string;
  telefone?: string;
  moto: string;
  placa?: string;
  finalNumeroQuadro?: string;
  descricao?: string;
  frete: number;
  fotoMoto?: string; // URL da primeira foto do tipo "moto"
  endereco?: string;
  cep?: string;
  valorCobrado?: number;
  dataOrcamento?: Date;
}

export interface MotoCompleta extends Moto {
  cliente: string;
  status: "pendente" | "alinhando" | "concluido";
  progresso: number;
  fotos: string[];
}

