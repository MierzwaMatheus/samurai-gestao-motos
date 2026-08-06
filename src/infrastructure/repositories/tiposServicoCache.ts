import { supabase } from "@/infrastructure/supabase/client";

/**
 * Cache singleton para `tipos_servico` no `useMotosOficina`.
 *
 * Issue #17: o hook `useMotosOficina` é instanciado 2 vezes por
 * página (Em Andamento + Concluidos). Cada instância chama
 * `buscarPagina` independentemente — e cada `buscarPagina` faz sua
 * própria query `tipos_servico?id=in.(...)` pros IDs daquela aba.
 * Quando o usuário tem 2 abas abertas, são 2 queries consecutivas
 * com IDs parcialmente sobrepostos. Aqui a cache compartilhada
 * deduplica: se um ID já foi assinado, reusa; senão, bate no
 * SupabaseStorage API e acumula.
 *
 * Estratégia:
 *  - `getByIds(ids)` recebe a lista de IDs que o caller precisa.
 *  - Retorna `{ found, missing }` onde `found` são os tipos
 *    já cacheados e `missing` são os IDs que precisam ser
 *    buscados (delta).
 *  - Caller faz 1 query só com `missing`, depois `cache.add(...)`
 *    para os novos.
 *
 * Invalidação: cache cresce monotonamente. Tipos_servico mudam
 * raramente (CRUD admin). Pra simplicidade, sem TTL — próximo
 * hot-reload ou refresh de página recarrega.
 */
type TipoServicoRow = {
  id: string;
  nome: string;
  preco_oficina: string | null;
  preco_particular: string | null;
  categoria: string | null;
  preco_oficina_com_oleo: string | null;
  preco_oficina_sem_oleo: string | null;
  preco_particular_com_oleo: string | null;
  preco_particular_sem_oleo: string | null;
  quantidade_servicos: number | null;
  criado_em: string;
  atualizado_em: string;
};

class TiposServicoCache {
  private cache = new Map<string, TipoServicoRow>();

  /**
   * Particiona `ids` em `found` (já cacheados) e `missing` (fresh).
   */
  getByIds(ids: string[]): { found: TipoServicoRow[]; missing: string[] } {
    const found: TipoServicoRow[] = [];
    const missing: string[] = [];
    for (const id of ids) {
      const cached = this.cache.get(id);
      if (cached) {
        found.push(cached);
      } else {
        missing.push(id);
      }
    }
    return { found, missing };
  }

  add(rows: TipoServicoRow[]): void {
    for (const row of rows) {
      this.cache.set(row.id, row);
    }
  }

  /** Força limpeza do cache. Usar apenas em testes. */
  _clear(): void {
    this.cache.clear();
  }
}

export const tiposServicoCache = new TiposServicoCache();

/**
 * Helper para o `buscarPagina` usar o cache.
 * Retorna os tipos_servico (já cacheados quando possível) dado
 * um array de IDs. Faz no máximo 1 chamada ao Supabase pro delta.
 */
export async function tiposServicoByIdsCached(
  ids: string[]
): Promise<{ data: TipoServicoRow[]; error: { message: string } | null }> {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const { found, missing } = tiposServicoCache.getByIds(ids);

  if (missing.length === 0) {
    return { data: found, error: null };
  }

  const { data, error } = await supabase
    .from("tipos_servico")
    // Não inclui `valor` — a tabela `tipos_servico` NÃO tem essa coluna
    // (só `preco_oficina` e `preco_particular`). O legacy `?? valor ??`
    // no SupabaseTipoServicoRepository.mapToTipoServico era uma
    // fallback para dados antigos exportados de outro lugar.
    .select(
      "id,nome,preco_oficina,preco_particular,categoria,preco_oficina_com_oleo,preco_oficina_sem_oleo,preco_particular_com_oleo,preco_particular_sem_oleo,quantidade_servicos,criado_em,atualizado_em"
    )
    .in("id", missing);

  if (error) {
    return { data: found, error: { message: error.message } };
  }

  const fresh = (data || []) as TipoServicoRow[];
  tiposServicoCache.add(fresh);

  return { data: [...found, ...fresh], error: null };
}
