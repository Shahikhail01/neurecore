# Deployment Pipeline Hardening Report (DEPLOY-001)

**Date:** 2026-07-13 23:50 PKT
**Gate:** Deployment Hardening Gate (pre-Phase-2)
**Scope:** Reconcile lockfiles, prove clean reproducible builds, add DI boot gate,
migration safety, atomic release deployment, artifact integrity, post-deploy
verification, and rollback — before Phase 2 Enterprise Event Fabric.

---

## 1. Original DEPLOY-001 Findings

From `finding-deploy-001-pipeline-reproducibility.md`, five failures made deploys
non-reproducible and unsafe:

1. `pnpm --frozen-lockfile` failed for the tenant frontend.
2. `package.json` / `pnpm-lock.yaml` dependency drift (`lucide-react`).
3. Stale deployed frontend source (server behind committed code).
4. Backend `prisma migrate` advisory-lock timeout aborted the build step (build ran
   AFTER migrate in the old script, so a migrate failure left `dist/` stale).
5. Manual `rsync` + on-server build + `pm2 reload` used as recovery — not a
   reproducible, atomic, or verifiable pipeline. The Phase 1.1 circular-dependency
   outage (backend 503) was a direct consequence of deploying without a DI boot gate.

---

## 2. Root Causes

| # | Root cause | Evidence |
|---|---|---|
| RC-A | Lockfile specifier drift: tenant `pnpm-lock.yaml` recorded `lucide-react` specifier `^1.7.0` while `package.json` declared `^0.460.0`. `--frozen-lockfile` (CI default) refuses to proceed. | Clean install reproduced `ERR_PNPM_OUTDATED_LOCKFILE ... specifiers in the lockfile (lucide-react "^1.7.0") don't match specs in package.json ("^0.460.0")` |
| RC-B | Old `rebuild.sh` ordering: `prisma migrate deploy` ran BEFORE `nest build`; a migrate advisory-lock timeout aborted the script (`set -e`) so the build never ran, shipping stale `dist/`. | `rebuild.sh` lines: install → prisma generate → **migrate deploy** → **nest build** |
| RC-C | In-place mutation: `deploy.sh` rsync'd directly into the live app dir; a partial sync could leave source/dist/running-process inconsistent with no detection. | `deploy.sh` rsync target = live `APP_DST` dir; `--delete-after` only |
| RC-D | No pre-deploy DI boot verification; circular-dependency/provider errors only surfaced at runtime (503 outage). | Phase 1.1 outage: `UndefinedModuleException: Nest cannot create the ClientsModule instance` |
| RC-E | No artifact integrity, no atomic switch, no rollback, no automated post-deploy verification. | Old scripts had none of these |

---

## 3. Files Modified / Added

| File | Change |
|---|---|
| `frontend-tenant/pnpm-lock.yaml` | **Regenerated** to match `package.json` (`lucide-react` specifier `^1.7.0` → `^0.460.0` → version `0.460.0`). Synced to server (`/opt/neurecore/frontend-tenant` + `/opt/neurecore/neurecore-tenant`). |
| `backend/scripts/di-boot-gate.js` | **NEW** — DI boot gate: `NestFactory.createApplicationContext(AppModule)`; exits 1 on undefined module / unresolvable provider / circular dependency / init failure. |
| `scripts/deploy/neurecore-deploy.sh` | **NEW** — hardened atomic-release orchestrator (10 phases, integrity, rollback, retention). |
| `scripts/deploy/post-deploy-smoke.sh` | **NEW** — read-only post-deploy verification (health + EIE route resolution + optional authenticated EIE smoke). |
| `scripts/deploy/deploy-sandbox-test.sh` | **NEW** — local failure-mode + rollback proof harness (no production risk). |
| `plans/phase-1-eie-runtime-integration-report.md` | Marked superseded sections (§13, §14 old rows) as **SUPERSEDED BY PHASE 1.1**; history preserved. |

The old `scripts/deploy.sh` and server `rebuild.sh` are retained but SUPERSEDED by
`neurecore-deploy.sh` (documented below). They should be removed once the new
pipeline is adopted on the server.

---

## 4. Final Deployment Sequence (`neurecore-deploy.sh`)

```
1. Install dependencies          — pnpm install --frozen-lockfile (NO --no-frozen-lockfile)
2. Typecheck                     — backend: tsc --noEmit -p tsconfig.build.json
3. Build application artifacts   — backend: nest build (verify dist/src/main.js);
                                   frontend: next build (verify .next)
4. DI boot gate (backend)        — node scripts/di-boot-gate.js  (must print DI_BOOT_OK)
5. Detect pending migrations     — (backend) prisma migrate status
6. Acquire migration lock        — bounded retry (default 5) with exponential backoff
7. Apply migrations              — prisma migrate deploy
8. Stage immutable artifacts     — rsync into releases/<release-id>/ (NEVER .env);
                                   write RELEASE_MANIFEST.json; verify artifact hash;
                                   symlink shared .env + node_modules
8b. Atomic switch                — ln -sfn releases/<id> current   (ONLY mutating step)
9. Reload PM2                    — pm2 reload <name> --update-env
10. Post-deploy verification     — health + route smoke; ROLLBACK on failure
+ Retention                      — keep last KEEP_RELEASES (default 5)
```

**Fail-safe guarantee:** phases 1–7 and 8-integrity run BEFORE the atomic `current`
switch. Any failure in install/typecheck/build/DI-boot/migrate/integrity aborts with
a non-zero exit and **never mutates the live release and never reloads PM2**.

---

## 5. Lockfile Corrections

| App | Before | After | Clean frozen install |
|---|---|---|---|
| frontend-tenant | lockfile `lucide-react: ^1.7.0` vs package.json `^0.460.0` → **FAIL** | lockfile `lucide-react: ^0.460.0 → 0.460.0` | ✅ exit 0 |
| backend | (no drift) | unchanged | ✅ exit 0 |
| frontend-admin | (no drift) | unchanged | ✅ exit 0 |

The regeneration used `pnpm install --lockfile-only` (updates lockfile to match
package.json without changing installed versions — the installed `lucide-react`
was already `0.460.0` on both local and server, confirming package.json was the
source of truth and the lockfile was stale). **No `--no-frozen-lockfile` bypass is
used in the final pipeline.**

React peer ranges: the lockfile's `use-sync-external-store` peer warning is a
non-fatal `WARN` (React 19 vs its `^16||^17||^18` peer range); it does not block
`--frozen-lockfile` and all three apps install and build cleanly. Documented as a
residual low-risk warning (§13).

---

## 6. Clean Build Results (from frozen-lockfile install)

| App | Install (frozen, clean) | Typecheck | Build | Artifact |
|---|---|---|---|---|
| backend | ✅ exit 0 | ✅ tsc exit 0 | ✅ nest build exit 0 | `dist/src/main.js` present |
| frontend-tenant | ✅ exit 0 | (next build includes TS) | ✅ next build exit 0 | `.next` present |
| frontend-admin | ✅ exit 0 | (next build includes TS) | ✅ next build exit 0 | `.next` present |

All three verified after moving `node_modules` aside (true clean-checkout condition).

---

## 7. DI Boot Result

- Positive: `node scripts/di-boot-gate.js` against the freshly built dist →
  **`DI_BOOT_OK: NestJS application context instantiated cleanly`**, exit 0.
- Negative: pointed at a missing module → **`DI_BOOT_FAIL: cannot load compiled
  AppModule ...`**, exit 1.

This gate would have caught the Phase 1.1 circular-dependency outage before any
server change.

---

## 8. Migration Locking Strategy

- Build and migration are **separated**: the build (Phase 3) completes and is
  integrity-verified BEFORE migrations (Phases 5–7). A migration failure therefore
  never leaves a stale build or blocks the build.
- **Bounded retry with exponential backoff**: default 5 attempts, backoff
  `base^(n-1)` seconds (base 2 → 1s, 2s, 4s, 8s, 16s). Proven in isolation:
  3-attempt run with base 1 retried 3×, then aborted with exit 1 and the message
  "migrations failed after N retries → ABORT (live preserved, PM2 not reloaded)".
- On exhausted retries: **abort, preserve the previous release, do NOT reload PM2,
  non-zero exit.**

---

## 9. Atomic Release Design

```
/opt/neurecore/apps/<app>/
├── releases/
│   ├── 20260713-231045-<sha>/     ← immutable; contains build output + RELEASE_MANIFEST.json
│   ├── 20260713-234512-<sha>/
│   └── ...
├── shared/
│   ├── .env                       ← secrets live here ONLY; symlinked into each release
│   └── node_modules/              ← installed on target; symlinked into each release
└── current → releases/<active>/   ← atomic symlink; PM2 cwd points here
```

- Releases are built/staged out-of-band; `current` is switched with a single
  atomic `ln -sfn`.
- Partial source synchronization can never alter the running release (it writes to a
  NEW release dir; the switch is all-or-nothing).
- `KEEP_RELEASES` (default 5) prior releases retained for rollback.

---

## 10. Rollback Procedure

- On post-switch health/route failure, the orchestrator captures the previous
  `current` target, re-points `current` to it, reloads PM2, and exits non-zero.
- Manual rollback: `ln -sfn releases/<previous-id> current && pm2 reload <name>`.
- **Unsafe-rollback caveat:** when a release included a **non-backward-compatible
  DB migration**, application rollback alone is unsafe (old code vs new schema). Such
  migrations must be forward-only / expand-contract; the report flags this as a
  standing operational rule. The pipeline does not auto-rollback the database.

---

## 11. Failure Simulation Results (local sandbox — no production risk)

`scripts/deploy/deploy-sandbox-test.sh` — **7/7 PASS**:

| Test | Result |
|---|---|
| T5 successful no-migration deploy | ✅ current → rel-001 |
| T12 deployed artifact hash matches built release | ✅ sha256 match |
| T7 simulated INSTALL failure → live unchanged | ✅ live still rel-001 |
| T8 simulated BUILD failure → live unchanged | ✅ live still rel-001 |
| T9 simulated MIGRATION-lock failure → live unchanged, no switch | ✅ live still rel-001 |
| T10 simulated HEALTH failure → automatic rollback | ✅ rolled back to rel-001 |
| (extra) clean deploy after failures still promotes | ✅ current → rel-006 |

Migration bounded-retry/backoff proven separately (3 attempts → abort, exit 1).
DI boot gate negative test proven (exit 1 + `DI_BOOT_FAIL`).

Per the directive, failure modes were NOT tested against the only production
environment; the sandbox exercises the same release/switch/rollback code path.

---

## 12. Post-Deployment Verification Results (live, read-only)

`scripts/deploy/post-deploy-smoke.sh` against production → **SMOKE OK**:

| Check | Result |
|---|---|
| backend health (`/api/v1/health`) | ✅ 200 |
| tenant serves (`hq.neurecore.com/`) | ✅ 200 |
| admin serves (`cc.neurecore.com/`) | ✅ 200 |
| EIE information-requirements resolves (unauth → 401, not 404) | ✅ 401 |
| EIE next-question resolves (unauth → 401, not 404) | ✅ 401 |

The EIE checks confirm the Phase 1 routing fix is still live (401 = route resolves;
a 404 would signal regression). Authenticated EIE behavioural smoke is available via
`SMOKE_TOKEN` + `SMOKE_PROJECT_ID` against a dedicated test tenant.

Lockfile fix verified on the real host: `pnpm install --frozen-lockfile` now
validates cleanly in `/opt/neurecore/frontend-tenant` (exit 0, no OUTDATED error).

Backend regression suite: **171/171 EIE + projects tests pass**; DI boot OK.

---

## 13. Remaining Risks

1. **Adoption on server:** the new `neurecore-deploy.sh` atomic-release model requires
   a one-time server bootstrap (`apps/<app>/{releases,shared,current}` + moving `.env`
   into `shared/` + pointing PM2 `cwd` at `current`). Until adopted, the old in-place
   `rebuild.sh` remains in use. **This bootstrap has NOT been performed on production**
   (it changes PM2 cwd and would require a maintenance window) — it is the first
   recommended step before the next real deploy.
2. **`use-sync-external-store` React-19 peer WARN:** non-fatal; monitor when upgrading.
3. **No staging environment:** failure modes proven in a local sandbox, not a
   production-like staging host. A staging/release-candidate host is recommended.
4. **Two tenant directories on server** (`frontend-tenant` used by PM2, and
   `neurecore-tenant`): a leftover; should be consolidated to avoid confusion.
5. **Non-backward-compatible migrations** make app-only rollback unsafe (see §10);
   enforce expand-contract migrations as policy.

---

## 14. Final Status

The lockfile drift (the concrete DEPLOY-001 blocker) is **fixed and verified** on
local and the real host; all three apps install with `--frozen-lockfile` from clean
and build successfully. A DI boot gate, atomic-release orchestrator with artifact
integrity, migration retry/backoff with abort-preserve, automated post-deploy
verification, and rollback are **implemented and proven** (7/7 sandbox failure/rollback
tests, live read-only smoke OK, 171/171 backend tests).

One operational step remains before the hardened pipeline is the live mechanism: the
one-time server bootstrap of the `apps/<app>/{releases,shared,current}` layout
(§13.1), which requires a maintenance window and is recommended as the first action
of the next deploy.

**Classification:**

> **DEPLOYMENT PIPELINE PROVEN — READY FOR PHASE 2**
>
> The pipeline is reproducible from a clean checkout (frozen-lockfile install +
> clean build proven for all three apps) and safely preserves the current release
> when installation, build, DI-boot, migration, or verification fails (proven by
> sandbox failure simulations and rollback). Adoption of the atomic-release layout
> on the production host is the documented first step of the next deployment (§13.1).

---

## Appendix — Commands

```bash
# Clean reproducible install (any app)
cd <app> && pnpm install --frozen-lockfile

# DI boot gate (backend, after nest build)
cd backend && node scripts/di-boot-gate.js      # → DI_BOOT_OK / exit 0

# Hardened deploy (once server bootstrap done)
DEPLOY_HOST=contabo DEPLOY_ROOT=/opt/neurecore ./scripts/deploy/neurecore-deploy.sh backend

# Failure/rollback proof (safe, local)
./scripts/deploy/deploy-sandbox-test.sh          # → 7/7 PASS

# Read-only post-deploy smoke (safe, live)
./scripts/deploy/post-deploy-smoke.sh            # → SMOKE OK
```
