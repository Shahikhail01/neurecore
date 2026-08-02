# Runbook

> Operator runbook for the Contabo VPS and sidecars. Last refreshed: 2026-07-31.

If something is broken, start at §1 (status), then §2 (common ops), then
escalate to §3 (sidecar) or §4 (deploy recovery). §5 covers the Phase 9
certification gate. §6 is "kill switches".

---

## 1. Status checks (run these first)

```bash
# PM2 processes
pm2 list
pm2 jlist | jq '.[] | {name, pm2_env.status, monit.memory, monit.cpu}'

# Per-process logs (tail)
pm2 logs neurecore-backend --lines 100 --nostream
pm2 logs neurecore-tenant --lines 100 --nostream
pm2 logs neurecore-admin --lines 100 --nostream
pm2 logs neurecore-cors-proxy --lines 100 --nostream

# Health endpoints
curl -sk https://brain.neurecore.com/api/v1/health
curl -sk https://brain.neurecore.com/api/v1/health/ready
curl -sk https://brain.neurecore.com/api/v1/health/live
curl -sk -o /dev/null -w 'hq %{http_code}\n' https://hq.neurecore.com/
curl -sk -o /dev/null -w 'cc %{http_code}\n' https://cc.neurecore.com/

# Backend logs (structured)
journalctl -u neurecore-backend --since "1 hour ago"   # if systemd also manages backend

# Sidecar (Python) status
systemctl status hermes-sidecar
systemctl status accounting-sidecar
journalctl -u hermes-sidecar -f
journalctl -u accounting-sidecar -f

# Disk + memory
df -h /opt
free -h
```

### 1.1 Expected outputs
- `/api/v1/health` → `200 {"status":"ok"}`.
- `/api/v1/health/ready` → `200` (DB + Redis reachable).
- `/api/v1/health/live` → `200` (process alive).
- PM2 statuses all `online`; memory under `max_memory_restart`.

### 1.2 Red flags
- `status: "error"` in health response → backend booting issue, check
  `pm2 logs neurecore-backend`.
- Any PM2 process `errored` or `restarting` in a loop → check logs.
- Disk > 80% on `/opt` → check `releases/` retention (should auto-prune
  to last 5).
- `403 CSRF_TOKEN_MISSING` flooding logs → FE misconfigured; see
  `auth.md`.

---

## 2. Common operations

### 2.1 Restart a service
```bash
pm2 restart neurecore-backend
pm2 restart neurecore-tenant
pm2 restart neurecore-admin
pm2 restart neurecore-cors-proxy
```

If a config change was made to `ecosystem.config.js`:
```bash
pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
```

### 2.2 Re-read env after env edit
The `.env` is symlinked into the active release. Restart the process to
re-read:
```bash
pm2 restart neurecore-backend
```

### 2.3 Tail logs without flooding
```bash
pm2 logs neurecore-backend --lines 200 --nostream
pm2 flush  # careful: this empties all logs
```

### 2.4 Add memory to a process
Edit `scripts/contabo/ecosystem.config.js`, then:
```bash
pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
```

### 2.5 Pull current SUPER_ADMIN password
```bash
bash /opt/neurecore/scripts/get_admin_password.sh
# (also available as scripts/get_admin_password.sh locally after deploy)
```

### 2.6 Manual DB migration
```bash
ssh contabo
cd /opt/neurecore/backend/backend
./node_modules/.bin/prisma migrate deploy
```
Or rely on the atomic deploy script which does this with retries.

---

## 3. Sidecar operations

### 3.1 Restart the sidecar
```bash
systemctl restart hermes-sidecar
systemctl restart accounting-sidecar
```

### 3.2 Tail sidecar logs
```bash
journalctl -u hermes-sidecar -f
journalctl -u accounting-sidecar -f
```

### 3.3 Verify sidecar is reachable from NestJS
The CORS proxy / NestJS does not talk to the sidecar directly — it talks
to a Python service at a known URL. Check the sidecar is bound:
```bash
systemctl status hermes-sidecar
ss -lntp | grep hermes
```

### 3.4 Rotate the sidecar shared HMAC secret
- Stored in `/opt/neurecore/hermes/shared_secret` (or env).
- Update both `_common/scope_token.py` config and NestJS
  `AccountingTokenService`.
- Restart both sides in a coordinated way to avoid 401 storms.

### 3.5 Snapshot regeneration (accounting)
`BeancountSnapshotService` regenerates on every ledger write. If the
sidecar returns `503 snapshot_not_ready`, NestJS regenerates synchronously.
No operator action needed.

---

## 4. Deploy recovery

### 4.1 Bad deploy — rollback
```bash
ssh contabo
cd /opt/neurecore/apps/backend
ls -lt releases/ | head   # find previous release
ln -sfn releases/<previous-id> current
pm2 reload neurecore-backend --update-env
curl -sk https://brain.neurecore.com/api/v1/health
```

For frontend apps:
```bash
cd /opt/neurecore/apps/frontend-tenant   # or admin
ln -sfn releases/<previous-id> current
pm2 reload neurecore-tenant --update-env
# or pm2 reload neurecore-admin
```

### 4.2 Lockfile drift on Contabo
```bash
ssh contabo
cd /opt/neurecore/backend/backend
./node_modules/.bin/pnpm install --no-frozen-lockfile
# then commit the regenerated lockfile locally and push a normal deploy.
```

### 4.3 Stuck migration
The atomic deploy retries 5x with backoff (2^n). If it still fails:
```bash
ssh contabo
cd /opt/neurecore/apps/backend/current
./node_modules/.bin/prisma migrate status
# Inspect prisma_migrations._prisma_migrations table for failures.
# Resolve manually, then re-run prisma migrate deploy.
```

### 4.4 Backend won't boot — DI error
```bash
ssh contabo
cd /opt/neurecore/apps/backend/current
node scripts/di-boot-gate.js   # mirrors what the deploy script checks
pm2 logs neurecore-backend --lines 200 --nostream
```
Common causes: missing module, circular dep introduced in the new code.

### 4.5 Rebuild from scratch
```bash
ssh contabo
cd /opt/neurecore/apps/backend/current
./node_modules/.bin/pnpm install --frozen-lockfile
./node_modules/.bin/nest build
pm2 restart neurecore-backend
```

---

## 5. Phase 9 certification gate

The 105-scenario matrix is run locally:
```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
pnpm certify:phase9:all
```

Outputs land in `backend/src/test/certification/reports/`:
- `g9-machine-readable.json` — raw `CertificationRun`.
- `g9-summary.json` — flat G9 gate summary.
- `g9-dashboard.html` — operator-friendly dashboard.

### 5.1 Verdict
- `gateG9` in the JSON: `APPROVED` or `BLOCKED`.
- If `BLOCKED`, the dashboard surfaces the failing rules + scenarios.
- Investigate the specific scenario that failed and the rule it
  violated; cross-reference the relevant module + invariant.

### 5.2 Thresholds (NC-AWL-IMP-1 §11.5)
- 100% critical-path pass rate.
- Zero duplicate effects.
- Zero cross-tenant exposure.
- ≥ 98% clean runs without engineering intervention.
- Duplicate suppression ≥ 99%.
- Worker recovery ≥ 99%.
- Transient recovery ≥ 90%.
- Revision cycle reliability ≥ 99%.
- Session expiry resilience ≥ 99%.
- Socket-disabled recovery ≥ 99%.
- Cross-tenant denial = 100%.

---

## 6. Kill switches (3 AM procedure)

### 6.1 Backend is misbehaving (runaway request loop, bad config)
```bash
pm2 stop neurecore-backend
# investigate; restart only after the issue is identified
pm2 start neurecore-backend
```

### 6.2 Sidecar misbehaving (token leak, runaway tool calls, egress suspicion)
```bash
# 1. Forensic snapshot
journalctl -u hermes-sidecar --since "1 hour ago" > /tmp/hermes-snapshot.log
cp -r /opt/neurecore/hermes/tenants/<tenantId>/ /tmp/hermes-tenant-snapshot/

# 2. Kill the sidecar
systemctl kill -s SIGKILL hermes-sidecar

# 3. Revoke scoped tokens at the gateway
curl -X POST https://gateway.neurecore.internal/v1/executions/<executionId>/revoke \
     -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Investigate; do not restart until you understand the root cause
```

### 6.3 Disable a feature flag
Tenant-scoped flags live in `TenantFlagsModule`. Global kill-switches are
in `FeatureFlagModule`.
```bash
# Use the admin UI: /feature-flags
# Or directly in DB (Prisma):
# UPDATE feature_flag SET enabled=false WHERE key='<flag>';
```

### 6.4 Mass lock all tenants
```sql
-- Use the admin UI: /security > Lock All
-- Or DB:
UPDATE tenant SET status='SUSPENDED' WHERE status='ACTIVE';
```

---

## 7. Open production risks

From `pending-tasks.md`:
- **NC-SIM04-002** — customer modal z-index bug. Workaround: refresh
  page after closing any open modal.
- **NC-SIM04-005** — chat natural-language project creation not wired.
  Workaround: use the formal `/projects/new` page.
- **Admin live monitoring** — shows snapshot, not live. Workaround:
  `pm2 monit` from SSH.

---

## 8. Source pointers

- `scripts/contabo/ecosystem.config.js`
- `scripts/contabo/cors-proxy.js`
- `scripts/deploy/neurecore-deploy.sh`
- `scripts/deploy/post-deploy-smoke.sh`
- `backend/scripts/di-boot-gate.js`
- `infra/sidecar/RUNBOOK.md` (sidecar-specific runbook)
- `infra/sidecar/systemd/` (Python sidecar unit files)
- `infra/hermes-events-bridge/README.md`
- `AGENTS.md` (Phase 9 certification guide)