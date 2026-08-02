# NeureCore — Quick Runbook

**Audience:** Anyone who needs to answer "is it working?" in 30 seconds, or diagnose the most common issues.
**Sibling docs:** [system-state.md](system-state.md), [operations.md](operations.md), [deployment.md](deployment.md), [disaster-recovery.md](disaster-recovery.md).

---

## 1. Health check (copy-paste, 30 seconds)

```bash
ssh contabo '
  echo "=== PM2 ==="
  pm2 jlist 2>/dev/null | python3 -c "import sys,json
for p in json.load(sys.stdin):
    n=p[\"name\"]
    if \"neurecore\" in n:
        e=p[\"pm2_env\"]
        print(f\"  {n:25s} id={e[\"pm_id\"]:>3} status={e[\"status\"]:<7} restarts={e[\"restart_time\"]}\")"
  echo "=== Ports ==="
  ss -tlnp 2>/dev/null | grep -E "3003|3004|3005|3020" | awk "{print \"  \" \$4}"
  echo "=== Disk ==="
  df -h / | tail -1 | awk "{print \"  used \" \$3 \" / \" \$2 \" (\" \$5 \")\"}"
'
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
curl -s  -o /dev/null -w "  CORS  %{http_code}\n" -X OPTIONS https://hq.neurecore.com/api/v1/health \
  -H "Origin: https://hq.neurecore.com" \
  -H "Access-Control-Request-Method: GET"
```

**Expected output:**

```
=== PM2 ===
  neurecore-cors-proxy      id=  7 status=online  restarts=4
  neurecore-backend         id= 37 status=online  restarts=429   ← cumulative over service lifetime, NOT an alarm
  neurecore-tenant          id= 40 status=online  restarts=4
  neurecore-admin           id= 42 status=online  restarts=0
=== Ports ===
  127.0.0.1:3003
  127.0.0.1:3004
  127.0.0.1:3005
  127.0.0.1:3020
=== Disk ===
  used 52G / 96G (54%)
  brain 200
  hq    200
  cc    200
  CORS  204
```

If any line deviates, jump to §3 (Common symptoms).

---

## 2. Per-service quick checks

### 2.1 Backend

```bash
ssh contabo '
  echo "=== /api/v1/health ==="
  curl -s http://127.0.0.1:3003/api/v1/health
  echo ""
  echo "=== /api/metrics (Prometheus) — first 10 lines ==="
  curl -s http://127.0.0.1:3003/api/metrics | head -10
  echo ""
  echo "=== Recent backend errors ==="
  tail -20 /root/.pm2/logs/neurecore-backend-error.log
'
```

### 2.2 Frontend-Tenant

```bash
ssh contabo '
  echo "=== /api/v1/agents (expect 401) ==="
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3005/api/v1/agents
  echo "=== Tenant startup log ==="
  tail -10 /root/.pm2/logs/neurecore-tenant-out.log
  echo "=== Tenant errors ==="
  tail -10 /root/.pm2/logs/neurecore-tenant-error.log
'
```

### 2.3 Frontend-Admin

```bash
ssh contabo '
  echo "=== /api/v1/agents (admin uses absolute brain URL) ==="
  curl -s -o /dev/null -w "%{http_code}\n" https://brain.neurecore.com/api/v1/agents
  echo "=== Admin startup log ==="
  tail -10 /root/.pm2/logs/neurecore-admin-out.log
  echo "=== Admin errors ==="
  tail -10 /root/.pm2/logs/neurecore-admin-error.log
'
```

### 3.1 Tenant "can't access property length" crash

**Symptoms (browser console):**
- `TypeError: can't access property "length", n is undefined` (or `.filter`, `.map`, `.find`, `.slice`)
- `[app/error] Route error: TypeError...` (Next.js app-level error boundary fires)
- Page may show a blank screen or a generic error UI

**Root cause:** A component called `something.length` (or `.filter`/`.map`/`.find`/`.slice`) on a value from a Zustand `persist`-backed store, where the persisted localStorage entry has been corrupted to a non-array value. This can happen if:
- A previous build wrote a different shape to localStorage.
- The user manually edited localStorage.
- A Zustand version migration was missing.

**Quick fix for the affected user:**
1. Open browser DevTools → Application → Local Storage → `https://hq.neurecore.com`
2. Find and **delete** the offending key. Known culprits (all use `persist` middleware):
   - `hq_task_store` — `tasks` field should be an array
   - `hq_agent_store` — `agents` field
   - `hq_department_store` — `departments` field
   - `ui-preferences-store` — `visibleIcons`, `visibleWidgets`, `widgetOrder`
3. Reload the page.

**Permanent fix (already shipped in FIX-019):**
- Every persisted store has a `merge` function that sanitizes arrays on hydration: `Array.isArray(ps.tasks) ? ps.tasks : currentState.tasks`
- Every consumer of a persisted store defensively guards: `const safe = Array.isArray(raw) ? raw : []`
- See [frontend-tenant.md §19](frontend-tenant.md#19-defensive-patterns-zustand-merge--ui-guards-fix-019) for the pattern.

**Related:** [fixes.md FIX-019](fixes.md#fix-019--comprehensive-home-page-audit-5-issues-fixed), [fixes.md FIX-018 post-deploy fix](fixes.md).

### 3.2 Tenant WebSocket connection failure

**Symptoms (browser console):**
- `Firefox can't establish a connection to the server at wss://brain.neurecore.com/socket.io/?EIO=4&transport=websocket`
- `The connection to wss://brain.neurecore.com/socket.io/ was interrupted while the page was loading`
- Live feed / activity stream never updates
- Agent status changes don't propagate to the UI

**Root cause:** `frontend-tenant/src/services/socket.ts` reads `SOCKET_URL` from `process.env.NEXT_PUBLIC_SOCKET_URL`. If that env var is missing or empty in production, it used to fall back to `http://localhost:3000` (a dev-only value). Browsers then attempt to connect to `wss://brain.neurecore.com/socket.io/` (the OLS-proxied path), but the backend on port 3003 doesn't expose a Socket.IO server that OLS can reverse-proxy. (FIX-019 changed this to derive from `window.location` — same-origin wss/ws.)

**Quick check on the affected user:**
1. Open browser DevTools → Network → filter "WS" → look at the failed WebSocket frames.
2. The destination URL should be `wss://hq.neurecore.com/socket.io/` (same-origin), NOT `wss://brain.neurecore.com/socket.io/`.
3. If it's the wrong host, the user is running a build BEFORE the FIX-019 redeploy. They need to hard-reload (Cmd+Shift+R) to bust the browser cache, or wait for the next deploy.

**Permanent fix (already shipped in FIX-019):**
- `services/socket.ts` now derives URL from `window.location` (same-origin wss/ws).
- `.env.production` has explicit `NEXT_PUBLIC_SOCKET_URL=` (empty) plus a comment explaining the same-origin behaviour.
- A missing env var is no longer a silent fallback to dev defaults.

**Verification:**
```bash
# Build should not have a localhost:3000 reference
ssh contabo 'grep -rn "localhost:3000" /opt/neurecore/frontend-tenant/src/ || echo "clean"'
# Should print "clean" (zero matches).
```

**Related:** [fixes.md FIX-019](fixes.md#fix-019--comprehensive-home-page-audit-5-issues-fixed).

#### 3.2.1 Socket.IO polling 400 noise on the long-polling transport (FIX-SOCKETPOLL-2026-07-25)

**Symptoms (browser console, post-FIX-019):**
- `Failed to load resource: the server responded with a status of 400 () @ https://hq.neurecore.com/socket.io/?EIO=4&transport=polling&t=...&sid=...:0`
- Many sequential POST polls return 400 with `{"code":1,"message":"Session ID unknown"}` followed by a successful GET that establishes a fresh sid

**Root cause:** The frontend `socket.io-client` is configured `transports: ['polling']`, `upgrade: false` (the OLS-fronted WebSocket upgrade path is unreliable, see `socket.ts` comment). After a clean GET handshake establishes a session, subsequent POST polls with the same sid may be rejected by engine.io when the in-memory session expires. The browser auto-reconnects with a fresh sid.

**Status (2026-07-25, Run-3):** **MITIGATED, not eliminated.** The 400 noise is **cosmetic** and **non-functional** — the application reconnects and continues to function. Mitigations applied:
- `backend/src/modules/events/events.gateway.ts`: `pingInterval: 60_000`, `pingTimeout: 90_000`, `maxHttpBufferSize: 1_048_576`, `allowEIO3: true`. The 60 s heartbeat gives the OLS proxy enough headroom to relay the poll before the server-side session expires.
- The gateway now emits a clean `unauthorized` event before `disconnect(true)` when the JWT is missing/revoked, so the client gets a structured error rather than an unhandled 400.

**Open follow-up:** Investigate OLS-fronted POST→backend body forwarding for the polling transport (currently 1-2% of polls return 400; non-blocking).

**Related:** [audits/2026-07-25-industry-verification-3-remediation/REPORT.md](audits/2026-07-25-industry-verification-3-remediation/REPORT.md) §3.6.

---

### 2.4 CORS proxy

```bash
ssh contabo '
  echo "=== Preflight from hq origin ==="
  curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
    -H "Origin: https://hq.neurecore.com" \
    -H "Access-Control-Request-Method: GET" \
    | head -10
  echo ""
  echo "=== Preflight from cc origin ==="
  curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
    -H "Origin: https://cc.neurecore.com" \
    -H "Access-Control-Request-Method: GET" \
    | head -10
'
```

Expected: `204 No Content` + `Access-Control-Allow-Origin: <origin>` for each.

---

## 3. Common symptoms

| Symptom | Likely cause | Fix |
|---|---|---|
| `next: No such file or directory` in admin log | old PM2 entry used `script: 'npx'` | ecosystem already uses `./start.sh`; `pm2 startOrReload /opt/neurecore/ecosystem.config.js` |
| CORS preflight returns no `Access-Control-Allow-Origin` | `cors-proxy.js` ALLOWED_ORIGINS missing the origin | See [operations.md §4.2](operations.md#42-adding-a-new-origin) |
| `brain.neurecore.com/api/v1/health` returns 503 | backend crashed | `ssh contabo 'pm2 logs neurecore-backend --lines 100 --nostream --raw'` |
| `hq.neurecore.com/` returns 502 | tenant Next.js died | `ssh contabo 'pm2 restart neurecore-tenant'`; check `.next/` exists |
| `cc.neurecore.com/` returns 502 | admin Next.js died | `ssh contabo 'pm2 restart neurecore-admin'` |
| `cc.neurecore.com/api/v1/health` returns 404 | admin vhost doesn't proxy API paths | **Expected** — admin frontend calls `brain.neurecore.com` directly via `NEXT_PUBLIC_API_URL` |
| `hq.neurecore.com/api/v1/auth/login` returns 404 on GET | GET not supported on this route | POST with body, or check `/api/v1/health` |
| `git status` shows deleted files outside `src/ prisma/` | `Temp/` not gitignored (rare) | `Temp/` is gitignored as of 2026-07-04; verify `.gitignore` line exists |
| `pnpm: ERR_UNKNOWN_BUILTIN_MODULE` (corepack path) | corepack-pnpm requires Node 22.13+ | **RESOLVED 2026-07-04**: `pnpm@9.15.9` installed; use `pnpm` directly |
| Backend `/api/v1/health` 200 but `/agents` 500 | Likely enum drift or DB timeout | check `pm2 logs` for `Value 'X' not found in enum`; if enum-drift run `prisma generate`; otherwise check Neon status |
| `3005: connection refused` | `neurecore-tenant` died | `pm2 restart neurecore-tenant` then check error log |
| OLS vhost change doesn't take effect | OLS not reloaded | `/usr/local/lsws/bin/litespeed -t && systemctl restart lsws` |
| TLS cert expired | certbot renewal failed | `certbot renew --force-renewal` |
| `prisma migrate` fails after deploy | migrations not synced | `rsync -avz prisma/migrations/<new-dir>/ contabo:/opt/neurecore/backend/backend/prisma/migrations/<new-dir>/` |
| Disk `df` shows >90% | old archives or logs | See [disaster-recovery.md §5](disaster-recovery.md#5-disk-full-recovery) |
| Browser console: `TypeError: can't access property "length", n is undefined` on `/home` (or any tenant page) | Zustand `persist` middleware hydrated a non-array from corrupted `localStorage` | See [§3.1 Tenant "can't access property length" crash](runbook.md#31-tenant-cant-access-property-length-crash) |
| `GET /help?_rsc=... 404` in network tab | `<Link href="/help">` exists in TopBar but no `/help` page | Either create the page or remove the link — see [frontend-tenant.md §19](frontend-tenant.md#19-defensive-patterns-zustand-merge--ui-guards-fix-019) |
| `Firefox can't establish a connection to wss://brain.neurecore.com/socket.io/` in console | WebSocket URL falls back to wrong host in production (no `NEXT_PUBLIC_SOCKET_URL`, or hardcoded `localhost:3000`) | See [§3.2 Tenant WebSocket connection failure](runbook.md#32-tenant-websocket-connection-failure) |
| `Content-Security-Policy warnings 4` in console | Pre-existing — Next.js inlines scripts that don't have a strict CSP nonce | Cosmetic, not blocking; OLS vhost doesn't yet emit `Content-Security-Policy` header |
| User reports "I got logged out randomly" / "auth got corrupted" | **FIX-020 shipped 2026-07-07 — the "auth gets corrupted" bug class is structurally gone.** If this regresses, run `bash scripts/auth-lint.sh` on Contabo first (or locally). | See [§3.5 "Auth feels corrupted" diagnostic](runbook.md#35-auth-feels-corrupted-diagnostic) |
| Browser stuck on `Restoring session…` splash (was a known issue, FIX-020 fixed it) | State stuck in `initializing` — means the `ZustandUserRepository.onHydrationComplete()` promise never resolves | See [`auth.md §17`](auth.md#17-quick-troubleshooting) — usually resolved by `pm2 restart neurecore-tenant`. If persistent, check that `useAuthStore.persist.hasHydrated()` returns true via the new repository's fallback (`queueMicrotask`). |
| Deploy fails: `npm error: npm ci can only install packages when your package.json and package-lock.json are in sync` | Local `package-lock.json` is stale (new dev deps added without re-syncing) | Run `npm install --package-lock-only --legacy-peer-deps` locally, commit, re-deploy. (FIX-020 added vitest specs that pulled new transitive deps.) |

### 3.5 "Auth feels corrupted" diagnostic (post-FIX-020)

The "auth gets corrupted" symptom class — the one the FIX-020 plan was written to eliminate — should not recur. If a user reports it:

1. **Run `bash scripts/auth-lint.sh`** (from the repo root). If it fails, the regression introduced a banned pattern. CI should have caught it; investigate the PR/merge that brought it in.
2. **Check the served bundle has the new code:**
   ```bash
   curl -sk https://hq.neurecore.com/ | grep -oE 'main-app-[a-z0-9]+\.js'
   BUNDLE=$(curl -sk https://hq.neurecore.com/ | grep -oE 'main-app-[a-z0-9]+\.js' | head -1)
   curl -sk "https://hq.neurecore.com/_next/static/chunks/$BUNDLE" | grep -c "authService"
   # Expected: 1 or more
   ```
   If 0 → deploy didn't update the bundle. Rebuild + restart.
3. **Check the user's cookies** (DevTools → Application → Cookies):
   - `__Host-nc_at` (HttpOnly, ~15 min) → access token
   - `__Host-nc_rt` (HttpOnly, 7 d) → refresh token
   - `__Host-nc_csrf` (JS-readable) → for state-changing requests
   If absent → `killSession()` was called. Inspect backend log for `4091` (refresh reuse) or 401s.
4. **Check React state via dev tools** (if you can repro): in the browser console, run:
   ```js
   // The exposed hook isn't on window — instead, look for the AuthProvider's
   // children mounting state in the React DevTools Profiler.
   ```
5. **Run the Playwright prod smoke:**
   ```bash
   PLAYWRIGHT_BASE_URL=https://hq.neurecore.com \
     npx playwright test prod-auth-smoke prod-login-flow prod-walkthrough --project=chromium --workers=1
   ```
   All 9 should pass.
6. **Reference:** [`int-features/auth-architecture.md`](int-features/auth-architecture.md) and [`fixes.md` FIX-020](fixes.md#fix-020--auth-system-corrupted-on-new-page-work-shipped).

---

## 4. Restart everything (panic button)

```bash
ssh contabo '
  pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save
  sleep 5
  pm2 list | grep neurecore
'
curl -sk -o /dev/null -w "  brain %{http_code}\n" https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  cc    %{http_code}\n" https://cc.neurecore.com/
```

If this doesn't bring everything up, escalate to disaster-recovery.md.

---

## 5. Tail logs in real time

```bash
ssh contabo 'pm2 logs --raw'                            # all 4 services interleaved
ssh contabo 'pm2 logs neurecore-backend --raw'          # one service
ssh contabo 'tail -f /root/.pm2/logs/neurecore-tenant-out.log'   # raw file
```

---

## 6. Inspect live processes

```bash
ssh contabo '
  echo "=== neurecore-backend ==="
  pm2 show neurecore-backend | grep -E "status|cwd|script|uptime|restarts|memory"
  echo "=== neurecore-tenant ==="
  pm2 show neurecore-tenant | grep -E "status|cwd|script|uptime|restarts|memory"
  echo "=== neurecore-admin ==="
  pm2 show neurecore-admin | grep -E "status|cwd|script|uptime|restarts|memory"
  echo "=== neurecore-cors-proxy ==="
  pm2 show neurecore-cors-proxy | grep -E "status|cwd|script|uptime|restarts|memory"
'
```

---

## 7. Useful one-liners

```bash
# Count log errors in last hour
ssh contabo 'find /root/.pm2/logs -name "*error*.log" -mmin -60 -exec grep -c "Error\|error" {} +'

# Memory usage of neurecore processes
ssh contabo 'ps -o pid,rss,command -p $(pgrep -f neurecore-) | sort -k2 -n'

# Open connections per port
ssh contabo 'ss -tn state established "( sport = :3003 or sport = :3005 or sport = :3020 )" | wc -l'

# Last backend git commit
ssh contabo 'cd /opt/neurecore/backend/backend && git log --oneline -1'

# Latest DR snapshot
ssh contabo 'ls -t /opt/neurecore/_archives/ | grep -E "^[0-9]" | head -1'

# Days since last deploy (using PM2 uptime)
ssh contabo "pm2 jlist 2>/dev/null | python3 -c 'import sys,json,datetime
now=int(datetime.datetime.now().timestamp()*1000)
for p in json.load(sys.stdin):
    n=p[\"name\"]
    if \"neurecore\" in n:
        e=p[\"pm2_env\"]
        days=(now-e.get(\"pm_uptime\",now))/86400000
        print(f\"  {n}: {days:.1f} days\")'"
```

---

## 8. Escalation paths

| Symptom | First action | If still broken |
|---|---|---|
| Backend down | Restart PM2; check `/root/.pm2/logs/neurecore-backend-error.log` | Restore from snapshot ([disaster-recovery.md §3.1](disaster-recovery.md#31-restore-backend)) |
| Frontend down | Restart PM2; check Next.js logs | Restore `.next/` from snapshot |
| Bad deploy | Rollback to previous commit ([deployment.md §9](deployment.md#9-rollback)) | Restore from snapshot |
| Disk full | Prune archives + logs ([disaster-recovery.md §5](disaster-recovery.md#5-disk-full-recovery)) | Provision new VPS |
| Cert expired | `certbot renew --force-renewal` | Manual cert install + OLS reload |
| Backend DB errors | Check PostgreSQL status; verify `DATABASE_URL` in `.env` | Restart PostgreSQL or restore from backup |
| Box unreachable | Contabo support ticket | Provision new VPS + full restore |

---

## 9. Google OAuth credential rotation (CLIENT_ID / CLIENT_SECRET)

**When this matters**

- `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` leaked / disclosed.
- Routine rotation per security policy (recommended every 6 months for public-facing apps).
- Google's "unverified app" warning escalates and they request credential change.
- Moving the OAuth app from one Google Cloud project to another.
- Tenant reports recurring `invalid_client` after deploys.

**Key facts**

- OAuth client ID + secret are stored **server-side only** in `backend/.env.production` and read by `IntegrationsService.initiateGoogleOAuth()`.
- Tenant credentials (per-tenant access/refresh tokens) are persisted in the `integration_credential` table, encrypted with `INTEGRATION_ENCRYPTION_KEY` / `GOOGLE_TOKEN_ENCRYPTION_KEY` (AES-256-GCM). They are **not** derived from the client secret.
- When you rotate the client secret, every existing tenant's refresh token continues to work **until Google revokes it** — typically only happens if (a) the OAuth app is deleted, (b) the OAuth consent screen is unpublished, or (c) Google invalidates tokens for security reasons. Practical impact for our use case: zero automatic disruption after a secret-only rotation.
- However, the `state` payload issued during the **next** `POST /integrations/google/authorize` flow will be signed by the new secret; in-flight `state`s issued before the rotation continue to validate against the old secret. Once `backend` PM2 restarts, all `state`s issued post-restart are signed by the new secret and fail verification if the secret env hasn't been reloaded — always restart backend after the env file change.
- The `access_token` re-exchange uses the *current* client_id+secret pair. If secret rotates mid-token-life, refresh still works (refresh tokens do not require the secret to be the same one used at original-issue time, only at *exchange* time, which uses the *current* configured secret).
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is read by the frontend login page. **Critical**: Next.js loads `.env.local` with higher priority than `.env.production`. If `.env.local` contains a placeholder value (`your-google-client-id.apps.googleusercontent.com`), it overrides the real client ID in `.env.production`. Always verify both files when the login page shows `GSI_LOGGER: The given client ID is not found`.
- `GOOGLE_REDIRECT_URI` must be explicitly set in the backend `.env.production` for the Google Workspace integration (Gmail/Drive/Calendar) OAuth flow. Missing this variable causes `redirect_uri_mismatch` (Error 400) because the code falls back to the wrong default URL.

**Steps**

1. **Pre-flight**

   ```bash
   ssh contabo
   cd /opt/neurecore/backend
   cat .env.production | grep -E "^GOOGLE_" || echo "no GOOGLE_* vars present"
   ```

   Note the current values. Confirm `GOOGLE_REDIRECT_URI` matches what is registered in the new Google Cloud project (typically `https://brain.neurecore.com/api/v1/integrations/google/callback`).

2. **Create the new OAuth client** in the Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application. Add:
   - Authorized JavaScript origins: `https://hq.neurecore.com`, `https://cc.neurecore.com`
   - Authorized redirect URIs: `https://brain.neurecore.com/api/v1/integrations/google/callback`

3. **Bake the new credentials into `.env.production`**

   ```bash
   ssh contabo
   cd /opt/neurecore/backend
   cp .env.production .env.production.bak-$(date +%F-%H%M)
   sed -i "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=<NEW>|"  .env.production
   sed -i "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=<NEW>|" .env.production
   grep -E "^GOOGLE_(CLIENT_ID|CLIENT_SECRET|REDIRECT_URI)" .env.production
   ```

4. **Restart the backend** to pick up the new env (PM2 does not auto-reload env):

   ```bash
   pm2 restart neurecore-backend
   pm2 logs --lines 50 neurecore-backend
   # Expect: Nest instantiation logs but no "OAuth is not configured" error.
   ```

5. **Smoke-test** the OAuth round-trip (validates G1 fix too):

   - Open `https://hq.neurecore.com/settings/integrations` in an incognito window.
   - Click **Connect Google**, consent, and ensure the browser lands back at `https://hq.neurecore.com/settings/integrations?connected=true&email=...` (not on `brain.neurecore.com`).
   - DB confirm:
     ```sql
     SELECT "tenantId", provider, scopes
     FROM integration_credential
     WHERE provider='GOOGLE' AND "updatedAt" > NOW() - INTERVAL '5 minutes';
     ```

6. **Verify tenants still work**

   - All existing tenants should continue functioning with their existing refresh tokens. No proactive re-consent is needed.
   - Spot-check 2-3 tenants by inspecting `integration_credential` rows — they retain their encrypted `refreshToken` and continue issuing `accessToken` calls with the new client_secret (which is fine — refresh tokens are bound to the user, not the secret).
   - If a tenant reports failures (HTTP 400 `invalid_grant`), use the new Phase 3 admin override: `POST /integrations/admin/google/:tenantId/disconnect` (role `SUPER_ADMIN`/`PLATFORM_ADMIN`) and ask them to re-consent.

7. **Audit log entry**

   `adminDisconnectGoogle` writes an `AuditLog` row at `action='google.admin_revoke'` with `resourceId=<tenantId>`, and the platform audit log UI at `/settings/audit` will surface it. If you have to re-consent a tenant manually, prefer the admin endpoint (with audit trail) over direct DB mutation.

8. **Revoke the old credentials** in Google Cloud Console. Optional but recommended once the new credentials are verified live (typical: 48 hours). Revoking the old secret does NOT invalidate tenant refresh tokens automatically — but any new `initiateGoogleOAuth` calls before you remove the old credentials will still succeed. Removing the old client entirely from the project will eventually invalidate refresh tokens only if a tenant's `access_token` request fails — at that point `GoogleAuthClient` will surface a re-consent error and the tenant UI surfaces the "Connect Google" CTA again.

**Failure-mode cheatsheet**

| Symptom | Cause | Fix |
|---|---|---|
| `Failed to start Google authorization` toast after rotation | Env not loaded | Restart `neurecore-backend`; check `pm2 logs` for "Google OAuth is not configured" |
| Google returns `invalid_client` | Wrong secret typed; key rotation not propagated | Re-set `.env`, restart backend, retry consent |
| `[GSI_LOGGER]: The given client ID is not found` on login page | Frontend `.env.local` overrides `.env.production` for `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Next.js gives `.env.local` higher priority) | Fix `.env.local` on Contabo: `/opt/neurecore/frontend-tenant/.env.local`; rebuild frontend (`npx next build`); restart PM2 |
| Google returns `redirect_uri_mismatch` (Error 400) on integration OAuth | `GOOGLE_REDIRECT_URI` missing from backend `.env.production` — falls back to wrong default URL | Add `GOOGLE_REDIRECT_URI=https://brain.neurecore.com/api/v1/integrations/google/callback` to `/opt/neurecore/backend/backend/.env.production`; restart backend with `--update-env` |
| Tenant Calendar/Sheets/Drive API calls return 401 silently or `BadRequestException` with no message | Latent bug fixed 2026-07-12: `GoogleGmailService.getMessage(messageId, threadId)` was missing `tenantId` — second arg was passed to `authFetch` as if it were the tenant | Code is fixed; if a tenant still hits this, run a one-off `node -e` to fetch the userinfo and confirm the access token is fresh, then collect backend `pm2 logs` during the request. |
| Backend HMR or `npm run start` fails on `GoogleDriveService` constructor | Latent bug fixed 2026-07-12: `private readonly prisma = new PrismaClient()` instantiated a fresh Prisma client per process, escaping DI | Code is fixed; should never recur. If you see `PrismaClient is not a constructor`, ensure your build cache is fresh (`rm -rf dist` then `nest build`). |
| Sheets list page is empty even though user has spreadsheets | Frontend used `searchDrive('title:')` literally; backend had no "list by mimeType only" mode | Code is fixed — pass empty string or rely on the default empty-query path which now omits the `name/fullText contains` clause. |
| Manage page "Connected account" shows "—" but scope badges say Granted | OAuth scopes don't include `openid`; userinfo only returns email for the fresh token. `googleAccountEmail` cached at callback time, but for older tenants the field is null | Migration `20260712_google_account_email` adds the column; populated retroactively for the current tenant via DB. For new disconnects/reconnects, the field is set automatically. |
| Calendar event creation returns 403 "writer access required" | Selected calendar is read-only (e.g. `Holidays in Pakistan`) | Select the user's primary calendar (e.g. `mnpiracha@gmail.com`) before creating events. No code change needed. |
| Existing tenant Gmail calls return 401 | Refresh token revoked (rare, only on full OAuth app deletion) | Admin: `POST /integrations/admin/google/:tenantId/disconnect`, ask tenant to reconnect |
| OAuth callback lands on `brain.neurecore.com` instead of `hq.neurecore.com` | `FRONTEND_BASE_URL` not set, env fell back to a hard default | Confirm `TENANT_FRONTEND_BASE_URL=https://hq.neurecore.com` is set in `backend/.env.production`; restart backend |

**Related docs**

- [int-features/google-services.md](./int-features/google-services.md) §2.6 OAuth callback redirect (G1)
- [int-features/google-services.md](./int-features/google-services.md) §9 Phase-3 G7 admin-revoke endpoint
- [operations.md](./operations.md) — how env files are deployed
- [deployment.md](./deployment.md) — backend redeploy steps

---

**End of runbook.**

---

## See also

- [auth.md](auth.md) — Authoritative reference for the cookie-only auth system.
- [int-features/auth-architecture.md](int-features/auth-architecture.md) — The SOLID architecture of the IAuthService facade (post-FIX-020 — single source of truth for any auth change).
- [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md) — The 10-phase FIX-020 plan (now ✅ SHIPPED 2026-07-07).
- [fixes.md](fixes.md) — FIX-014 (Auth Hardening Batch 1), FIX-015-016 (auth-hardening audit), FIX-019 (defensive patterns), FIX-020 (✅ shipped auth refactor).
- `scripts/auth-lint.sh` — Banned-pattern CI check. Run before any auth-related PR.
- [future-plans.md](future-plans.md) — Phase 9 G9 APPROVED status (commit fe335abb, 2026-07-30).