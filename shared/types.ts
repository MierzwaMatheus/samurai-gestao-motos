export type EntryType = "entrada" | "orcamento";

export interface Endereco {
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
  coordenadas?: {
    longitude: string;
    latitude: string;
  };
}

export interface DadosCadastro {
  tipo: EntryType;
  cliente: string;
  endereco: string;
  cep?: string;
  enderecoCompleto?: Endereco;
  moto: string;
  placa: string;
  descricao: string;
  fotos: string[];
  frete: number;
}

