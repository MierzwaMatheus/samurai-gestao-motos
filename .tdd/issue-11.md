---
issue: 11
convex: false
overrides: ""
base_commit: b936d4de851db3e4ee106a9bee1468ed3e84efac
---

# Plano TDD — Issue #11: [perf] Paginação com scroll infinito nas abas Orçamentos e Oficina (reduzir egress ~70%)

## Contexto

- Branch: `feat/issue-11-paginar-cards-orcamento-oficina` (criar antes do ciclo 1).
- Modo padrão (sem Convex).
- Não existe `e2e/` nem `playwright.config.ts` — o ciclo 10 cria a estrutura.
- Padrão de mock do supabase já estabelecido em `SupabaseOrcamentoRepository.test.ts` (dispatcher por nome de tabela).
- `useRelatorios` e `SupabaseRelatorioRepository` ficam **fora** do escopo (issue #4 já trata).

## Ciclos

- [x] 1. Interface `buscarPagina()` em `OrcamentoRepository`
  - O que: assinatura `buscarPagina({ page, pageSize, status }) => { items, total, page, pageSize }` com tipo `Pagina<T>` reaproveitável.
  - Como: estender interface; a quebra de compilação em `SupabaseOrcamentoRepository` é o "red" via TS.
  - Arquivos: `src/domain/interfaces/OrcamentoRepository.ts`

- [x] 2. Implementação `buscarPagina()` em `SupabaseOrcamentoRepository`
  - O que: query paginada com `.range(from, to)` + `.order()` **antes** do `.limit()` + `count: 'exact', head: true` para `total`; batch `IN (...)` para clientes/motos/fotos/tiposServico (elimina N+1).
  - Como: TDD com mocks do supabase (mesmo padrão de `SupabaseOrcamentoRepository.test.ts`). Testes verificam: `.range(from, to)` chamado com argumentos corretos, `count: 'exact', head: true` é enviado, batch com `.in('id', clienteIdsValidos)` em vez de `Promise.all(...map(loop))`.
  - Arquivos: `src/infrastructure/repositories/SupabaseOrcamentoRepository.ts`, `src/infrastructure/repositories/SupabaseOrcamentoRepository.test.ts`

- [ ] 3. Interface `buscarPagina()` em `EntradaRepository`
  - O que: assinatura `buscarPagina({ page, pageSize, tipo?, statusEntrega?: string[], busca? }) => { items, total, page, pageSize }` com filtros server-side já na assinatura.
  - Como: estender interface; `SupabaseEntradaRepository` quebra (red via TS).
  - Arquivos: `src/domain/interfaces/EntradaRepository.ts`

- [ ] 4. Implementação `buscarPagina()` em `SupabaseEntradaRepository`
  - O que: `.range()` + `.order()` + filtros (`.eq('tipo', ...)`, `.in('status_entrega', [...])`, `.or(...)` para busca por modelo/placa/cliente/serviço). `count: 'exact', head: true` para `total`.
  - Como: TDD novo (`SupabaseEntradaRepository.test.ts` não existe ainda). Testes verificam: filtros aplicados, `.or()` gerado quando `busca` é informada, `count: 'exact', head: true` é enviado.
  - Arquivos: `src/infrastructure/repositories/SupabaseEntradaRepository.ts`, `src/infrastructure/repositories/SupabaseEntradaRepository.test.ts` (novo)

- [ ] 5. Hook `useOrcamentos` paginado + remoção re-busca duplicada
  - O que: `(orcamentoRepo, status, tipoServicoRepo?, servicoPersonalizadoRepo?, { page, pageSize=10 })` → `{ orcamentos, total, hasMore, loading, error, carregarMais, recarregar, atualizarOrcamento, removerOrcamento }`. **Remove** a re-busca de `tiposServico` em `useOrcamentos.ts:33-34` (já vem no `tiposServicoMap` do repo).
  - Como: TDD com `@testing-library/react` + mock dos repos. Testes verificam: (a) hook NÃO chama `tipoServicoRepo.buscarPorEntradaId` (bug do N+1 duplicado removido), (b) `carregarMais` incrementa `page` e concatena items, (c) `hasMore = orcamentos.length < total`.
  - Arquivos: `src/hooks/useOrcamentos.ts`, `src/hooks/useOrcamentos.test.ts` (novo)

- [ ] 6. Hook `useMotosOficina` paginado + busca server-side debounced 300ms
  - O que: `(entradaRepo, ...deps, { page, pageSize=10, busca? })` → `carregarMais` + `setBusca` (debounced 300ms) com reset automático de `page=1` ao mudar busca. **Mover** filtro de `tipo`/`status_entrega` para o repositório (não mais client-side).
  - Como: TDD com `vi.useFakeTimers()`. Testes verificam: (a) mudanças rápidas em `busca` colapsam em uma única request após 300ms, (b) mudar `busca` zera `page=1`, (c) `carregarMais` concatena.
  - Arquivos: `src/hooks/useMotosOficina.ts`, `src/hooks/useMotosOficina.test.ts` (novo)

- [x] 7. Hook `useInfiniteScroll` (IntersectionObserver)
  - O que: `(sentinelRef, { onIntersect, hasMore, loading, rootMargin? })` — dispara `onIntersect()` quando sentinel intersecta E `hasMore && !loading`; ignora se `!hasMore` ou `loading`.
  - Como: TDD mockando `IntersectionObserver` global no helper de teste. Testes verificam: (a) callback NÃO dispara se `!hasMore`, (b) callback NÃO dispara se `loading=true`, (c) `disconnect()` chamado no unmount.
  - Arquivos: `src/hooks/useInfiniteScroll.ts`, `src/hooks/useInfiniteScroll.test.ts` (novo)

- [x] 8. UI: `Orcamentos.tsx` com scroll infinito + contador + reset
  - O que: plugar `useInfiniteScroll` no sentinel do final da lista; exibir `Mostrando X de Y` discreto; resetar `page=1` ao trocar filtro Ativos/Expirados; ações (converter/deletar) preservam posição via `removerOrcamento` já existente.
  - Como: component test `@testing-library/react`. Testes: (a) primeira carga pede `pageSize=10`, (b) troca de filtro zera paginação e recarrega do zero, (c) scroll até o sentinel dispara `carregarMais`, (d) "Mostrando X de Y" reflete `orcamentos.length`/`total`.
  - Arquivos: `src/pages/Orcamentos.tsx`, `src/pages/Orcamentos.test.tsx` (novo)

- [ ] 9. UI: `Oficina.tsx` com scroll infinito + busca server-side + reset sub-aba
  - O que: plugar `useInfiniteScroll` em cada `TabsContent`; busca com debounce 300ms via `setBusca` do hook; contador "Mostrando X de Y" abaixo do input; reset ao trocar Em Andamento/Concluídos.
  - Como: component test. Testes: (a) digitar busca dispara 1 request após 300ms (debounce), (b) trocar aba zera paginação, (c) scroll dispara `carregarMais` em cada aba independentemente.
  - Arquivos: `src/pages/Oficina.tsx`, `src/pages/Oficina.test.tsx` (novo)

- [ ] 10. E2E Playwright contra Supabase local
  - O que: cobertura fim-a-fim — scroll dispara próxima página, busca funciona em qualquer ponto do scroll, filtro Ativos/Expirados reseta, refresh pós-ação preserva paginação. Seed pesado (200+ orçamentos, 80+ entradas) para validar ganho real.
  - Como: criar `playwright.config.ts`, `e2e/seed-pesado.ts`, `e2e/issue-11-paginacao.spec.ts`; rodar contra stack local via `pnpm sup:start` (já estabelecido).
  - Arquivos: `playwright.config.ts` (novo), `e2e/seed-pesado.ts` (novo), `e2e/issue-11-paginacao.spec.ts` (novo)
