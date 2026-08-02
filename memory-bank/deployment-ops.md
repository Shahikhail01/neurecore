# Deployment Ops

> Deploy pipeline: local workspace → Contabo. Last refreshed: 2026-07-31.

There are **two deploy scripts** in this repo, used at different layers:

| Script | Role | Runs from |
|---|---|---|
| `scripts/deploy.sh` | Sync source from local workspace → Contabo, then trigger rebuild | Local |
| `scripts/deploy/neurecore-deploy.sh` | Atomic, fail-safe deploy with rollback | Local or sandbox |

Plus per-process helpers:
- `scripts/deploy/deploy-sandbox-test.sh` — sandboxed failure-injection harness.
- `scripts/deploy/post-deploy-smoke.sh` — post-deploy health probe.
- `scripts/check-dist-drift.sh` — backend dist drift pre-flight.
- `scripts/rebuild.sh` — on-server rebuild (rsynced to `/opt/neurecore/`).

---

## 1. The push-to-Contabo flow (`scripts/deploy.sh`)

### 1.1 Usage
```bash
./scripts/deploy.sh tenant     # sync + rebuild frontend-tenant
./scripts/deploy.sh admin      # sync + rebuild frontend-admin
./scripts/deploy.sh backend    # sync src+prisma + rebuild backend
./scripts/deploy.sh all        # sync + rebuild all three
```

### 1.2 What it does
1. Ensures `pnpm` is on PATH (FIX-COMPREHENSIVE-R3 — `pnpm` lives at
   `/home/najeeb/node/node-v22.12.0-linux-x64/bin/pnpm`).
2. `check_ports` — greps `start.sh` for `--port` and verifies it matches
   the expected port (3001 / 3020).
3. `check_lockfile` — runs `pnpm install --frozen-lockfile --lockfile-only`
   in a tmp copy to detect lockfile drift locally BEFORE rsync. Emits a
   warning if drift is detected so the operator can `pnpm install` first.
4. `check_dist_drift` — for backend, validates `dist/` matches `src/`.
5. `sync_app` — `rsync -avz --delete-after` with the documented EXCLUDES
   (see `contabo-ops.md` §8).
6. `ssh contabo "bash /opt/neurecore/rebuild.sh $APP"` — on-server rebuild
   (install + build + pm2 reload).

### 1.3 Failure modes & recovery
- **Lockfile drift** (the 2026-07-23 + 2026-07-24 incidents): the on-server
  rebuild.sh auto-fallbacks to `--no-frozen-lockfile` if the install fails,
  but the local pre-flight warns you. Regenerate the lockfile locally and
  commit it.
- **Port mismatch**: `check_ports` exits 1 before any rsync. Fix the
  port literal in `start.sh`.
- **Stale backend dist**: `check-dist-drift.sh` exits 1 if `dist/` is
  older than `src/`. Run `nest build` locally first.

---

## 2. The atomic deploy (`scripts/deploy/neurecore-deploy.sh`)

This is the hardened, atomic, fail-safe orchestrator (DEPLOY-001). It is
**environment-agnostic** — same script works against a local sandbox or the
real Contabo host.

### 2.1 Phases
1. **Install** (frozen-lockfile).
2. **Typecheck** (`tsc --noEmit -p tsconfig.build.json` for backend).
3. **Build** (`nest build` / `next build`).
4. **DI boot gate** (`node scripts/di-boot-gate.js` — backend only).
5. **Detect pending migrations**.
6. **Acquire migration lock** with bounded retry + exponential backoff
   (defaults: `MIGRATE_MAX_RETRIES=5`, `MIGRATE_BACKOFF_BASE=2`).
7. **Apply migrations** (`prisma migrate deploy`).
8. **Stage** the new release in `releases/<id>/`, verify artifact hash
   against the local build (sha256sum over `find $BUILD_OUT -type f`).
9. **Atomic switch** of the `current` symlink (the **only** mutating
   step).
10. **Reload PM2** for the matching process.
11. **Health + route verification** — on failure, rollback to previous
    release.
12. **Retention** — keep last `KEEP_RELEASES` (default 5).

### 2.2 Usage
```bash
DEPLOY_HOST=contabo DEPLOY_ROOT=/opt/neurecore ./neurecore-deploy.sh backend
DEPLOY_HOST=local   DEPLOY_ROOT=/tmp/nc-sandbox ./neurecore-deploy.sh backend
```

### 2.3 Failure injection (sandbox only)
For testing the script's safety properties:
- `FAIL_INSTALL=1`
- `FAIL_BUILD=1`
- `FAIL_MIGRATE=1`
- `FAIL_HEALTH=1`

Each simulates the named phase failing. The script must leave the live
release untouched in every case.

### 2.4 Manifest
Each release drops `RELEASE_MANIFEST.json`:
```json
{
  "app": "backend",
  "releaseId": "20260731-011500-<short-sha>",
  "commit": "<full-sha>",
  "lockfileSha256": "...",
  "artifactSha256": "...",
  "buildTime": "2026-07-31T...",
  "buildOutput": "dist"
}
```

### 2.5 Rollback
On health-check failure post-switch:
```bash
ln -sfn <PREVIOUS_RELEASE> <CURRENT_LINK>
pm2 reload <PM2_NAME> --update-env
```

If there's no previous release (first deploy), the script logs but cannot
restore — investigate manually.

### 2.6 Sandbox test
`scripts/deploy/deploy-sandbox-test.sh` exercises each failure mode against
`DEPLOY_ROOT=/tmp/nc-sandbox` and asserts:
- Live release path is untouched on each failure.
- Manifest is written only on success.
- Atomic switch is reversible.

---

## 3. Lockfile + dist drift gates

### 3.1 Lockfile drift
Triggered when `package.json` gains new deps not yet in `pnpm-lock.yaml`.
- Detection: `pnpm install --frozen-lockfile --lockfile-only` in a tmp
  copy.
- Recovery: `cd <pkg_dir> && pnpm install` then commit the new
  `pnpm-lock.yaml`.

### 3.2 Backend dist drift
Triggered when `dist/` is older than `src/` (e.g. someone edited src and
forgot to build).
- Detection: `scripts/check-dist-drift.sh backend` compares `find src -name
  '*.ts' -newer dist/src/main.js`.
- Recovery: `cd backend && pnpm nest build`.

---

## 4. Post-deploy smoke (`scripts/deploy/post-deploy-smoke.sh`)

Probes:
```bash
curl -sk https://brain.neurecore.com/api/v1/health
curl -sk -o /dev/null -w '%{http_code}' https://hq.neurecore.com/
curl -sk -o /dev/null -w '%{http_code}' https://cc.neurecore.com/
```

OK responses:
- `/api/v1/health` → `200 {"status":"ok"}`
- Tenant portal root → `200`
- Admin portal root → `200`

---

## 5. On-server rebuild (`/opt/neurecore/rebuild.sh`)

Triggered by `scripts/deploy.sh`. Lives at `/opt/neurecore/rebuild.sh` on
Contabo (rsynced with the repo root). Per app:
- `pnpm install --frozen-lockfile` (or `--no-frozen-lockfile` fallback per
  FIX-COMPREHENSIVE-R3).
- `pnpm nest build` / `pnpm next build`.
- `pm2 reload <PM2_NAME>`.

---

## 6. Branch protection (admin tooling)

`scripts/apply-awl-branch-protection.sh` — applies branch protection rules
to the AWL repo. Optional; only run when setting up a new repo.

---

## 7. CI helpers

`/home/najeeb/Linux-Dev/neurecore-2026/neurecore-ci-check/` contains CI
helper scripts. Check there for any pre-PR hooks or required checks.

---

## 8. Source pointers

- `scripts/deploy.sh` (push-to-Contabo)
- `scripts/deploy/neurecore-deploy.sh` (atomic deploy)
- `scripts/deploy/deploy-sandbox-test.sh` (failure-injection harness)
- `scripts/deploy/post-deploy-smoke.sh`
- `scripts/check-dist-drift.sh`
- `scripts/rebuild.sh`
- `scripts/contabo/ecosystem.config.js`
- `scripts/contabo/cors-proxy.js`
- `backend/scripts/di-boot-gate.js`
- `infra/sidecar/systemd/` — sidecar unit files (Python services)