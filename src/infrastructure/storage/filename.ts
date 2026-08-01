/**
 * Sanitização de filenames para uso em paths do Supabase Storage.
 *
 * O backend local (filesystem) e alguns provedores S3 podem rejeitar
 * paths com caracteres especiais (ex.: `~` em arquivos "0002~2.jpg"
 * gerados por backup/duplicação do Windows). Esta função substitui
 * qualquer caractere fora de `[a-zA-Z0-9._-]` por `_`, mantendo o
 * nome legível e seguro.
 *
 * Exemplos:
 *   sanitizeFilename("aizusu.cardozo-20250701-0002~2.jpg")
 *     === "aizusu.cardozo-20250701-0002_2.jpg"
 *   sanitizeFilename("foto com espaço & acento.jpg")
 *     === "foto_com_espa_o___acento.jpg"
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
