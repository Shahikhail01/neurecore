# Contabo Ops

> Production runtime on the Contabo VPS (`109.123.248.253`). Last refreshed: 2026-07-31.

---

## 1. Host

- **Provider:** Contabo VPS
- **IP:** `109.123.248.253`
- **SSH alias (local):** `contabo` (root key-based; set up via
  `scripts/setup_contabo_key.sh`)
- **Deploy root:** `/opt/neurecore`

## 2. Service layout (PM2)

`scripts/contabo/ecosystem.config.js` is the single source of truth for the
4 PM2-managed services:

| Process | cwd | Script | Port | Notes |
|---|---|---|---|---|
| `neurecore-backend` | `/opt/neurecore/backend/backend` | `./dist/src/main.js` | 3003 | NestJS prod build |
| `neurecore-tenant` | `/opt/neurecore/frontend-tenant` | `./start.sh` | 3001 | Next.js prod |
| `neurecore-admin` | `/opt/neurecore/frontend-admin` | `./start.sh` | 3020 | Next.js prod |
| `neurecore-cors-proxy` | `/opt/neurecore` | `./cors-proxy.js` | 3004 | Custom CORS + Socket.IO shim |

PM2 lives at `/root/.pm2/`. Logs in `/root/.pm2/logs/`.

### 2.1 Reload
```bash
pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
```

### 2.2 Add a new process
Edit `scripts/contabo/ecosystem.config.js` locally, deploy, then `startOrReload`.
Do not start ad-hoc pm2 processes — the file must be the source of truth so
restarts are reproducible.

### 2.3 start.sh wrappers (frontend-tenant, frontend-admin)
Both `start.sh` scripts do:
```bash
cd /opt/neurecore/frontend-<name>
exec ./node_modules/.bin/next start --hostname 127.0.0.1 --port <port>
```
The hostname is `127.0.0.1` because external traffic goes through the CORS
proxy at `127.0.0.1:3004` (and TLS termination happens at LiteSpeed).

`scripts/deploy.sh` validates the port literal in each `start.sh` matches the
expected value (3001 / 3020) before rsyncing.

## 3. Domains & TLS

LiteSpeed terminates TLS at the edge. Domains routed:

| Domain | Maps to | Purpose |
|---|---|---|
| `https://brain.neurecore.com` | `/api/*` → CORS proxy → `:3003` | Backend API + Swagger + docs |
| `https://hq.neurecore.com` | `/` → CORS proxy → `:3001` | Tenant portal |
| `https://cc.neurecore.com` | `/` → CORS proxy → `:3020` | Admin portal |
| `https://eaos.neurecore.com` | (alt for backend in proxy allow-list) | Alternate API host |

### 3.1 CORS proxy — `scripts/contabo/cors-proxy.js`
A small Node HTTP server on `127.0.0.1:3004` that:
- Forwards all `/api/*` and frontend traffic to `127.0.0.1:3003` (backend).
- Echoes the `Origin` in `Access-Control-Allow-Origin` only if it's in the
  allow-list (so cookie credentials work).
- Strips any conflicting `Access-Control-*` headers from the upstream
  response so the proxy is the sole CORS authority.
- **Socket.IO shim (SIM-04 G-10):** handles `/socket.io/?EIO=4&transport=polling`
  by forwarding to NestJS, replies `400` to WebSocket upgrade requests
  (no `ws` package installed — out of scope), and `200` to bare probes.
- Handles `OPTIONS` preflight without hitting NestJS.

Allowed origins in proxy:
```
http://localhost:3001, http://localhost:3002, http://localhost:3005,
http://localhost:3011, http://localhost:3020,
http://127.0.0.1:3001, ..., (same set with 127.0.0.1),
https://hq.neurecore.com, https://cc.neurecore.com,
https://brain.neurecore.com, https://eaos.neurecore.com
```

Allowed headers (echoed to NestJS):
`Content-Type, Authorization, X-Correlation-ID, X-CSRF-Token, X-Tenant-ID, Idempotency-Key`.

## 4. Filesystem layout on Contabo

```
/opt/neurecore/
├── backend/backend/                 ← rsync target for backend/
│   ├── dist/src/main.js
│   ├── node_modules/  (or shared via symlink)
│   ├── .env           (symlink to /opt/neurecore/backend/backend/shared/.env if present)
│   ├── RELEASES_MANIFEST.json
│   └── releases/<id>/  (atomic deploy targets)
├── frontend-tenant/
│   ├── .next/
│   ├── node_modules/
│   ├── start.sh
│   └── package.json
├── frontend-admin/
│   ├── .next/
│   ├── node_modules/
│   ├── start.sh
│   └── package.json
├── cors-proxy.js
└── ecosystem.config.js

/opt/neurecore/apps/<app>/releases/<id>/   ← per-app atomic deploys
/opt/neurecore/apps/<app>/current          ← symlink to active release
/opt/neurecore/apps/<app>/shared           ← shared env + node_modules
```

## 5. Process supervision

- `pm2 startup` is configured to resurrect processes on reboot.
- `pm2 save` after every reload.
- `max_memory_restart`:
  - backend: 512M
  - tenant:  512M
  - admin:   512M
  - cors-proxy: 128M

## 6. Cron / maintenance

- DB backups: see `memory-bank-arc/disaster-recovery.md` (verify before
  relying).
- `pm2 logrotate` (if installed) for log files.

## 7. SSH + access

- Local SSH alias `contabo` uses `~/.ssh/config` key-based auth.
- `scripts/connect_contabo.sh` opens an interactive session.
- `scripts/setup_contabo_key.sh` is the bootstrap installer.
- `scripts/store_admin_password.sh` and `scripts/get_admin_password.sh` —
  convenience for fetching the seeded SUPER_ADMIN password.

## 8. Files staged from repo to Contabo

`scripts/deploy.sh` rsyncs (per app):
```
EXCLUDES:
  --exclude=node_modules
  --exclude=.next
  --exclude=dist
  --exclude=coverage
  --exclude=.jest-cache
  --exclude=test
  --exclude=.env
  --exclude=.env.production
  --exclude=.env.local
  --exclude=tsconfig.tsbuildinfo
  --exclude=.git
```
With `--delete-after` so partial syncs don't delete first.

## 9. Domain-specific checks

### 9.1 Health probes
```bash
curl -sk https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w 'hq %{http_code}\n' https://hq.neurecore.com/
curl -sk -o /dev/null -w 'cc %{http_code}\n' https://cc.neurecore.com/
```

### 9.2 Socket.IO
The proxy requires `?EIO=4&transport=polling`. Direct WebSocket upgrade
returns `400 Transport unknown` — this is by design (no `ws` package
installed in the proxy).

## 10. Source pointers

- `scripts/contabo/ecosystem.config.js`
- `scripts/contabo/cors-proxy.js`
- `scripts/deploy.sh`
- `scripts/connect_contabo.sh`, `scripts/setup_contabo_key.sh`
- `scripts/store_admin_password.sh`, `scripts/get_admin_password.sh`
- `frontend-tenant/start.sh`, `frontend-admin/start.sh`
- `backend/scripts/di-boot-gate.js` (run by deploy during DI gate)
- `infra/sidecar/systemd/` — Python sidecar systemd units