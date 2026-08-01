#!/usr/bin/env bash
# Roda testes E2E (Vitest) contra Supabase local.
# Análogo ao scripts/test-deno.sh: carrega env do `supabase status`,
# carrega nvm, e ativa o grupo `docker` se a sessão não o tiver.
#
# Pré-requisito: stack local rodando (`pnpm sup:start`) e seed.sql aplicado
# (o teste setup injeta o seed automaticamente; se preferir, rode
# `pnpm sup:db:reset` antes para começar de um estado limpo).
#
# Uso: pnpm test:e2e [-- <args extra para vitest>]

set -euo pipefail

# Wrapper: roda comando com docker group ativo + nvm carregado.
# `sg docker -c` cria shell sem .bashrc, então precisamos carregar nvm
# explicitamente pra ter `supabase` no PATH.
run_with_docker_group() {
  local cmd_str
  cmd_str="$(printf '%q ' "$@")"

  if groups 2>/dev/null | grep -q '\bdocker\b'; then
    "$@"
  else
    # shellcheck disable=SC2086
    sg docker -c "[ -s \"\$HOME/.nvm/nvm.sh\" ] && . \"\$HOME/.nvm/nvm.sh\" >/dev/null 2>&1; nvm use 22 >/dev/null 2>&1; $cmd_str"
  fi
}

STATUS_JSON="$(run_with_docker_group sh -c 'cd "$(git worktree list --porcelain | grep -m1 "^worktree " | sed "s/^worktree //")" && supabase status --output json' 2>/dev/null)" || {
  echo "❌ Falha ao rodar 'supabase status'. 'supabase start' está rodando?"
  exit 1
}

# Extrai e repassa vars esperadas pelos testes E2E.
export SUPABASE_URL="$(printf '%s' "$STATUS_JSON" | grep -oE '"API_URL":\s*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')"
export SUPABASE_ANON_KEY="$(printf '%s' "$STATUS_JSON" | grep -oE '"ANON_KEY":\s*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')"
export SUPABASE_SERVICE_ROLE_KEY="$(printf '%s' "$STATUS_JSON" | grep -oE '"SERVICE_ROLE_KEY":\s*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')"

: "${SUPABASE_URL:?SUPABASE_URL não definido}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY não definido}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY não definido}"

echo "✅ Env carregado: SUPABASE_URL=$SUPABASE_URL"

# Repassa args extras pro vitest (ex.: scripts/test-e2e.sh --run --reporter=verbose)
exec pnpm vitest run --config tests/e2e/vitest.config.ts "$@"
