#!/usr/bin/env bash
# Roda testes Deno das Edge Functions contra Supabase local.
# Pré-requisito: `supabase start` rodando.
#
# Carrega SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY
# da saída de `supabase status --output json` e repassa ao `deno test`.
#
# Se o user atual não tem grupo `docker` ativo na sessão (comum em SSH/
# subshells), envolve os comandos em `sg docker -c '...'` para ativá-lo.

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

STATUS_JSON="$(run_with_docker_group supabase status --output json 2>/dev/null)" || {
  echo "❌ Falha ao rodar 'supabase status'. 'supabase start' está rodando?"
  exit 1
}

# Extrai e mapeia keys do JSON para os nomes esperados pelos testes
export SUPABASE_URL="$(printf '%s' "$STATUS_JSON" | grep -oE '"API_URL":\s*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')"
export SUPABASE_ANON_KEY="$(printf '%s' "$STATUS_JSON" | grep -oE '"ANON_KEY":\s*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')"
export SUPABASE_SERVICE_ROLE_KEY="$(printf '%s' "$STATUS_JSON" | grep -oE '"SERVICE_ROLE_KEY":\s*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')"

: "${SUPABASE_URL:?SUPABASE_URL não definido}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY não definido}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY não definido}"

echo "✅ Env carregado: SUPABASE_URL=$SUPABASE_URL"

# Usa deno instalado via script oficial (~/.deno/bin/deno) se existir,
# caso contrário usa do PATH
DENO_BIN="${HOME}/.deno/bin/deno"
if [ ! -x "$DENO_BIN" ]; then
  DENO_BIN="deno"
fi

# Filtra $@ ou usa "supabase/functions/" como default
TARGET="${1:-supabase/functions/}"

exec "$DENO_BIN" test --allow-all --no-check "$TARGET"