/**
 * Utilitários de CPF/CNPJ (campo opcional do cliente).
 *
 * - `validarCpfCnpj`: valida dígito verificador; vazio é válido.
 * - `formatarCpfCnpj`: máscara progressiva para o input, alternando
 *   CPF (11 dígitos) → CNPJ (14 dígitos) conforme o usuário digita.
 * - `mascararCpfCnpjParcial`: exibição na listagem revelando apenas os
 *   3 primeiros dígitos.
 */

const TAMANHO_CPF = 11;
const TAMANHO_CNPJ = 14;
const DIGITOS_VISIVEIS = 3;

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function todosDigitosIguais(digitos: string): boolean {
  return digitos.split("").every((d) => d === digitos[0]);
}

function digitoVerificador(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(digitos[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(digitos: string): boolean {
  const pesosPrimeiro = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosSegundo = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    digitoVerificador(digitos, pesosPrimeiro) === Number(digitos[9]) &&
    digitoVerificador(digitos, pesosSegundo) === Number(digitos[10])
  );
}

function cnpjValido(digitos: string): boolean {
  const pesosPrimeiro = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosSegundo = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    digitoVerificador(digitos, pesosPrimeiro) === Number(digitos[12]) &&
    digitoVerificador(digitos, pesosSegundo) === Number(digitos[13])
  );
}

export function validarCpfCnpj(valor: string | undefined | null): boolean {
  const digitos = apenasDigitos(valor ?? "");
  if (digitos.length === 0) return true;
  if (todosDigitosIguais(digitos)) return false;
  if (digitos.length === TAMANHO_CPF) return cpfValido(digitos);
  if (digitos.length === TAMANHO_CNPJ) return cnpjValido(digitos);
  return false;
}

function juntar(partes: string[], separador: string): string {
  return partes.filter((parte) => parte.length > 0).join(separador);
}

export function formatarCpfCnpj(valor: string | undefined | null): string {
  // Os recortes abaixo já descartam qualquer dígito além do limite do CNPJ.
  const digitos = apenasDigitos(valor ?? "");

  // Até 11 dígitos o usuário ainda pode estar digitando um CPF.
  if (digitos.length <= TAMANHO_CPF) {
    const corpo = juntar([digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 9)], ".");
    return juntar([corpo, digitos.slice(9, 11)], "-");
  }

  const corpo = juntar([digitos.slice(0, 2), digitos.slice(2, 5), digitos.slice(5, 8)], ".");
  const comFilial = juntar([corpo, digitos.slice(8, 12)], "/");
  return juntar([comFilial, digitos.slice(12, 14)], "-");
}

export function mascararCpfCnpjParcial(valor: string | undefined | null): string {
  const digitos = apenasDigitos(valor ?? "");
  const revelado =
    digitos.slice(0, DIGITOS_VISIVEIS) + "*".repeat(Math.max(0, digitos.length - DIGITOS_VISIVEIS));

  if (digitos.length !== TAMANHO_CPF && digitos.length !== TAMANHO_CNPJ) {
    return revelado;
  }

  // Reaplica a pontuação do documento sobre os caracteres já mascarados.
  let posicao = 0;
  return formatarCpfCnpj(digitos).replace(/\d/g, () => revelado[posicao++]);
}
