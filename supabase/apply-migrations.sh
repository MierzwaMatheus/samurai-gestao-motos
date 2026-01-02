#!/bin/bash

# Script para aplicar migrations no Supabase
# Uso: ./apply-migrations.sh [local|remote]

set -e

MODE=${1:-local}

if [ "$MODE" = "remote" ]; then
  echo "Aplicando migrations no projeto remoto..."
  npx supabase db push
elif [ "$MODE" = "local" ]; then
  echo "Aplicando migrations no projeto local..."
  echo "Certifique-se de que o Supabase está rodando (npx supabase start)"
  npx supabase migration up
else
  echo "Modo inválido. Use 'local' ou 'remote'"
  echo "Exemplo: ./apply-migrations.sh local"
  echo "Exemplo: ./apply-migrations.sh remote"
  exit 1
fi

echo "Migrations aplicadas com sucesso!"

