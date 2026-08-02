# Onboarding

> Multi-step tenant onboarding wizard + industry / tier / package allocator. Last refreshed: 2026-07-31.

Plan ref: **WS-2** (Onboarding), **NC-OB-IMP-1** (allocator).

---

## 1. User journey

1. User signs up at `https://hq.neurecore.com/register`.
2. Backend creates `User` (no `tenantId`) + default tier's default tenant.
3. Tenant is **onboarding** state — limited permissions.
4. FE redirects to `/onboarding/setup` wizard (multi-step).
5. Each step submits answers; backend stores them.
6. Allocator computes a package recommendation based on answers + industry.
7. Tenant accepts a recommended package (or skips).
8. Backend applies the package: assigns department templates, agent
   templates, project types, solution packs.
9. Tenant moves to `ACTIVE` state; wizard redirects to `/home`.

---

## 2. Backend — `backend/src/modules/onboarding/`

### 2.1 Files
- `onboarding.module.ts` — wires the controller + service + checklist.
- `onboarding.controller.ts` — REST endpoints.
- `onboarding.service.ts` — orchestration: state machine, allocator hook,
  package application.
- `checklist/` — the step definitions + validators.
- `dto/` — request/response shapes.
- `interfaces/` — TS interfaces for the checklist contract.
- `__tests__/` — unit + integration tests.

### 2.2 Endpoints (typical)
- `GET  /api/v1/onboarding/state` — current wizard step + answers.
- `POST /api/v1/onboarding/step` — submit a step's answers.
- `POST /api/v1/onboarding/skip` — skip a step (some are optional).
- `GET  /api/v1/onboarding/recommendation` — package recommendation.
- `POST /api/v1/onboarding/apply` — apply a package + finish.
- `POST /api/v1/onboarding/restart` — restart wizard (admin only).

### 2.3 Allocator
`OnboardingAllocator` (registered by `seed-onboarding-allocator.cjs`):
- Maps `(industry, tier, answers)` → recommended package.
- Packages are composed of department templates + agent templates +
  project types + solution packs.
- Stored as rules in `OnboardingAllocator` (Prisma model); the seed
  script populates the default rules.

---

## 3. Industry taxonomy

### 3.1 Models
- `Industry` — leaf industry (e.g. `restaurant`, `dental-clinic`).
- `IndustryGroup` — parent group (e.g. `consumer-commerce`,
  `healthcare`).

### 3.2 Seed scripts
Under `backend/prisma/`:
- `seed-industries-compact.cjs`
- `seed-industries-majors.cjs`
- `seed-industry-templates.cjs` + 5 sector variants
- `seed-business-technology-templates.cjs`
- `seed-consumer-commerce-templates.cjs`
- `seed-industrial-infra-templates.cjs`
- `seed-healthcare-templates.cjs`
- `seed-public-social-templates.cjs`

Convenience: `pnpm seed:industry-templates:all` runs all six sector
seeders in order.

### 3.3 FE taxonomy data
- `frontend-tenant/src/lib/industries.ts` — industries list.
- `frontend-tenant/src/lib/industryGroups.ts` — group list.
- `frontend-tenant/src/lib/industryNavigation.ts` — wizard navigation
  data.
- `frontend-tenant/src/services/industries.service.ts` — API client.
- `frontend-tenant/src/services/industryGroups.service.ts`.

---

## 4. Question packs

- `backend/prisma/seed-question-packs.cjs` — seeds the question pack
  templates per industry.
- `pnpm seed:question-packs[:check]` — apply or verify.
- `pnpm test:seed:question-packs` — idempotency smoke test.

The wizard reads the question pack for the user's selected industry and
walks through it step by step.

---

## 5. Project types

- `backend/prisma/seed-project-types.cjs` — base project type library
  (e.g. `customer-onboarding`, `monthly-close`, `invoice-run`).
- `pnpm seed:project-types[:check]`.

These are the *templates* the allocator attaches when a tenant accepts a
package.

---

## 6. Packages

- `Package` (Prisma model) — composite of items.
- `PackageItem` — references to (DepartmentTemplate | AgentTemplate |
  ProjectType | SolutionPack).
- `backend/prisma/seed-package-catalogue.cjs` — base catalogue.
- `backend/prisma/seed-industry-packages.cjs` — industry-specific
  packages.

Apply during onboarding:
```bash
pnpm phase4:activate-accounting-domain   # one specific example
```
In code, `OnboardingService.applyPackage(packageId)` does this with a
UoW + outbox event.

---

## 7. FE wizard

`frontend-tenant/src/app/onboarding/setup/`:
- Multi-step form. State stored in `OnboardingState` on the backend (so
  the user can resume on another device).
- Helper code at `frontend-tenant/src/lib/wizard/`.
- Uses `onboarding.service.ts` (FE wrapper around the backend API).

---

## 8. Onboarding audit

`memory-bank-arc/onboarding-audit-2026-07-22.md` is a historical audit
of the onboarding flow. Keep it around for context but treat the
current docs (`this file` + the `WS-2` plan if needed) as canonical.

---

## 9. Common onboarding failures

| Symptom | Likely cause | Fix |
|---|---|---|
| Wizard stuck on step 1 after submit | `OnboardingState` row missing or stale | `POST /onboarding/restart` (admin) |
| "No recommendation" | Allocator rule missing for `(industry, tier)` combo | Check `seed-onboarding-allocator.cjs` ran; check rule exists |
| Applied package but departments empty | UoW failed mid-apply (outbox worker missing handler) | Check `OutboxWorker` logs; replay missing event manually |
| Tenant stuck in `ONBOARDING` | `OnboardingService.complete()` never called | Frontend didn't reach the success step; check console |

---

## 10. Source pointers

- `backend/src/modules/onboarding/onboarding.module.ts`
- `backend/src/modules/onboarding/onboarding.controller.ts`
- `backend/src/modules/onboarding/onboarding.service.ts`
- `backend/src/modules/onboarding/checklist/`
- `backend/prisma/seed-question-packs.cjs`
- `backend/prisma/seed-project-types.cjs`
- `backend/prisma/seed-onboarding-allocator.cjs`
- `backend/prisma/seed-industry-*.cjs`
- `backend/prisma/seed-business-technology-templates.cjs`
- `backend/prisma/seed-consumer-commerce-templates.cjs`
- `backend/prisma/seed-industrial-infra-templates.cjs`
- `backend/prisma/seed-healthcare-templates.cjs`
- `backend/prisma/seed-public-social-templates.cjs`
- `backend/prisma/seed-package-catalogue.cjs`
- `backend/prisma/seed-industry-packages.cjs`
- `frontend-tenant/src/app/onboarding/setup/`
- `frontend-tenant/src/lib/wizard/`
- `frontend-tenant/src/lib/industries.ts` + `industryGroups.ts` + `industryNavigation.ts`
- `frontend-tenant/src/services/onboarding.service.ts`