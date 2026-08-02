#!/usr/bin/env bash
#
# rollback.sh — one-command rollback for Service Gateway V2.
#
# Phase 8 (NC-AWL-IMP-1 §11.3). Idempotent. Safe to run repeatedly.
#
# What it does:
#   1. Sets CHAT_USE_SERVICE_GATEWAY_V2=false in the .env file (process
#      kill switch). The backend reads this on the next boot; the
#      ServiceGatewayFlagsService also has an in-memory flag that can
#      be flipped via the admin endpoint, but the env file is the
#      authoritative "this is off" signal that survives a restart.
#   2. Sets every SERVICE_GATEWAY_V2_PHASE_* env var to false.
#   3. Sets every SERVICE_GATEWAY_V2_CHANNEL_* env var to false.
#   4. Prints "ROLLBACK OK" and a structured summary of what changed.
#
# Usage:
#   ./backend/src/modules/service-gateway-v2/rollout/rollback.sh
#   ./backend/src/modules/service-gateway-v2/rollout/rollback.sh /path/to/.env
#
# Exit codes:
#   0  rollback succeeded (or was already in rollback state)
#   1  rollback failed (env file not writable, etc.)
#
# The script is intentionally simple and uses only `grep` + `sed` so
# it has no npm/node dependency. It is safe to call from a CI step,
# a cron, or a server-side webhook.

set -euo pipefail

ENV_FILE="${1:-backend/.env}"

if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "WARN: no .env file found at $ENV_FILE; creating one" >&2
  touch "$ENV_FILE"
fi

PHASE_KEYS=(
  "SERVICE_GATEWAY_V2_PHASE_READ"
  "SERVICE_GATEWAY_V2_PHASE_MUTATE"
  "SERVICE_GATEWAY_V2_PHASE_RECOMMEND"
  "SERVICE_GATEWAY_V2_PHASE_CHANNELS"
  "SERVICE_GATEWAY_V2_PHASE_AGENT_BUILDER"
  "SERVICE_GATEWAY_V2_PHASE_MODEL"
)

CHANNEL_KEYS=(
  "SERVICE_GATEWAY_V2_CHANNEL_WEBCHAT"
  "SERVICE_GATEWAY_V2_CHANNEL_EMAIL"
  "SERVICE_GATEWAY_V2_CHANNEL_CALENDAR"
  "SERVICE_GATEWAY_V2_CHANNEL_CRM"
  "SERVICE_GATEWAY_V2_CHANNEL_BREVO"
)

set_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # In-place replace. -i behaves differently on macOS BSD sed vs
    # Linux GNU sed, so we write to a temp file and atomically rename.
    local tmp
    tmp=$(mktemp)
    sed -E "s|^${key}=.*$|${key}=${value}|" "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

CHANGED=0

set_env "CHAT_USE_SERVICE_GATEWAY_V2" "false"
CHANGED=$((CHANGED + 1))

for k in "${PHASE_KEYS[@]}"; do
  set_env "$k" "false"
  CHANGED=$((CHANGED + 1))
done

for k in "${CHANNEL_KEYS[@]}"; do
  set_env "$k" "false"
  CHANGED=$((CHANGED + 1))
done

echo "ROLLBACK OK"
echo "  env_file: $ENV_FILE"
echo "  keys_updated: $CHANGED"
echo "  next_step: restart the backend (pm2 restart api) so the env is re-read"
