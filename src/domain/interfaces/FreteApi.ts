/**
 * Interface para serviços de cálculo de frete
 * Segue o princípio de Inversão de Dependência (DIP)
 */
export interface FreteApi {
  calcular(params: { cepDestino: string }): Promise<{
    distanciaKm: number;
    valorFrete: number;
    cepOrigem: string;
    cepDestino: string;
  }>;
}


