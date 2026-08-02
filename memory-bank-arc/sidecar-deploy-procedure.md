# Contabo Capability-Sidecar Deploy Procedure

**Document ID:** NC-DEPLOY-SIDECAR
**Date:** 2026-07-30
**Status:** ACTIVE
**Triggered by:** NC-ACCT-IMP-1 deploy of accounting-sidecar — discovered
that the docs in `contabo-ops.md` and `deployment.md` did not accurately
describe how sidecars are actually deployed on Contabo. This document
captures the real procedure, verified on 2026-07-30.

---

## Reality vs. docs (2026-07-30)

The existing `contabo-ops.md` and `deployment.md` describe **PM2-managed
processes only**. They do not describe how sidecars (Hermes, hermes-events-bridge,
accounting-sidecar) are actually deployed. **This document is the
authoritative reference for adding a new Python capability-sidecar.**

| Service | Process manager | Bind | Port | Started by |
|---|---|---|---|---|
| `neurecore-backend` (NestJS) | PM2 | `0.0.0.0:3003` | 3003 | `pm2 startOrReload` |
| `neurecore-tenant` (Next.js) | PM2 | `127.0.0.1:3001` | 3001 | `pm2 startOrReload` |
| `neurecore-admin` (Next.js) | PM2 | `127.0.0.1:3020` | 3020 | `pm2 startOrReload` |
| `neurecore-cors-proxy` | PM2 | `127.0.0.1:3004` | 3004 | `pm2 startOrReload` |
| `hermes-sidecar` (Python) | **systemd** | `127.0.0.1:8080` | 8080 | `systemctl enable --now hermes-sidecar` |
| `hermes-events-bridge` (Python) | **systemd** | `127.0.0.1:8082` | 8082 | `systemctl enable --now hermes-events-bridge` |
| **`accounting-sidecar`** (Python) | **systemd** | `127.0.0.1:8091` | 8091 | `systemctl enable --now accounting-sidecar` |
| `lscpd` (CyberPanel) | CyberPanel | `0.0.0.0:8090` | 8090 | system |
| `cookie-refresher`, `gfcportal`, `shahisoft-nextjs` | PM2 | various | various | `pm2` |

**Port 8090 is taken by CyberPanel — never use it for a sidecar.**
Use 8081, 8083, 8084, …, 8091, 8092 etc.

---

## Filesystem layout (Contabo)

```
/opt/neurecore/
├── backend/backend/                    # NestJS source + Prisma
│   ├── src/modules/accounting/          # NEW — NestJS AccountingModule (NC-ACCT-IMP-1)
│   ├── src/common/auth/_common/         # vendored TS shared auth libs
│   ├── prisma/schema.prisma             # + 8 new models for accounting
│   ├── prisma/migrations/20260730_acct_capability_init/migration.sql
│   ├── .env                             # + ACCOUNTING_SIDECAR_SECRET etc.
│   ├── .env.production                  # same
│   └── dist/                            # built by `nest build` on Contabo
├── infra/
│   ├── venv/                            # shared Python venv (all sidecars)
│   ├── _common/                         # shared Python auth libs (NC-ACCT-IMP-1)
│   ├── hermes/                          # vendored Hermes agent source
│   ├── hermes-sidecar/                  # Python sidecar (NC-AWL-IMP-2)
│   ├── hermes-events-bridge/            # signed event webhook receiver
│   ├── sidecar/                         # common sidecar helper library
│   └── accounting-sidecar/              # NEW — Python accounting sidecar (NC-ACCT-IMP-1)
├── frontend-tenant/                     # Next.js (hq.neurecore.com)
├── frontend-admin/                      # Next.js (cc.neurecore.com)
├── ecosystem.config.js                  # PM2 ecosystem
└── rebuild.sh                           # on-server rebuild script

/var/lib/neurecore/
├── hermes/                              # hermes-sidecar state dir
│   ├── events.db                        # SQLite
│   ├── state/
│   └── tenants/<uuid>/                  # per-tenant workspace
└── accounting/                          # NEW — accounting-sidecar state dir (NC-ACCT-IMP-1)
    └── snapshots/                       # per-tenant .beancount files (mmap'd by sidecar)

/etc/systemd/system/
├── hermes-sidecar.service               # NC-AWL-IMP-2
├── hermes-events-bridge.service         # NC-AWL-IMP-2
└── accounting-sidecar.service           # NEW — NC-ACCT-IMP-1
```

---

## Deploy procedure for a new Python capability-sidecar

### Step 1: Choose a free port

```bash
ssh contabo 'ss -tlnp | grep LISTEN'
# Pick a port NOT in the table above. Free candidates: 8081, 8083, 8084, 8091, 8092, 8093.
```

### Step 2: Sync source to Contabo

```bash
rsync -avz --delete-after -e ssh \
    --exclude='__pycache__' \
    --exclude='.pytest_cache' \
    --exclude='node_modules' \
    --exclude='*.pyc' \
    $LOCAL/neurecore/infra/accounting-sidecar/ \
    contabo:/opt/neurecore/infra/accounting-sidecar/

ssh contabo 'chown -R cyberpanel:cyberpanel /opt/neurecore/infra/accounting-sidecar'
```

Note: `deploy.sh` does NOT sync `infra/` — that is manual rsync. The
deploy.sh script only handles the 3 first-party services (backend + 2 frontends).

### Step 3: Install Python deps in shared venv

```bash
ssh contabo '/opt/neurecore/infra/venv/bin/pip install -q numpy-financial beancount pandas pytest httpx fastapi "uvicorn[standard]" pydantic pglast'
```

The shared venv at `/opt/neurecore/infra/venv/` is used by all sidecars.
Installing here makes the new deps available to hermes-sidecar too (harmless).

### Step 4: Create per-tenant workspace

```bash
ssh contabo '
install -d -o hermes-sidecar -g hermes-sidecar -m 0750 /var/lib/neurecore/<capability>
install -d -o hermes-sidecar -g hermes-sidecar -m 0750 /var/lib/neurecore/<capability>/snapshots
'
```

The capability-sidecar runs as user `hermes-sidecar` (uid 997, gid 987)
— same UID as Hermes, so nftables rules apply uniformly.

### Step 5: Generate HMAC secret and add to .env (BOTH files)

```bash
SECRET=$(openssl rand -hex 32)
echo "$SECRET" > /root/.accounting-secret

ssh contabo "
cat >> /opt/neurecore/backend/backend/.env <<EOF

# NC-ACCT-IMP-1 — Accounting Capability
ACCOUNTING_SIDECAR_URL=http://127.0.0.1:8091
ACCOUNTING_SIDECAR_SECRET=$SECRET
ACCOUNTING_SIDECAR_TOKEN_TTL_SECONDS=900
ACCOUNTING_SIDECAR_TIMEOUT_MS=30000
ACCOUNTING_SNAPSHOT_DIR=/var/lib/neurecore/accounting/snapshots
ACCOUNTING_SNAPSHOT_COALESCE_HZ=1
ACCOUNTING_MERKLE_WINDOW_SIZE=1000
EOF

cat >> /opt/neurecore/backend/backend/.env.production <<EOF

# NC-ACCT-IMP-1 — Accounting Capability
ACCOUNTING_SIDECAR_URL=http://127.0.0.1:8091
ACCOUNTING_SIDECAR_SECRET=$SECRET
ACCOUNTING_SIDECAR_TOKEN_TTL_SECONDS=900
ACCOUNTING_SIDECAR_TIMEOUT_MS=30000
ACCOUNTING_SNAPSHOT_DIR=/var/lib/neurecore/accounting/snapshots
ACCOUNTING_SNAPSHOT_COALESCE_HZ=1
ACCOUNTING_MERKLE_WINDOW_SIZE=1000
EOF
"
```

**Both `.env` AND `.env.production` must be set** — `ConfigurationModule`
loads `.env.production` first when `NODE_ENV=production`. Forgetting either
silently no-ops the corresponding env var.

### Step 6: Write systemd unit

Save to `/etc/systemd/system/<capability>-sidecar.service`. The
accounting-sidecar unit (verified working on 2026-07-30):

```ini
[Unit]
Description=NeureCore <Capability> Sidecar
After=network-online.target
Wants=network-online.target
StartLimitBurst=5
StartLimitIntervalSec=60s

[Service]
Type=simple
User=hermes-sidecar
Group=hermes-sidecar
WorkingDirectory=/opt/neurecore/infra/<capability>-sidecar
EnvironmentFile=/opt/neurecore/backend/backend/.env
Environment=PYTHONUNBUFFERED=1
Environment=<CAPABILITY>_SNAPSHOT_DIR=/var/lib/neurecore/<capability>/snapshots
RuntimeDirectory=<capability>-sidecar
RuntimeDirectoryMode=0750
StateDirectory=neurecore/<capability>
StateDirectoryMode=0750
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/neurecore/<capability>
ProtectHome=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
SystemCallArchitectures=native
MemoryMax=512M
CPUQuota=200%
TasksMax=64
LimitNOFILE=4096
ExecStart=/opt/neurecore/infra/venv/bin/python3 -m uvicorn <package>.main:app \
    --host 127.0.0.1 \
    --port <PORT> \
    --workers 1 \
    --log-level info
Restart=on-failure
RestartSec=5s
KillSignal=SIGTERM
TimeoutStopSec=15s
FinalKillSignal=SIGKILL

[Install]
WantedBy=multi-user.target
```

### Step 7: Enable and start

```bash
ssh contabo '
systemctl daemon-reload
systemctl reset-failed <capability>-sidecar  # in case of repeated-restart storms
systemctl enable --now <capability>-sidecar
systemctl is-active <capability>-sidecar
ss -tlnp | grep <PORT>
'
```

### Step 8: Smoke test

```bash
# Health
ssh contabo "curl -s http://127.0.0.1:<PORT>/healthz"

# Compute endpoint WITHOUT auth (must 401)
ssh contabo "curl -sw '\n%{http_code}\n' -X POST http://127.0.0.1:<PORT>/v1/compute/investment/npv -H 'Content-Type: application/json' -d '{\"rate\":0.1,\"cashflows\":[-1000,300,400,500]}'"

# With valid HMAC token (must 200)
TOKEN=$(ssh contabo "/opt/neurecore/infra/venv/bin/python3 -c '
import sys; sys.path.insert(0, \"/opt/neurecore/infra\")
from _common.scope_token import mint_for_test
print(mint_for_test(
    secret=\"$SECRET\",
    claims={\"sub\":\"smoke\",\"tenantId\":\"smoke\",\"executionId\":\"s\",\"workspacePath\":\"/\",\"allowedTools\":[],\"approvalThreshold\":\"NONE\"},
    scope=\"<capability>:execute\",
    ttl_seconds=300,
))'")
ssh contabo "curl -sw '\n%{http_code}\n' -X POST http://127.0.0.1:<PORT>/v1/compute/investment/npv \
  -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' \
  -d '{\"rate\":0.1,\"cashflows\":[-1000,300,400,500]}'"
```

### Step 9: NestJS integration

If the sidecar is gated by a new NestJS module, register it in
`backend/src/app.module.ts` and re-deploy the backend (see
`deployment.md` for `deploy.sh backend`).

Watch out for: the `@Controller()` decorator must use the OBJECT form
`{path: 'accounting', version: '1'}` — NOT `'api/v1/accounting'` —
because the app has a global prefix `api` (see `main.ts:112`). The
OBJECT form lets NestJS handle the version correctly.

---

## Rollback procedure

If the new sidecar crashes or behaves incorrectly:

```bash
ssh contabo '
systemctl stop <capability>-sidecar
systemctl disable <capability>-sidecar
'
```

The NestJS adapter (`HttpAccountingSidecarClient`) is **lazy** — it only
errors when an accounting route is called. So disabling the sidecar
does not crash the backend, but `/api/v1/accounting/*` routes will
return 502/503 instead.

To rollback the NestJS adapter too:

```bash
ssh contabo '
cd /opt/neurecore/backend/backend
git checkout HEAD~1 -- src/modules/accounting/
./node_modules/.bin/nest build
pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend
'
```

(Or use the rollback procedure in `disaster-recovery.md`.)

---

## Cert verification

The Accounting capability's A4/A8/A9/A10/A11 cert gates are verified
by `/opt/neurecore/scripts/accounting-cert-runner.py` on Contabo.

Run on Contabo:
```bash
python3 /opt/neurecore/scripts/accounting-cert-runner.py
```

Each gate is checked at the level available in this environment:

| Gate | Level | What it checks |
|---|---|---|
| A4 | DB | `journal_entries UNIQUE (tenantId, txnId)` constraint exists |
| A8 | Code + DB | `findByCode` + `resolveLeafAccountIds` scope by `tenantId` |
| A9 | DB | `journal_entries_sod_check` constraint |
| A10 | Code | `AccountingPeriodService.isPostable()` only returns true for OPEN/CLOSING |
| A11 | DB | `outbox_merkle_roots` table + UNIQUE on `rootHash` |

**Honest gap:** A8 and A9 cannot be verified at the HTTP level without
real tenant user credentials. The DB/code invariants above are what
the HTTP layer enforces.

---

## History


- **2026-07-30** — accounting-sidecar deployed (NC-ACCT-IMP-1 Phase 1). Verified end-to-end:
  - Migration `20260730_acct_capability_init` applied (9 new tables).
  - Backend rebuilt with `AccountingModule` registered.
  - Sidecar running on `127.0.0.1:8091`, auth-gated by HMAC token.
  - All `/api/v1/accounting/*` routes return 401 without auth, 401 with bad token.