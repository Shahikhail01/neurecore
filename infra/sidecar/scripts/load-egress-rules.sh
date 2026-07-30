#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NFT_FILE="$SCRIPT_DIR/../nftables-hermes.nft"
TABLE="hermes_sidecar_egress"
PROVIDERS=(api.openai.com api.anthropic.com api.minimax.io api.deepseek.com)

if [[ $EUID -ne 0 ]]; then
    echo "FATAL: nftables loading requires root" >&2
    exit 1
fi
command -v nft >/dev/null
getent passwd hermes-sidecar >/dev/null
test -f "$NFT_FILE"

# Parse before replacing the active rules. The UID guard makes this table
# inert for every process except the dedicated sidecar account.
nft -c -f "$NFT_FILE"
nft delete table inet "$TABLE" 2>/dev/null || true
nft -f "$NFT_FILE"

provider_addresses=()
for provider in "${PROVIDERS[@]}"; do
    # CDN-backed provider hostnames can rotate between resolver calls. Sample
    # a bounded pool before atomically loading the set so the next TLS lookup
    # cannot immediately select a different approved edge.
    while read -r address; do
        [[ -n "$address" ]] && provider_addresses+=("$address")
    done < <(
        for _ in $(seq 1 20); do
            getent ahostsv4 "$provider" | awk '{print $1}'
            sleep 0.1
        done | sort -u
    )
done
if [[ ${#provider_addresses[@]} -eq 0 ]]; then
    nft delete table inet "$TABLE"
    echo "FATAL: no approved model-provider addresses resolved" >&2
    exit 1
fi

addresses=$(printf '%s\n' "${provider_addresses[@]}" | sort -u | paste -sd, -)
nft add element inet "$TABLE" model_provider_ipv4 "{ $addresses }"

nft list table inet "$TABLE" | grep -q 'skuid'

if runuser -u hermes-sidecar -- timeout 2 bash -c \
    'exec 3<>/dev/tcp/127.0.0.1/5432' 2>/dev/null; then
    echo "FATAL: sidecar UID reached forbidden PostgreSQL port" >&2
    exit 1
fi
echo "OK: UID-scoped Hermes egress policy loaded"
