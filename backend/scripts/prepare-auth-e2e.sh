#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/neurecore_e2e?schema=public}"
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export JWT_SECRET="${JWT_SECRET:-neurecore-auth-e2e-secret-min-32-chars}"
export SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-noreply@neurecore.ai}"
export SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-Admin@2026!}"
export OPENCLAW_API_KEY="${OPENCLAW_API_KEY:-e2e-openclaw-placeholder}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-e2e-openai-placeholder}"
export MINIMAX_API_KEY="${MINIMAX_API_KEY:-e2e-minimax-placeholder}"
export DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-e2e-deepseek-placeholder}"
export MIMO_API_KEY="${MIMO_API_KEY:-e2e-mimo-placeholder}"

cd "$BACKEND_DIR"

pnpm exec prisma generate
printf 'CREATE EXTENSION IF NOT EXISTS vector;' | pnpm exec prisma db execute --stdin --schema ./prisma/schema.prisma
pnpm exec prisma db push --accept-data-loss --skip-generate
pnpm seed:admin -- "$SUPERADMIN_EMAIL" "$SUPERADMIN_PASSWORD"