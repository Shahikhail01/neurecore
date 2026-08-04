# Phase 0 — Completion Summary

**Phase:** 0 (Inventory, baseline matrix, duplication scan, collision resolution, tenant-isolation hardening)
**Branch:** `0010-harness-base` (continues Phase 10 line)
**Prepared:** 2026-08-04
**Plan source:** `neurecore/memory-bank-arc/comms/creatio-ai-parity-implementation-plan-v2.md` (v2.0)
**Related:** `NEURECORE-CREATIO-AI-PARITY-GAP-CLOSURE-PLAN-v3.md` (P-1 → P9 delivery program)

## 1. What was delivered

| # | Artifact | Path | Status |
|---|---|---|---|
| 1 | **Capability matrix** (152 rows, ~120 in scope) | `neurecore/memory-bank-arc/comms/creatio-ai-parity-matrix.yaml` | ✅ generated, validated |
| 2 | Matrix builder script | `neurecore/backend/scripts/build-matrix-from-v2.ts` | ✅ shipped |
| 3 | Matrix smoke test | `neurecore/backend/scripts/test-matrix.ts` | ✅ 7/7 assertions pass |
| 4 | Route-duplication detector | `neurecore/backend/scripts/detect-route-duplication.ts` | ✅ shipped |
| 5 | Route-duplication report | `neurecore/memory-bank-arc/comms/route-duplication-report.yaml` | ✅ 0 collisions |
| 6 | Wildcard-tenant-bypass detector | `neurecore/backend/scripts/detect-wildcard-tenant-bypass.ts` | ✅ shipped |
| 7 | Wildcard-tenant-bypass report | `neurecore/memory-bank-arc/comms/wildcard-tenant-report.yaml` | ✅ 0 unsafe bypasses |
| 8 | npm scripts | `pnpm parity:matrix:build / :check / :test`, `pnpm routes:scan / :scan:strict`, `pnpm tenancy:scan / :scan:strict` | ✅ added |

## 2. Capability matrix — final counts

```
totalRows        : 152
DONE             : 10
PARTIAL          : 69
NOT_STARTED      : 60
OUT_OF_SCOPE     : 13
distinct domains : 20
unique capability_ids : 152
```

Coverage of v2 §5 sections:

| Section | Domain | Rows |
|---|---|---|
| §5.1 | ai-studio (5 pillars) | 5 |
| §5.2 | ai-studio observability (6 sub-areas) | 6 |
| §5.3 | ai-twin | 8 |
| §5.4 | ai-trust-governance | 20 |
| §5.5 | ai-native-pillars | 4 |
| §5.6 | sales-agents (11) | 11 |
| §5.7 | marketing-agents (5) | 5 |
| §5.8 | service-agents (5) | 5 |
| §5.9 | service-platform (8) | 8 |
| §5.10 | marketing-platform (5) | 5 |
| §5.11 | sales-platform (5) | 5 |
| §5.12 | always-on-crm (3) | 3 |
| §5.13 | business-studio (18) | 18 |
| §5.14 | governance-app (12) | 12 |
| §5.15 | workflow-productivity (5) | 5 |
| §5.16 | channels (12) | 12 |
| §5.17 | data-ownership (7) | 7 |
| §5.18 | compliance (5) | 5 |
| §5.19 | analyst-recognition (5) | 5 |
| §5.20 | localization (3) | 3 |
| **Total** | | **152** |

## 3. Phase 0.5 — Collision resolution & tenant-isolation hardening

Phase 0 originally identified 7 route-prefix collisions and 9 wildcard-tenant-bypass sites. Both have been resolved.

### 3.1 Route-collision resolution (handler-level: 18 → 0)

| # | Collision | Canonical owner | Resolution |
|---|---|---|---|
| 1 | `GET /approvals/stratified` | `modules/governance/governance.controller.ts` | Removed duplicate from `modules/approvals/controllers/approvals.controller.ts`. |
| 2 | `/settings/ai/providers/*` (10 routes) | `modules/ai-gateway/controllers/ai-providers.controller.ts` | Renamed settings wrappers to `settings/ai/provider-preferences/*`. |
| 3 | `/workflows/*` (7 routes) | `modules/workflows/workflows.controller.ts` | Moved orchestration routes under `orchestration/*` (changed `@Controller({ version: '1' })` to `@Controller({ path: 'orchestration', version: '1' })`). |
| 4 | `POST /agents/:id/invocations` (already known bug) | `modules/agents/agent-invocations.controller.ts` | Confirmed documented fix (different method args) leaves no method-level collision. |
| 5 | `1::compliance` prefix | `modules/compliance/compliance.controller.ts` | Moved Hermes exports under `hermes-compliance/*`. |

After Phase 0.5, the scanner reports:
- **0 handler-level collisions** (was 18).
- **6 prefix shadows** remaining — all SRP-separated controllers with disjoint sub-paths; documented as intentional. The strict mode (`routes:scan:strict`) still accepts these because they are not runtime bugs.

### 3.2 Wildcard-tenant-bypass resolution (unsafe: 9 → 0)

Per v3 P-1 rule §11, every site that opted out of tenant isolation via `tenantId === '*'` was changed to **fail-closed** with a typed `ForbiddenException`. Files modified:

| File | Resolution |
|---|---|
| `modules/orchestration/services/workflows.service.ts` | Throw `ForbiddenException` on `'*'` |
| `modules/orchestration/services/tasks.service.ts` | Throw `ForbiddenException` on `'*'` |
| `modules/customers/repositories/prisma-customer.repository.ts` | Throw `ForbiddenException` on `'*'`; mandatory `tenantId` |
| `modules/projects/repositories/prisma-project.repository.ts` | Throw `ForbiddenException` on `'*'`; mandatory `tenantId` |
| `modules/goals/repositories/prisma-goal.repository.ts` | Throw `ForbiddenException` on `'*'`; mandatory `tenantId` |
| `modules/routines/repositories/prisma-routine.repository.ts` (×2) | Throw `ForbiddenException` on `'*'`; mandatory `tenantId` |
| `modules/departments/departments.controller.ts` | Removed `'*'` accept path; platform-admin path now requires explicit `?tenantId=` and PLATFORM role |
| `modules/agents/services/agents.service.ts` | Already safe (explicit `throw TENANT_WILDCARD_FORBIDDEN`); classified as safe by scanner |

After Phase 0.5, the tenancy scanner reports **0 unsafe wildcard bypasses** and 8 safe (explicit-deny) sites.

## 4. SOLID / no-duplication checks run

- `pnpm solid-guard.sh` → **0 violations** (industry-group slug literal guard).
- `pnpm test:matrix` → **7/7 assertions pass** (row count, id uniqueness, status distribution, required fields, domain coverage, --check stability).
- `pnpm routes:scan` → **0 handler collisions, 6 prefix shadows** (all SRP-separated, intentional).
- `pnpm tenancy:scan` → **0 unsafe wildcard bypasses, 8 safe (explicit deny)**.
- TypeScript strict typecheck on new scripts → **0 new errors** introduced. (Pre-existing harness-conformance errors and Prisma-schema drift in `workflows.service.ts:514`/`routines.repository.ts:124` are unrelated to Phase 0/0.5.)

## 5. How to run

```bash
# Matrix
pnpm parity:matrix:build      # regenerate matrix
pnpm parity:matrix:check      # CI: fail on drift
pnpm test:matrix              # smoke test

# Routes
pnpm routes:scan              # report
pnpm routes:scan:strict       # CI: fail on collision

# Tenant isolation
pnpm tenancy:scan             # report
pnpm tenancy:scan:strict      # CI: fail on unsafe bypass
```

## 6. Definition-of-done for Phase 0 + Phase 0.5

- [x] v2 plan re-researched and re-fetched (Aug 4, 2026).
- [x] Capability matrix extracted from v2 §5 with full traceability.
- [x] Matrix is the single source of truth (no manual edits; regenerate-only).
- [x] Matrix includes status, gap, phase, evidence path, source URL for every row.
- [x] Cross-domain overlaps surfaced as warnings, not errors (real v2 cross-references preserved).
- [x] Route-duplication detector shipped; 18 handler collisions → 0.
- [x] 6 prefix shadows documented as intentional SRP separations.
- [x] Wildcard-tenant-bypass detector shipped; 9 unsafe → 0.
- [x] No TS / no ESLint errors introduced by new files.
- [x] Existing SOLID guard still passes (0 violations).
- [x] Every changed file carries a `// Phase 0.5 ...` comment explaining the collision-resolution or P-1 rationale.

## 7. Open items handed to Phase 1

1. Phase 1 build work (AI Twin permission mirror, LLM Provider Registry) is now unblocked.
2. `pnpm routes:scan:strict` and `pnpm tenancy:scan:strict` should be added to CI so future PRs cannot regress.
3. The 6 prefix-shadow groups are intentional but should be reviewed for possible consolidation during the v3 P-6 (no-code) cleanup pass.
4. The `agents.service.ts:85` `TENANT_WILDCARD_FORBIDDEN` is currently a generic `Error`; consider promoting to a typed exception class shared across modules.
5. P-1 audit extension to cover AI Twin / Business Studio / Governance App (per v2 §16) is still pending — Phase 0.5 closed the existing-bypass surface but did not add a forward-looking audit pass on the new product surfaces.

## 8. Notes on scope fidelity

This document records Phase 0 + Phase 0.5 as **complete** for inventory, matrix extraction, route collision resolution, and tenant-isolation hardening. It does NOT claim Phase 1 features are built — only that the safety blockers for Phase 1 have been removed. The matrix still exposes the 60 NOT_STARTED rows; closing them is Phase 1 → P-9 work.

