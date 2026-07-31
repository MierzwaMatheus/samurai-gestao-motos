import type {
  ImageTransformOptions,
  TipoFoto,
} from "@/domain/interfaces/StorageApi";

/**
 * Mapeia o tipo da foto para o conjunto de opções de Image Transformations
 * que o Supabase aplica ao servir a URL assinada.
 *
 * Convenções (decorrem dos layouts de galeria em uso):
 * - `moto`   → grid 3×3 com 96 px visíveis, precisa de cover para preencher
 *              o frame quadrado; reduce ~10× o tamanho do payload.
 * - `status` → mesmo grid 3×3, mas como o card aceita a forma original da
 *              imagem, dispensamos `height`/`resize` (recorta menos).
 * - `documento` → devolvemos `undefined` para preservar o original.
 *
 * Decisão importante sobre `format`: a API do Supabase aceita **apenas**
 * `"origin"` nesse campo, cujo efeito é *desligar* a otimização. O WebP
 * é servido **automaticamente** quando `format` é omitido. Por isso
 * nenhum dos objetos retornados inclui `format` — omitir é o que entrega
 * WebP.
 *
 * Qualquer valor fora do union (string vazia, case-different, lixo)
 * devolve `undefined` como fallback seguro — o caller simplesmente não
 * aplica transformação.
 */
export function transformPorTipo(
  tipo: TipoFoto | string
): ImageTransformOptions | undefined {
  switch (tipo) {
    case "moto":
      return {
        width: 400,
        height: 400,
        resize: "cover",
        quality: 70,
      };
    case "status":
      return {
        width: 400,
        quality: 70,
      };
    case "documento":
      return undefined;
    default:
      return undefined;
  }
}
