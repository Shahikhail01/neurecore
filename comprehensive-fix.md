# Comprehensive Fix Plan — NeureCore Industry Release

> **Goal:** Fix every reproducible defect from the 2026-07-23 browser verification on `hq.neurecore.com`, with 100 % SOLID principles, no new code duplication, and verifiable acceptance criteria. Backend changes are deployed to Contabo; frontend changes ship with the next `pnpm build` of `frontend-tenant`. The tenant created during verification (`arif.pratama.20260723.1655@example.com` / `PT Nusantara Audit Digital`) stays as the test account.

> **Round-1 closure (commit `6957b10` + `261f157` + `c78ad25`, 2026-07-23 14:56 PKT):** P0 backend defects (500 on `/tenant-templates`, 403-on-tier-limit on `/onboarding/select-template`, filter nested-error-code), P1 frontend (industries service async, picker copy, Indonesia locales, CompanyStep skip toggle), P2 test fixtures, P3 workspace honesty (Stage 2 ✓ badges replaced with placeholders).
>
> **Round-2 closure (commit `e5ceb45`, 2026-07-23 15:55 PKT):** four items originally filed under §8 as "out-of-scope" were actually fixable in-session. Universal template baseline + `apply-baseline` endpoint; `useRailInvalidationOnIndustryChange` hook for stale rail preferences; cross-tier approval guard with new `TierGuardOutcome` shape + `evaluateAgainstTier` registry method; `pnpm` toolchain locally installed. See [fixes.md §FIX-COMPREHENSIVE-R2](memory-bank-new/fixes.md#fix-comprehensive-r2--universal-template-baseline--rail-invalidation--approval-cross-tier-guard-2026-07-23-1730-pkt) for the full audit trail.
>
> **This document is the issue-to-file mapping. Round-2 entries are marked ✅ DONE in §6/§7 below. The remaining open items are documented in [pending-tasks.md §1](memory-bank-new/pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).**

---

## 0. Verified root causes (from live `pm2 logs` + Contabo probes)

| # | Code | Evidence | Status |
|---|---|---|---|
| P0-1 | `GET /api/v1/tenant-templates?type=AGENT_ROLE` → 500 | "TenantContext accessed outside a request scope" at `tenant-templates.controller.ts:33:41`. The **deployed JS** (`dist/src/modules/tenant-templates/tenant-templates.controller.js`) injects `tenantContext` and calls `this.tenantContext.tenantId`, while the local TypeScript source still uses `@CurrentUser() user` + raw `throw new Error`. Drift between TS source and compiled JS. | CONFIRMED P0 |
| P0-2 | `POST /api/v1/onboarding/select-template` → 403 PERMISSION_DENIED | Backend log: `Template "risk-compliance" requires 12 departments but tier "professional" allows 10`. Real rule, not auth. Mapped to `PERMISSION_DENIED`/`403` via `global-exception.filter.ts:65` — wrong HTTP semantics and wrong error code. UI cannot recover. | CONFIRMED P0 |
| P1-1 | `Tenant.industry` & `Tenant.industryGroup` = null after onboarding | `IndustryGroupPicker` returns "0 industries" (DB seeded but `by-group` endpoint never tested end-to-end). User never selected an industry → `PATCH /tenants/me` saved nothing → `Tenant.industryGroup` stayed null → `IconRail` falls back to generic items. | CONFIRMED P1 |
| P1-2 | Industry picker copy says "change this later under Tenant Settings" | `industryGroups.tsx:147` — false claim; industry is immutable for tenant users. | CONFIRMED P1 |
| P1-3 | `LocalizationStep` missing `Asia/Jakarta`, `Asia/Makassar`, `Asia/Jayapura`, `IDR` | `localization-step.tsx:21-48` — Indonesia not supported despite `INDUSTRY-GROUPS-CONCEPT.md` being global. | CONFIRMED P1 |
| P2-1 | `industries.service.listAllIndustries()` uses `.then(...).catch(...)` inside `Promise.all` map | `services/industries.service.ts:53-87` — anti-pattern; async/await is the consistent style in the rest of the file. | CONFIRMED P2 |
| P2-2 | `TierChangeModal.test.tsx` fixtures missing `yearlyPrice, maxApiCalls, maxFileSizeMB` | 5 mock rows cite a `Tier` shape that adds three required fields since FIX-PERF-001. | CONFIRMED P2 |
| P2-3 | `compliance.service.spec.ts` & `me.service.spec.ts` omit `meta: { timestamp, requestId }` | 12 callsites mock `ApiResponse<T>` shapes without the required `meta` field — see `frontend-tenant/src/types/api.types.ts:1-6`. | CONFIRMED P2 |
| P3-1 | Industry workspace routes show "Stage 2 ✓" badge but render `IndustryStubPage` placeholders | `frontend-tenant/src/components/industry/IndustryStubPage.tsx`. Marketing wins over engineering honesty. | PRODUCT/PROCESS |

---

## 1. Engineering principles (binding for every code change)

1. **Single Responsibility** — one concern per file/module; classes own ≤ 1 reason to change.
2. **Open/Closed, Liskov, Interface Segregation, Dependency Inversion** — extend by composition; depend on abstractions (`TenantContextService`, `TierResolver`).
3. **DRY** — every new helper leans on an existing single source of truth:
   * `Tenant.industryGroup` → `IndustryGroupsService.resolveIndustryGroup()`.
   * `TierCapabilityRow` → `tier-industry-matrix.getCapabilityMatrix()`.
   * `Tier` shape → schema + canonical seed (`seed-business-composition.cjs:38`).
   * `ApiResponse<T>` → `frontend-tenant/src/types/api.types.ts:1-6`.
4. **Tenant isolation invariant** — every Prisma query filters `tenantId`; platform roles use `PLATFORM_WILDCARD` sentinel and downstream services must explicitly branch.
5. **Backend ASP / Frontend Mirror** — frontend types mirror backend DTOs; never import backend files.
6. **No copy duplication** — success/error paths share helpers (`HttpExceptionFactory`, `tierLimitsError()`, `industriesError()`).
7. **Production parity** — TS source must compile to the deployed JS; CI rejects `tsc` drift.

---

## 2. P0 — Backend defects (must ship before any frontend fix is useful)

### BACKEND-P0-A — `/tenant-templates` 500 (TenantContext scope leak)

**File:** `backend/src/modules/tenant-templates/tenant-templates.controller.ts`
**Issue:** Compiled JS uses injected `TenantContextService`, TypeScript source uses `@CurrentUser() user.tenantId` + `throw new Error`. ALS scope bleed → 500 in some request flows.
**Fix (SOLID):**
- Single responsibility: one helper method `currentTenantContext()` returns `request.tenantContext` (already populated by `TenantContextGuard`).
- No raw `throw new Error` — use `ForbiddenException({ code: 'TENANT_CONTEXT_MISSING', message: '...' })` so it maps to a typed `403`/error code.
- Trust `tenantContext` already populated by the global guard; do not re-derive.
**Acceptance:**
- `curl /api/v1/tenant-templates?type=AGENT_ROLE` for an onboarded tenant → 200.
- For a SUPER_ADMIN without `x-tenant-id` → 403 with `TENANT_CONTEXT_MISSING`.
- Source compile matches `dist/`.

### BACKEND-P0-B — `/onboarding/select-template` 403 should be 422

**File:**
- `backend/src/modules/onboarding/onboarding.service.ts:188-207` (raise new `TierLimitExceededException`).
- `backend/src/common/filters/global-exception.filter.ts:65` (map new exception).
**Issue:** Honest call: 12 departments > tier max. Mapped to 403 PERMISSION_DENIED blocks UI recovery.
**Fix (SOLID):** Create `TierLimitExceededException extends BadRequestException` carrying structured payload `{ tier: { id, slug, maxDepartments, maxAgents }, projected: { departments, agents }, required: { departments, agents }, suggestions: smallerTemplateSlugs[] }`. Mapped to **422** with code `TIER_LIMIT_EXCEEDED` in `GlobalExceptionFilter`. UI receives actionable payload.
**Acceptance:**
- Selecting over-cap template → 422 + body `error.code === 'TIER_LIMIT_EXCEEDED'`.
- UI button shows "Upgrade tier or pick a smaller template" with link to `/settings/tiers`.
- Filters: 3xxx-tier templates always succeed; 5xxx-tier-hungry templates with allowed tier succeed.

### BACKEND-P0-C — persist `Tenant.industry` defensively

**File:** `backend/src/modules/tenants/tenants.service.ts:updateMine` (already correct) and `backend/src/modules/tenants/dto/update-my-tenant.dto.ts:44`.
**Issue:** Even when frontend omits `industry`, the existing service never wipes a previously set industry. Validated by re-reading code — `tenants.service.ts:259-266` correctly handles the missing-industry case.
**Action:** No code change required; add a regression test asserting that explicitly setting `industry: null` does not zero `industryGroup` unless `industry` was actually sent.
**Acceptance:** Re-running onboarding then sending `PATCH /tenants/me { timezone: 'Asia/Singapore' }` preserves the prior `industry` + `industryGroup`.

---

## 3. P1 — Frontend defects (SOLID, no copy duplication)

### FE-P1-A — `industriesService.listAllIndustries()` async/await rewrite

**File:** `frontend-tenant/src/services/industries.service.ts:53`
**Fix:** Replace `Promise.all(g.map(api.get(...).then(...).catch(...)))` with `await Promise.all(g.map(async (g) => { try { ... } catch { return []; } }))`. Mirrors the file's existing style (lines 40-43, 89-99 already use async/await).
**Acceptance:** No semicolon-after-if lint errors; same HTTP behaviour; faster compile.

### FE-P1-B — `IndustryGroupPicker` copy + Indonesia locales

**Files:**
- `frontend-tenant/src/components/onboarding/IndustryGroupPicker.tsx:147` — "change later under Tenant Settings" → "Contact your platform administrator if your industry needs to change."
- `frontend-tenant/src/app/onboarding/setup/steps/LocalizationStep.tsx:21-48` — add `Asia/Jakarta`, `Asia/Makassar`, `Asia/Jayapura`, `IDR — Indonesian Rupiah` to the shared `COMMON_TIMEZONES` / `COMMON_CURRENCIES` constants.
- Also export these constants so `ProfileWizard.tsx:14` and `LocalizationWizard.tsx:16` reuse them (DRY) — eliminate the 3 near-duplicate arrays across onboarding/profile/localization wizards.
**Acceptance:** Single source for timezone + currency lists; Indonesia demo data passes through end-to-end.

### FE-P1-C — Wizard guards (no silent skip)

**File:** `frontend-tenant/src/app/onboarding/setup/steps/CompanyStep.tsx` and `frontend-tenant/src/app/onboarding/setup/page.tsx`
**Fix:**
- If `isReRun === false` AND `industries === []` AND loader finished, surface a banner: "Industry catalogue is unavailable. Retry or contact support." and disable **Continue** until then.
- When the user clicks Continue without picking an industry (current behaviour lets them skip), surface an inline "Skip industry" toggle that explicitly clears `industry` and warns: "Without an industry, you'll only see generic templates, dashboards, and recommendations. You can change it by contacting your platform admin later."
- `onboarding/setup/page.tsx`: only jump to `step='plan'` when `reRun`; for first run, always start at `'company'`.
**Acceptance:** No tenant reaches `/home` with a missing industry silently. Re-run resumes at `plan`.

### FE-P1-D — Industry-aware rail cache invalidation

**File:** `frontend-tenant/src/lib/industryNavigation.ts` + `frontend-tenant/src/stores/tenantStore.ts`
**Issue:** Shared route IDs (`production`, `inventory`, `engagements`) can carry preferences across group changes. Product decision: clear rail preferences on industry change in the admin → tenant-app session start.
**Fix:** On `tenants/me` response, compare `industryGroup` with the cached value; if changed, bust `railPreferencesStore`.
**Acceptance:** Two-industry tenant reconciles rail preferences within the session.

**✅ DONE (round-2):** new hook `useRailInvalidationOnIndustryChange()` in `tenantStore.ts:138-191` watches the cached `industryGroup`, persists a per-browser watermark in `localStorage['neurecore-tenant-store.industryGroup.watermark']`, and calls `useRailPreferencesStore.getState().reset()` when the cached value differs from the watermark. Hooked from `IconRail.tsx:124` (single mount point). Verified live: stale `{hiddenItems: ['loans']}` was reset to `[]` after DB-flipped industry from `financial-compliance` → `healthcare-life-sciences`.

---

## 4. P2 — TypeScript / SOLID test defs

### TYPE-P2-A — TierChangeModal test fixtures

**File:** `frontend-tenant/src/components/tier/__tests__/TierChangeModal.test.tsx:30-32`
**Fix:** Extend each fixture row with `yearlyPrice: monthlyPrice * 10`, `maxApiCalls: 100_000`, `maxFileSizeMB: 200` (and basic tier's lower values) to satisfy the full `Tier` interface.
**Acceptance:** `pnpm type-check` passes.

### TYPE-P2-B — `ApiResponse.meta` fixtures

**Files:**
- `frontend-tenant/src/services/__tests__/compliance.service.spec.ts:25,50,59,68,79`
- `frontend-tenant/src/services/__tests__/me.service.spec.ts:32,53,70,83,95,107,117,127`
**Fix:** Add `meta: { timestamp: '2026-07-23T11:00:00Z', requestId: 'test-req-1' }` to every mocked restClient response.
**Acceptance:** `pnpm type-check` passes; tests still pass.

### TYPE-P2-C — Add TenantTemplatesController unit test

**New file:** `backend/src/modules/tenant-templates/tenant-templates.controller.spec.ts`
**Coverage:** 200 happy path, 403 when `tenantContext` absent, 200 when SUPER_ADMIN with `x-tenant-id`.
**Acceptance:** `pnpm test:cov` increases by 3 covered branches.

---

## 5. P3 — Product honesty & workspace placeholders

### PROD-P3-A — Demote misleading "Stage 2 ✓" badges

**File:** `frontend-tenant/src/components/industry/IndustryStubPage.tsx`
**Fix:** Replace the green "Stage 2" badge with a neutral "Coming soon — placeholder" banner. Provide an admin-side "Mark feature as ready" toggle in `frontend-admin/src/app/features/` for SUPER_ADMIN (single source — DB-backed).
**Acceptance:** No workspace route renders a deceptive "Stage 2 ✓" while its CRUD is unimplemented.

### PROD-P3-B — Plan Impact after direct industry selection

**File:** `frontend-tenant/src/app/onboarding/setup/steps/PlanStep.tsx:38-47`
**Fix:** After `selectTier`, also call `PATCH /tenants/me` with `industryHint` (sent only this turn — not stored) to refresh the PlanImpactPanel.
**Acceptance:** Switching tier refreshes panel without re-entering company step.

---

## 6. Validation matrix (per item)

| ID | Local validation | Remote validation | Browser re-verification |
|---|---|---|---|
| P0-A | `pnpm test:e2e backend/tests/tenant-templates` | `curl -b cookies /api/v1/tenant-templates?type=AGENT_ROLE` → 200 | refresh `/settings/templates`, expect list |
| P0-B | backend unit test | `curl /onboarding/select-template` with oversize template → 422 | reproduce 12-dept template with Pro tier; UI shows structured message |
| P1-A | `pnpm type-check` clean | n/a | refresh registration wizard, see industries populate |
| P1-B | `pnpm type-check` | n/a | new tenant in `Asia/Singapore`, `SGD`, `IDR` available |
| P1-C | `pnpm test frontend-tenant/__tests__/onboarding/` | n/a | cannot leave Company step without picking industry or explicitly skipping |
| P2-A | `pnpm type-check` | n/a | n/a |
| P2-B | `pnpm type-check` | n/a | n/a |
| P2-C | `pnpm test:cov` | n/a | n/a |
| P3-A | snapshot test in `IndustryStubPage.test.tsx` | n/a | open `/workspace/loans` etc.; badge gone |
| P3-B | manual click-trace | n/a | switch tier → panel refresh |

---

## 7. Build / deploy plan

1. **Local tooling:** `corepack pnpm@9.15.9 install` (one-off), then per app `pnpm install`, `pnpm verify`.
2. **Per fix:** implement → unit test → run `pnpm type-check && pnpm lint` → commit (`fix(<id>)`).
3. **Batch ship:**
   - Backend (`pnpm run build`) → `scripts/deploy.sh backend` to Contabo (keeps `ecosystem.config.js`).
   - Tenant frontend rebuild → `scripts/deploy.sh tenant`.
4. **Post-deploy smoke:**
   - `curl brain.neurecore.com/api/v1/health` → 200.
   - `pm2 logs neurecore-backend --lines 50 --nostream` → no new errors.
   - Refresh `hq.neurecore.com` and re-run the browser script from `verification-log.md`.

---

## 8. Status after Round-2 (2026-07-23 16:00 PKT)

The previous revision of this section marked items A.1 (rail invalidation), A.2 (approval-chain depth per tier), A.6 (seed-for-null-industry) and B.1 (pnpm toolchain) as "out-of-scope" — that filing was wrong. Round-2 (commit `e5ceb45`) closed all four:

- ✅ **Universal template baseline** — `backend/prisma/seed-platform-templates.cjs` adds 6 universal-baseline templates (`industrySlug = null`). `TenantTemplateSeeder.seedForTenant` now normalises empty-string `industrySlug` to `null` before the WHERE clause. New `POST /tenant-templates/apply-baseline` endpoint + `Apply Baseline` FE button. Verified live: my Indonesian demo tenant `7ecf36bf…` now has all 6 baselines seeded.
- ✅ **Rail invalidation hook** — `useRailInvalidationOnIndustryChange` in `tenantStore.ts`, wired from `IconRail.tsx`. Per-browser `localStorage` watermark prevents stale `loans`/`audits`/etc. preferences from leaking across `industryGroup` re-assignments.
- ✅ **Cross-tier approval guard** — `ApprovalAddonRegistry.evaluateAgainstTier` splits addon routes into eligible/blocked based on `Tier.maxApprovalStages`. `ApprovalChainsService.getIndustryRoutes` returns `TierGuardOutcome`. New unit spec covers 4 cases. Verified live: professional tier sees 3 of 4 financial-services routes eligible, the 4-stage `high-risk-client` blocked with `minTierSlug: 'enterprise'`.
- ✅ **`pnpm` toolchain on developer workstation** — `corepack enabled`, `pnpm@9.15.9` activated via `corepack prepare`, PATH persisted in `~/.bashrc`. `pnpm install`, `pnpm exec tsc`, `pnpm exec jest`, `pnpm exec eslint` all run locally without substitution.

### Genuine out-of-scope items (still pending — product decisions or pre-existing, NOT blocker defects)

- **A.3 — Compliance score uses hardcoded constants.** `backend/src/modules/compliance/checklist-definitions.ts` uses literal `0.85` for AML/HIPAA training rates. Real aggregation is a product task; tracked in [pending-tasks.md §A.3](memory-bank-new/pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- **A.4 — Industry-aware dashboard widgets.** `IndustryDashboardRenderer` exists but `/intelligence` falls back to the generic renderer. F&C widgets are registered (`widgets.controller.ts`) but no `?industryGroup=` filter is wired into the list endpoint. Tracked in [pending-tasks.md §A.4](memory-bank-new/pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- **A.5 — PlanImpactPanel requires `industry` to be set.** Acceptable trade-off (first-run tenants without industry get no preview). Documented behaviour, not a defect.
- **B.2 — Deploy script lockfile drift.** `scripts/deploy.sh` enforces `--frozen-lockfile` but `backend/package.json` includes `compression`/`lru-cache` added 2026-07-21 that the lockfile doesn't capture. The deploy sequence currently requires manually running `pnpm install --no-frozen-lockfile` on Contabo before `rebuild.sh`. `scripts/deploy.sh` should detect drift and pass the flag automatically. Tracked in [pending-tasks.md §B.2](memory-bank-new/pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- **B.3 — DRY timezone/currency lists in 2 other wizards.** `frontend-tenant/src/app/settings/wizard/[slug]/wizards/ProfileWizard.tsx:14` and `LocalizationWizard.tsx:16` still carry local duplicates. Tracked in [pending-tasks.md §B.3](memory-bank-new/pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- **B.4 — Source/JS drift detection.** `backend/dist/` exists in production but is not a CI artefact. The original root cause of the 500 was a TS source/JS drift in `tenant-templates.controller.ts`. Add `git diff --check` from `dist/` to `src/` as part of the deploy checklist. Tracked in [pending-tasks.md §B.4](memory-bank-new/pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- **C.1/C.2/C.3 — Test coverage gaps.** `TenantTemplatesController`, `GlobalExceptionFilter nested-error-code`, and `TierLimitExceededException` payload-shape unit tests are still missing. The cross-tier guard spec was added in round-2 (C.4 ✅).
- **D.1 — `MissionFeedAiPrioritizer` enum warnings.** Pre-existing, unrelated to this release.
- **D.2 — Upstash Redis unreachable.** Pre-existing; LRU cache masks latency since FIX-PERF-001.
- **D.4 — 3 pre-existing frontend chat tests fail.** `KeywordFallbackReply.test.ts:17` expects `Agents page` text but production copy says `Employees page`. `ChatService.test.ts` (2 cases) reference the same old copy. Tests never updated when copy was renamed. Tracked in [pending-tasks.md §D.4](memory-bank-new/pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).

---

## 9. Acceptance summary

- Every P0 backend defect has a verified red→green curl + log diff.
- Every P1 frontend defect has a manual browser trace + screenshot diff.
- Every P2 fixture def has a green `pnpm type-check`.
- Round-2 closures (universal baseline, rail invalidation, cross-tier approval guard, pnpm toolchain) have live verification evidence in [fixes.md §FIX-COMPREHENSIVE-R2](memory-bank-new/fixes.md#fix-comprehensive-r2--universal-template-baseline--rail-invalidation--approval-cross-tier-guard-2026-07-23-1730-pkt).
- No new code duplicated from existing helpers; single sources of truth enforced.
- No claim is "fixed" without reproducible evidence.
