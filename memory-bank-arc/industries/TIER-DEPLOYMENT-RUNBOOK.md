# Tier System Refactor — Phase 1 + Phase 2 Deployment Runbook

**Date:** 2026-07-21
**Migrations to apply:** 2 (additive only)
**Risk level:** LOW (both migrations are additive — no FK modifications, no row deletions)
**Estimated downtime:** None (migrations are non-blocking on PostgreSQL)
**Rollback:** DROP the new columns / tables; no data loss

---

## Overview

This runbook deploys TWO sequential migrations that refactor the Tier system per
`memory-bank-new/industries/TIER-SYSTEM-CONCEPT.md`:

| # | Migration | What it does |
|---|---|---|
| 1 | `20260721_tier_system_refactor` | Adds 10 columns to `Tier` + creates `TierAuditLog` + `TierChangeRequest` tables |
| 2 | `20260721_tier_template_phase2` | Adds `Package.tierId` (nullable) + backfills from `Package.tierTemplateId` |

Both are **additive**. No existing data is modified, deleted, or moved.

---

## Pre-requisites

Before deploying, verify:

- [ ] Source code has been rsynced to Contabo (or local sandbox)
- [ ] `.env.production` has `DATABASE_URL` pointing to the **Contabo local PostgreSQL** (`127.0.0.1:5433`)
- [ ] No pending Neon quota error (we're using Contabo)
- [ ] PM2 `neurecore-backend` is currently online and serving 200 on `/api/v1/health`
- [ ] DR snapshot from before this deploy exists in `/opt/neurecore/_archives/`

---

## Step 1: Verify current state (CONTABO)

```bash
ssh contabo
```

### 1.1 — Confirm Phase 1 is NOT yet deployed (check for new columns)

```bash
sudo -u postgres psql -d neurecore -c "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'tiers'
  AND column_name IN ('tagline', 'icon', 'billingCycle', 'trialDays',
                      'autoDowngradeTierId', 'maxApprovalStages',
                      'allowWhiteLabel', 'allowPredictiveAnalytics',
                      'allowCustomDashboards', 'allowMultiOffice')
ORDER BY column_name;
"
```

**Expected:** 0 rows (Phase 1 not yet deployed).
**If 10 rows returned:** Phase 1 was already applied — skip to Step 4.

### 1.2 — Confirm TierTemplate table still exists

```bash
sudo -u postgres psql -d neurecore -c "
SELECT COUNT(*) AS tier_template_count FROM tier_templates;
"
```

**Expected:** `4` (the 4 TierTemplate rows: starter, professional, enterprise, government).
**If 0:** something already went wrong — abort and investigate.

### 1.3 — Confirm packages table has `tierTemplateId` populated

```bash
sudo -u postgres psql -d neurecore -c "
SELECT
  COUNT(*) AS total_packages,
  COUNT(\"tierTemplateId\") AS with_tier_template,
  COUNT(\"tierId\") AS with_tier
FROM packages;
"
```

**Expected:**
```
 total_packages | with_tier_template | with_tier
----------------+--------------------+-----------
             68 |                 68 |         0
```

**If `with_tier > 0`:** Phase 2 was already partially applied — proceed but verify `with_tier == with_tier_template` before continuing.

### 1.4 — Take a DR snapshot

```bash
mkdir -p /opt/neurecore/_archives/20260721-pre-tier-refactor
sudo -u postgres pg_dump neurecore \
  --format=custom \
  --file=/opt/neurecore/_archives/20260721-pre-tier-refactor/pre-tier-refactor.dump
ls -lh /opt/neurecore/_archives/20260721-pre-tier-refactor/pre-tier-refactor.dump
```

**Expected:** dump file ~100-200 MB.

---

## Step 2: Deploy source code (CONTABO)

From your **local machine**:

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy/neurecore-deploy.sh backend contabo
```

This script:
1. Rsyncs source (excluding `.env.production`, `node_modules`)
2. Runs `prisma migrate deploy` on the target (this is what we're testing)
3. Runs `nest build`
4. Atomic-swaps the release symlink
5. Reloads PM2
6. Runs health checks

**Watch for:**
- "Phase 5: detect pending migrations" log line
- "Phase 6-7: acquire lock" + "apply migrations"
- "Phase 7: OK" — both migrations applied
- "Phase 8b: atomic switch current → <RELEASE_ID>"
- "Phase 9: reload PM2 (neurecore-backend)"
- "Phase 10: Health + route verification"

**Expected duration:** 3-5 minutes.

If the script fails at "Phase 5/6/7" (migrations), the live release is preserved (no swap). Investigate logs at `/opt/neurecore/_archives/<RELEASE_ID>/logs/` before retrying.

---

## Step 3: Verify Phase 1 deployed (CONTABO)

```bash
sudo -u postgres psql -d neurecore -c "
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'tiers'
  AND column_name IN ('tagline', 'icon', 'billingCycle', 'trialDays',
                      'autoDowngradeTierId', 'maxApprovalStages',
                      'allowWhiteLabel', 'allowPredictiveAnalytics',
                      'allowCustomDashboards', 'allowMultiOffice')
ORDER BY column_name;
"
```

**Expected:** 10 rows.

Verify the new tables exist:

```bash
sudo -u postgres psql -d neurecore -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tier_audit_logs', 'tier_change_requests')
ORDER BY table_name;
"
```

**Expected:** 2 rows.

Verify health:

```bash
curl -s https://brain.neurecore.com/api/v1/health
```

**Expected:** `{"status":"healthy",...}`

---

## Step 4: Run backfill script (CONTABO)

This populates the new `tier` columns with sensible defaults based on tier slug.

### 4.1 — Dry-run first

```bash
ssh contabo 'cd /opt/neurecore/backend/current && node prisma/backfill-tier-system.cjs --check'
```

**Expected output:**
```
── Backfilling Tier columns  [DRY RUN]
   ~ basic        Basic
   ~ business     Business
   ~ professional Professional
   ~ enterprise   Enterprise
   summary: 4 updated, 0 unchanged, 0 unknown slug(s)
```

**If you see `unknown slug(s)`:** the Tier table has rows with slugs not in `{basic, business, professional, enterprise}`. Investigate before proceeding:

```bash
sudo -u postgres psql -d neurecore -c "SELECT slug, name FROM tiers ORDER BY \"sortOrder\";"
```

### 4.2 — Apply for real

```bash
ssh contabo 'cd /opt/neurecore/backend/current && node prisma/backfill-tier-system.cjs'
```

**Expected:**
```
── Backfilling Tier columns
   ~ basic        Basic
   ~ business     Business
   ~ professional Professional
   ~ enterprise   Enterprise
   summary: 4 updated, 0 unchanged, 0 unknown slug(s)
   ✓ done.
```

### 4.3 — Verify backfilled values

```bash
sudo -u postgres psql -d neurecore -c "
SELECT slug, name, tagline, icon, \"billingCycle\", \"trialDays\", \"maxApprovalStages\",
       \"allowWhiteLabel\", \"allowPredictiveAnalytics\", \"allowCustomDashboards\",
       \"allowMultiOffice\"
FROM tiers
ORDER BY \"sortOrder\";
"
```

**Expected:** 4 rows with the values per `TIER-SYSTEM-CONCEPT.md` §4.

---

## Step 5: Verify Phase 2 deployed (CONTABO)

```bash
sudo -u postgres psql -d neurecore -c "
SELECT
  COUNT(*) AS total_packages,
  COUNT(\"tierTemplateId\") AS with_tier_template,
  COUNT(\"tierId\") AS with_tier
FROM packages;
"
```

**Expected:**
```
 total_packages | with_tier_template | with_tier
----------------+--------------------+-----------
             68 |                 68 |        68
```

The `with_tier` count should equal `total_packages`. The backfill in the migration
auto-populated `Package.tierId` from `Package.tierTemplateId` using the slug mapping.

### 5.1 — Spot-check the mapping

```bash
sudo -u postgres psql -d neurecore -c "
SELECT
  tt.slug AS tier_template_slug,
  t.slug AS tier_slug,
  COUNT(p.id) AS package_count
FROM packages p
LEFT JOIN tier_templates tt ON tt.id = p.\"tierTemplateId\"
LEFT JOIN tiers t ON t.id = p.\"tierId\"
GROUP BY tt.slug, t.slug
ORDER BY tt.slug, t.slug;
"
```

**Expected mapping:**
```
 tier_template_slug | tier_slug     | package_count
--------------------+---------------+---------------
 enterprise         | enterprise    | 19
 professional       | professional  | 43 (or whatever the actual count is)
 starter            | business      | 6
```

The important thing is that every `tier_template_slug` correctly maps to the right `tier_slug` per the TIER_TEMPLATE_TO_TIER mapping:

- `starter` → `business`
- `professional` → `professional`
- `enterprise` → `enterprise`
- `government` → `professional` (no government packages expected on prod)

### 5.2 — Verify no orphan packages (defensive check)

```bash
sudo -u postgres psql -d neurecore -c "
SELECT COUNT(*) AS orphans
FROM packages
WHERE \"tierTemplateId\" IS NOT NULL AND \"tierId\" IS NULL;
"
```

**Expected:** `0`. If non-zero, the migration's WARNING was triggered — investigate.

### 5.3 — Verify unique constraints and indexes

```bash
sudo -u postgres psql -d neurecore -c "
SELECT indexname
FROM pg_indexes
WHERE tablename = 'packages'
  AND indexname LIKE '%tier%'
ORDER BY indexname;
"
```

**Expected:**
- `packages_industryId_tierId_idx` (new index)
- `packages_industryId_tierId_slug_key` (new unique constraint)
- `packages_industryId_tierTemplateId_idx` (old index — kept)
- `packages_industryId_tierTemplateId_slug_key` (old unique — kept)

---

## Step 6: Verify API still works

The `/packages` API endpoint should now include `tier` (the billing tier) in addition to `tierTemplate`.

### 6.1 — Quick health check

```bash
curl -s https://brain.neurecore.com/api/v1/health
```

**Expected:** 200 OK, `{"status":"healthy"}`

### 6.2 — List packages (auth required — use a platform admin token)

```bash
TOKEN="<your-super-admin-jwt>"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://brain.neurecore.com/api/v1/packages?limit=5" | jq '.items[] | {id, slug, name, tierTemplateId, tierId}'
```

**Expected:** Each package has both `tierTemplateId` (legacy) and `tierId` (new) populated.

### 6.3 — Verify the tenant's current tier resolves

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://brain.neurecore.com/api/v1/tenants/me/current" | jq '.tier'
```

**Expected:** Tier object with `slug` matching one of `{basic, business, professional, enterprise}`. If slug is something else (e.g. `growth`), run the rename script (see Step 7).

---

## Step 7: (Optional) Rename legacy tier slugs

If the production Tier table has slugs like `growth` or `pro` (from the old system), they need to be renamed to match the new naming.

### 7.1 — Check current slugs

```bash
sudo -u postgres psql -d neurecore -c "SELECT id, slug, name FROM tiers ORDER BY \"sortOrder\";"
```

### 7.2 — Rename mapping (if needed)

| Old slug | New slug | Notes |
|---|---|---|
| `growth` | `business` | Renamed in TIER-SYSTEM-CONCEPT.md |
| `pro` | `professional` | Renamed in TIER-SYSTEM-CONCEPT.md |
| `starter` | `business` | Wait — there's no direct mapping if `starter` already existed separately. Audit before rename. |

### 7.3 — Rename SQL (review carefully before running)

```sql
BEGIN;

-- Update Tier slugs (DO NOT change IDs — Tenant.tierId FK must remain valid)
UPDATE tiers SET slug = 'business', name = 'Business'
  WHERE slug = 'growth';

UPDATE tiers SET slug = 'professional', name = 'Professional'
  WHERE slug = 'pro';

COMMIT;
```

**WARNING:** if multiple Tier rows have the same name (e.g. both `starter` and `business` exist), the rename will fail on the unique constraint. Audit first.

### 7.4 — Run backfill again after rename

```bash
ssh contabo 'cd /opt/neurecore/backend/current && node prisma/backfill-tier-system.cjs'
```

This re-applies attribute defaults based on the NEW slugs.

---

## Step 8: Re-run seed scripts to populate any gaps (CONTABO)

The migration handles backfill via SQL, but re-running seed scripts ensures the data is fully consistent with the source-of-truth definitions.

```bash
ssh contabo 'cd /opt/neurecore/backend/current'

# Industry pool (canonical 16)
node prisma/seed-industries-majors.cjs --check    # preview
node prisma/seed-industries-majors.cjs            # apply

# Accounting tier-16 add
node prisma/add-industry-accounting.cjs           # idempotent

# Packages catalogue (writes tierId + tierTemplateId)
node prisma/seed-package-catalogue.cjs --check
node prisma/seed-package-catalogue.cjs

# Accounting packages with composition
node prisma/seed-accounting-packages.cjs --check
node prisma/seed-accounting-packages.cjs

# Healthcare tenant templates (Run-6, D21)
node prisma/seed-healthcare-templates.cjs         # 5 customer-lifecycle + 5 agent-role + 4 routines + 4 reports + 5 task-templates + 1 dept-default
node prisma/seed-healthcare-department-template.cjs  # 1 healthcare-clinic DepartmentTemplate (8 depts) — Run-6 D21

# Healthcare agent templates + TierAgentPool (Run-6, D29)
node prisma/seed-healthcare-agent-templates.cjs    # 8 AgentTemplates + 8 TierAgentPool rows on Professional tier + 8 backfilled Agents for existing tenant
```

**Note:** seed scripts are idempotent. Re-running them is safe and only writes what's drifted.

### Run-6 (2026-07-25 20:06 PKT) — Healthcare seeders added

The 3 new healthcare seeders (`seed-healthcare-templates.cjs` from an earlier round + the 2 added in Run-6) are idempotent. Re-running them after any change to the canonical agent/department definitions will safely re-upsert rows.

**Order of operations (matters):**
1. `seed-healthcare-templates.cjs` first — seeds the system-level templates (TenantTemplate table with `tenantId=null`)
2. `seed-healthcare-department-template.cjs` second — seeds the platform-level DepartmentTemplate (the 8-dept structure tenants actually get)
3. `seed-healthcare-agent-templates.cjs` third — seeds the AgentTemplates + TierAgentPool rows + backfills existing tenants

If you skip #1 and only run #2, tenants get departments but no system-level templates. If you skip #3, tenants get departments but no agents (the original D29 issue). Always run all three after a healthcare-related deploy.

---

## Step 9: Sign off

Update `system-state.md` to record the deploy:

```markdown
**2026-07-21 HH:MM PKT — Tier System refactor Phase 1+2 deployed (Kilo):**
- ✅ Migration `20260721_tier_system_refactor` applied (Tier columns + audit log + change requests)
- ✅ Migration `20260721_tier_template_phase2` applied (Package.tierId + backfill)
- ✅ backfill-tier-system.cjs run — 4 tiers populated
- ✅ Tier slugs renamed: `growth` → `business`, `pro` → `professional` (if applicable)
- ✅ `mali@live.com` tenant verified — both `industry` and `tierId` resolve correctly
```

Commit the runbook + status update:

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
git add memory-bank-new/industries/ memory-bank-new/system-state.md
git commit -m "Tier System refactor: Phase 1 + Phase 2 deployed"
```

---

## Rollback procedure (if anything goes wrong)

### Scenario A: Phase 1 caused an issue (Tier table issues)

```sql
-- Drop new tables (cascades are limited; be careful)
DROP TABLE IF EXISTS tier_change_requests;
DROP TABLE IF EXISTS tier_audit_logs;

-- Drop new Tier columns
ALTER TABLE tiers DROP COLUMN IF EXISTS tagline;
ALTER TABLE tiers DROP COLUMN IF EXISTS icon;
ALTER TABLE tiers DROP COLUMN IF EXISTS "billingCycle";
ALTER TABLE tiers DROP COLUMN IF EXISTS "trialDays";
ALTER TABLE tiers DROP COLUMN IF EXISTS "autoDowngradeTierId";
ALTER TABLE tiers DROP COLUMN IF EXISTS "maxApprovalStages";
ALTER TABLE tiers DROP COLUMN IF EXISTS "allowWhiteLabel";
ALTER TABLE tiers DROP COLUMN IF EXISTS "allowPredictiveAnalytics";
ALTER TABLE tiers DROP COLUMN IF EXISTS "allowCustomDashboards";
ALTER TABLE tiers DROP COLUMN IF EXISTS "allowMultiOffice";
```

### Scenario B: Phase 2 caused an issue (Package table issues)

```sql
-- Drop Package.tierId (CASCADE removes FK + index + unique)
ALTER TABLE packages DROP COLUMN IF EXISTS "tierId";
```

### Scenario C: Total rollback (full DB restore from DR snapshot)

```bash
ssh contabo
sudo -u postgres pg_restore \
  --clean --if-exists \
  --dbname=neurecore \
  /opt/neurecore/_archives/20260721-pre-tier-refactor/pre-tier-refactor.dump
```

Then PM2 reload:

```bash
pm2 reload neurecore-backend --update-env
```

---

## Success criteria (all must be true)

- [ ] `tiers` table has 10 new columns
- [ ] `tier_audit_logs` and `tier_change_requests` tables exist
- [ ] `packages.tierId` is populated for all 68 packages (matches `tierTemplateId` mapping)
- [ ] All 4 Tier rows have taglines + icons + billingCycle + maxApprovalStages populated
- [ ] `/api/v1/health` returns 200
- [ ] `/api/v1/packages` endpoint returns packages with both `tierTemplateId` and `tierId`
- [ ] `/api/v1/tenants/me/current` returns a Tier object with slug in `{basic, business, professional, enterprise}`
- [ ] Tier × Industry matrix works for `mali@live.com` tenant
- [ ] No errors in PM2 logs (`pm2 logs neurecore-backend --lines 200`)
- [ ] DR snapshot exists at `/opt/neurecore/_archives/20260721-pre-tier-refactor/`
- [ ] `system-state.md` updated with deploy record

---

## Step 10: Deploy-path notes (2026-07-25 — Run-4 discovery, Run-6 application)

### PM2 working directory ≠ deploy release path

**Discovery:** The `neurecore-deploy.sh` script stages tenant builds into `apps/tenant/releases/<id>/` and atomically switches the `apps/tenant/current` symlink. However, PM2's `neurecore-tenant` process runs with:

- **exec cwd:** `/opt/neurecore/frontend-tenant`
- **script:** `/opt/neurecore/frontend-tenant/start.sh`
- **start command:** `next start --hostname 127.0.0.1 --port 3001`

The atomic symlink switch has **no effect** on the running process because Next.js reads all build output from the PM2 working directory, not from `apps/tenant/current/`.

**Impact:** After a successful tenant deploy (build + symlink switch + `pm2 reload`), the live server continues to serve the **old build** (old chunk hashes, old code paths). The new build output sits unused in `apps/tenant/current/.next/`.

**Workaround (until root fix):**
```bash
# After neurecore-deploy.sh tenant succeeds (or after manual build):
rsync -a --delete /opt/neurecore/apps/tenant/current/.next/ /opt/neurecore/frontend-tenant/.next/
pm2 reload neurecore-tenant
```

**Run-6 application (2026-07-25 20:06 PKT):** During the Run-6 deploy, even `pm2 reload` after the rsync was not enough — the served chunk hash was still `5e179e01ad97dc6e.js` (old build) after `pm2 reload` completed. The actual fix that worked was a **hard restart**:

```bash
ssh contabo 'pm2 delete neurecore-tenant && pm2 start /opt/neurecore/frontend-tenant/start.sh --name neurecore-tenant'
```

This is because `pm2 reload` sends SIGTERM and lets the process exit gracefully, but the in-memory chunk map is preserved. A delete+start forces a fresh process to read the new `.next/` directory.

**Confirmation of correct deployment (Run-6):**
```bash
# After delete+start, verify the new chunks are served
curl -s https://hq.neurecore.com/customers | grep -oE 'page-[a-f0-9]+\.js' | head -1
# Post-fix: page-7c78b16b54085b44.js   ← matches the BUILD_ID kjq8c2P6IxZLl0VhEI45H
# Pre-fix (failed deploy): page-5e179e01ad97dc6e.js   ← old BUILD_ID AvR2sZT1T9sTdobxhbYpZ
```

**Root fix options (still pending):**
1. Update `neurecore-deploy.sh` Phase 9 to rsync the built `.next/` into `/opt/neurecore/frontend-tenant/` AND use `pm2 delete + pm2 start` instead of `pm2 reload` before reloading PM2.
2. Update the PM2 ecosystem config to set `cwd` to `apps/tenant/current/` and update `start.sh` to reference the symlink path.
3. Change the `neurecore-deploy.sh` target to build directly into `/opt/neurecore/frontend-tenant/`.

**Recommended fix (deferred to next run):** Modify `rebuild.sh` (the on-Contabo rebuild script) to use `pm2 delete` + `pm2 start` instead of `pm2 startOrReload`. The `startOrReload` mode keeps the old process; `delete + start` forces a fresh process. Cost: ~5 seconds of additional downtime per tenant deploy. Trade-off: better correctness vs slightly longer outage. Recommend implementing alongside the rsync-into-PM2-cwd fix in option 1.

**Also explains:** The tenant deploy's post-deploy health check (Phase 10) routinely returns 503 because Next.js cold-start takes ~5-8 seconds and the 3-second health probe times out. Increasing the probe delay or adding a retry loop would fix this.

---

## When to proceed with Phase 3 (TierTemplate removal)

Only after ALL of the above is verified AND `mali@live.com` tenant is functioning
correctly for at least 24 hours. Phase 3 is irreversible from the UI side and
touches the frontend admin pages.
