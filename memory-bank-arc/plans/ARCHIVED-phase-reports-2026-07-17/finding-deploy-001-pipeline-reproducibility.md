# FINDING: Deployment Pipeline Reproducibility Failure

**ID:** DEPLOY-001
**Date raised:** 2026-07-13
**Severity:** HIGH (blocks reliable, reproducible deployments)
**Status:** OPEN — tracked, not yet remediated
**Raised during:** Phase 1 / Phase 1.1 EIE work

---

## Summary

The `scripts/deploy.sh` pipeline cannot reliably deploy the tenant frontend or the
backend without manual intervention. Multiple independent failures were observed and
required manual `rsync` + on-server `build` + `pm2 reload` recovery. **Manual server
synchronization was used to complete the work, and it must NOT be treated as a
successful, repeatable deployment pipeline.**

---

## Observed Failures

### 1. `pnpm --frozen-lockfile` failure (tenant frontend)

`deploy.sh` runs `pnpm install --frozen-lockfile`. The install aborted with:

```
specifiers in the lockfile (...) don't match specs in package.json (...)
lucide-react: lockfile "^1.7.0" vs package.json "^0.460.0"
```

The `pnpm-lock.yaml` and `package.json` have drifted for `lucide-react` (and the
lockfile carries React-19-incompatible peer ranges for `use-sync-external-store`).
`--frozen-lockfile` (CI default) refuses to proceed, aborting the deploy **before the
rsync/build steps completed**.

### 2. Source / lockfile dependency drift

`package.json` and `pnpm-lock.yaml` are out of sync. This is a repository hygiene
problem: the lockfile was not regenerated after a dependency spec change. Any
`--frozen-lockfile` environment (CI, fresh clone, container build) will fail
identically.

### 3. Stale deployed frontend source

The server's `/opt/neurecore/neurecore-tenant/src/components/discovery/` module was
**older than the committed local source** — it was missing `existingResponse` in
`useAdaptiveNext` and other Phase-1 discovery changes. A prior deploy had evidently
failed partway (install/build aborted) leaving the server source stale while the
process kept running old compiled output. The deploy pipeline did not detect or
surface this drift.

### 4. Backend migration advisory-lock abort during rebuild

The backend `deploy.sh` repeatedly aborted its `nest build` step because the Prisma
`migrate` step timed out on a Postgres advisory lock:

```
Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(...))
```

Because the migrate step ran (and failed) *before* `nest build` in the script, the
build never executed and the deployed `dist/` stayed stale even though rsync had
updated `src/`. This produced a confusing state where source had the fix but the
running compiled output did not.

### 5. Manual recovery used (NOT a pipeline)

To complete Phase 1 / 1.1, the following manual steps were used repeatedly:

```
rsync -az --exclude node_modules --exclude dist --exclude .env* <local>/src/ contabo:<remote>/src/
ssh contabo 'cd <remote> && npx nest build'          # backend
ssh contabo 'cd <remote> && ./node_modules/.bin/next build'   # tenant
ssh contabo 'pm2 reload <process>'
```

This works but is **not reproducible, not atomic, not verifiable, and bypasses the
lockfile guarantee**. It must not be considered the deployment mechanism.

---

## Impact

- Deploys are not reproducible; a fresh environment or CI cannot build.
- Partial deploy failures leave source/dist/running-process in inconsistent states
  with no detection.
- The `--frozen-lockfile` guarantee (reproducible installs) is currently unachievable.
- Backend deploys can silently ship stale `dist/` when the pre-build migrate step fails.

---

## Recommended Remediation (not yet done)

1. **Fix lockfile drift:** regenerate `pnpm-lock.yaml` against the current
   `package.json` (`pnpm install`), commit it, and verify `pnpm install --frozen-lockfile`
   succeeds from a clean checkout. Resolve the `lucide-react` version spec and the
   React-19 peer range for `use-sync-external-store`.
2. **Reorder backend deploy steps:** run `nest build` BEFORE (or independently of)
   `prisma migrate`, or make the migrate step resilient to advisory-lock contention
   (retry/backoff, or skip when no pending migrations). A failed migrate must not
   silently skip the build.
3. **Fail loudly on partial deploy:** the script should abort the whole deploy (non-zero
   exit) and NOT reload PM2 if install/build fails, and should verify the deployed
   `dist`/`.next` build hash matches the just-built artifact.
4. **Add a post-deploy verification gate:** boot check + a route smoke test (e.g. the
   EIE endpoints) before declaring success.
5. **Add a DI boot test to CI:** `NestFactory.createApplicationContext(AppModule)`
   catches circular-dependency and provider-resolution errors before deploy (this
   would have caught the Phase 1.1 circular-dependency outage locally).

---

## Cross-reference

See `plans/phase-1-eie-runtime-integration-report.md` — the Phase 1.1 circular-
dependency outage (backend 503) was caused by deploying without a local DI boot test;
recovery required restoring `dist/` from the pre-deploy snapshot. Both the drift and
the missing pre-deploy verification are captured here.
