---
issue: 12
convex: false
overrides: ""
base_commit: b18dd5d57169d5695b94fb1fd52a1ec08ce7776d
---

# Plano TDD — Issue #12: Propagar thumbPath/fullPath do banco até UI em Oficina e Orçamentos

Continuação da #8 ([perf/storage] Pipeline thumb + full no upload). A pipeline de 2 variantes já está fechada, mas a aba Oficina e a aba Orçamentos continuam baixando a foto cheia (`url`) porque há pontos onde `thumbPath`/`fullPath` se perdem entre o banco e a UI.

## Ciclos

- [x] 1. `SupabaseEntradaRepository` propaga `thumb_path`/`full_path`
  - O que: query de fotos no `buscarPagina` (linha 245) carrega `thumb_path`/`full_path`; mappers `fotosStatus` (linhas 388-393), `mapToEntrada` (linhas 528-533) e serialização em `atualizar` (linhas 444-451) preservam ambos os campos. Fotos legadas (sem `thumb_path`) chegam com `thumbPath: null`/`fullPath: null` — fallback continua no `url`.
  - Como: alterar `.select("entrada_id, url")` → `.select("entrada_id, url, thumb_path, full_path")`; copiar os campos nos mappers. Testes em `SupabaseEntradaRepository.test.ts` com fixture mista (foto nova com thumb/full + foto legada sem thumb) cobrindo: (a) `fotosStatus[].thumbPath`/`fullPath` populados; (b) `mapToEntrada` lê thumb/full do JSONB; (c) `atualizar` regrava JSONB incluindo thumb/full. Referência: `SupabaseFotoRepository.mapToFoto` (linhas 143-153) já faz isso e serve de modelo.
  - Arquivos: `src/infrastructure/repositories/SupabaseEntradaRepository.ts`, `src/infrastructure/repositories/SupabaseEntradaRepository.test.ts`

- [x] 2. `SupabaseOrcamentoRepository` propaga `thumb_path`/`full_path`
  - O que: queries de fotos em `buscarCompletosPorStatus` (linhas 167-178) e `buscarPagina` (linhas 342-345) carregam `thumb_path`/`full_path`; mappers montam `Foto` com `thumbPath`/`fullPath` populados (assinando via `SupabaseStorageApi` quando o path é raw). `fotoMoto` continua sendo uma única `Foto` (primeira foto tipo `moto` da entrada). Fotos legadas caem no fallback `url`.
  - Como: testes em `SupabaseOrcamentoRepository.test.ts` com fixture mista (foto nova + foto legada) cobrindo os dois métodos (`buscarCompletosPorStatus` e `buscarPagina`). Validar: (a) select inclui `thumb_path`/`full_path`; (b) `fotosMapFinal`/`fotosMap` é indexado por entrada com `Foto` completa; (c) `fotoMoto` retornado carrega thumbPath/fullPath. Implementação: assinatura dos paths via `obterUrlAssinada` (padrão idêntico a `SupabaseFotoRepository.resolveSignedUrls`).
  - Arquivos: `src/infrastructure/repositories/SupabaseOrcamentoRepository.ts`, `src/infrastructure/repositories/SupabaseOrcamentoRepository.test.ts`

- [x] 3. `MotoCompleta.fotos` migra para `Foto[]` + `Oficina.tsx` consome
  - O que: `shared/types.ts` linha 209 `fotos: string[]` → `fotos: Foto[]`; `buscarPagina` do `SupabaseEntradaRepository` retorna `Foto[]` com `thumbPath`/`fullPath` (em vez de só a primeira URL); `Oficina.tsx` linhas 733-743 para de embrulhar `string` em `Foto` com `thumbPath: null`/`fullPath: null` — passa `Foto[]` direto para `GaleriaFotosMoto`.
  - Como: refatorar `fotosPorEntrada`/`fotosMap` (linhas 290-304) para guardar `Foto` por entrada (assinando thumb/full). Adicionar teste em `SupabaseEntradaRepository.test.ts` validando que `moto.fotos[0].thumbPath`/`fullPath` estão populados. Adicionar teste em `Oficina.test.tsx` com fixture mista (foto nova com thumb + foto legada) validando que `GaleriaFotosMoto` recebe `Foto[]` com thumbPath. `GaleriaFotosMoto` em si não muda (já consome `thumbPath ?? url`).
  - Arquivos: `shared/types.ts`, `src/infrastructure/repositories/SupabaseEntradaRepository.ts`, `src/infrastructure/repositories/SupabaseEntradaRepository.test.ts`, `src/pages/Oficina.tsx`, `src/pages/Oficina.test.tsx`

- [x] 4. `OrcamentoCompleto.fotoMoto` migra para `Foto` + `Orcamentos.tsx` consome
  - O que: `shared/types.ts` linha 184 `fotoMoto?: string` → `fotoMoto?: Foto`; o `SupabaseOrcamentoRepository` retorna `Foto` em `fotoMoto` (com `thumbPath`/`fullPath` calculados no ciclo 2); `Orcamentos.tsx` linhas 300-316 lê `fotoMoto.thumbPath ?? fotoMoto.url` no `src` do `<img>`. Fotos legadas caem no fallback `url`.
  - Como: testes em `SupabaseOrcamentoRepository.test.ts` validando que `orcamento.fotoMoto` tem shape `Foto` (com thumbPath/fullPath). Teste em `Orcamentos.test.tsx` validando que `src` aponta para thumb quando presente, ou para `url` em foto legada. Pode quebrar o fluxo "Cadastro → OS" se algum consumidor tratar `fotoMoto` como `string` — verificar antes de fechar o ciclo e ajustar onde precisar.
  - Arquivos: `shared/types.ts`, `src/infrastructure/repositories/SupabaseOrcamentoRepository.ts`, `src/infrastructure/repositories/SupabaseOrcamentoRepository.test.ts`, `src/pages/Orcamentos.tsx`, `src/pages/Orcamentos.test.tsx`

## Fora dos ciclos (gate final / pós-merge)

- Aplicar `supabase/migrations/24_split_foto_paths.sql` em local (`pnpm sup:db reset`) e prod (`supabase db push`).
- Medir egress ≥70% no Supabase Dashboard > Logs (acceptance criteria).
- Acceptance criteria já cobertos pelos testes existentes: PDF da OS (`GerarOSUseCase` já consome `fullPath ?? url`), busca server-side, paginação infinita, status, pagamentos.
- Componentes já corretos (não mexem): `GaleriaFotos`, `GaleriaFotosMoto`, `GerarOSUseCase`, `SupabaseFotoRepository` (referência).
