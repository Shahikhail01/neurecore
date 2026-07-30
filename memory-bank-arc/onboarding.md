# Onboarding & Full-Setup System

> **Status**: Implemented 2026-07-22 | HONESTLY audited 2026-07-22 12:30 PKT | Verified Round-1 + Round-2 (2026-07-23 15:55 PKT)
>
> This document catalogs the complete onboarding wizard and post-onboarding
> Setup Center implementation — what is done, what the architecture is, and
> what remains intentionally deferred.
>
> See `onboarding-audit-2026-07-22.md` for the honest audit including:
> - Test results: 35 backend + 27 frontend tests passing
> - 1 critical bug found and fixed (resume-after-refresh bypassed IntegrationsStep)
> - HONEST list of incomplete wiring for 5 of 13 wizards
> - Real Google OAuth return-to-onboarding not handled (hard-coded to /settings)
>
> **2026-07-23 (FIX-COMPREHENSIVE + R2) delta:**
> - `CompanyStep` adds an explicit "Skip industry for now" toggle with consequence copy; Continue disabled when industry catalogue is empty or loading.
> - `IndustryGroupPicker` copy corrected to "Contact your platform administrator if your industry needs to change" (industry is Super-Admin-only post-onboarding per INDUSTRY-GROUPS-CONCEPT.md §1.2 D7).
> - `LocalizationStep` consumes the DRY `lib/locale-options.ts` (Asia/Jakarta, Asia/Makassar, Asia/Jayapura, IDR).
> - After onboarding, tenants that picked Skip-industry get the universal template baseline via `POST /tenant-templates/apply-baseline` (new in FIX-A). See [fixes.md §FIX-COMPREHENSIVE-R2](fixes.md#fix-comprehensive-r2--universal-template-baseline--rail-invalidation--approval-cross-tier-guard-2026-07-23-1730-pkt).
> - The IconRail that the wizard injects is now bust-friendly across `industryGroup` changes (FIX-B `useRailInvalidationOnIndustryChange`).

---

## 1. System Architecture

The onboarding system has **two layers**:

```
┌───────────────────────────────────────────────────────┐
│  Layer 1: Initial Onboarding (7-step wizard)          │
│  /onboarding/setup                                     │
│                                                        │
│  Company → Logo → Localization → Plan → Template →     │
│  Integrations → Complete → redirect to /home           │
└───────────────────────┬───────────────────────────────┘
                        │ POST /onboarding/complete
                        ▼
┌───────────────────────────────────────────────────────┐
│  Layer 2: Post-Onboarding Setup Center (13 wizards)    │
│  /settings/wizard                                       │
│  /settings/wizard/[slug]                                │
│                                                        │
│  Phase 0: Foundation  (3 items, weight 3 each)         │
│  Phase 1: Communication (2 items, weight 2 each)       │
│  Phase 2: Operations   (2 items, weight 1-2)           │
│  Phase 3: Team & Admin (4 items, weight 1 each)        │
│  Phase 4: Polish       (2 items, weight 1 each)        │
└───────────────────────┬───────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│  Dashboard: ThingsToDoPanel (phase-aware floating card)│
│  Shows weighted progress, next recommended item,       │
│  phase grouping, dependency locks                      │
└───────────────────────────────────────────────────────┘
```

**Data flow:**
```
User Action → Component → Zustand Store (optimistic update)
  → Service (axios) → Backend API (NestJS) → Prisma
                                                  ↓
                                            Rollback on error
```

---

## 2. Initial Onboarding (`/onboarding/setup`)

### 2.1 Steps (7 total)

| # | Step | Component | Backend Action | Status |
|---|------|-----------|----------------|--------|
| 1 | Company | `CompanyStep.tsx` | `PATCH /tenants/me` (name, industry) | ✅ |
| 2 | Logo | `LogoStep.tsx` | `PATCH /tenants/me` (logoUrl) | ✅ |
| 3 | Localization | `LocalizationStep.tsx` | `PATCH /tenants/me` (tz, currency, formats) | ✅ |
| 4 | Plan | `PlanStep.tsx` | `POST /onboarding/select-tier` | ✅ |
| 5 | Template | `TemplateStep.tsx` | `POST /onboarding/select-template` | ✅ |
| 6 | **Integrations** | `IntegrationsStep.tsx` | UI only (Google OAuth + Brevo connect) | **NEW** |
| 7 | Complete | `CompleteStep.tsx` | `POST /onboarding/complete` | ✅ Updated |

### 2.2 Integrations Step (NEW)

The Integrations step was added between Template and Complete. It shows:
- Google Workspace connect card (OAuth flow, scope display)
- Brevo connect card (API key input, connection status)
- Users can connect or skip both and configure later from Setup Center

This step was added because Google Workspace and Brevo are **vital for company
working** (documentation, calendar, email, notifications).

### 2.3 CompleteStep Updates

The CompleteStep now:
1. Calls `POST /onboarding/complete` (moved from TemplateStep — was being called
   prematurely)
2. Shows a "Next Up" preview of all 5 Setup Center phases with progress bar
3. Redirects to `/home` after 1.5s

### 2.4 Auth Gating

Users with `tenant.onboardingCompletedAt === null` are redirected to
`/onboarding/setup`. The wizard works identically for **all 4 tiers**
(Basic, Business, Professional, Enterprise).

---

## 3. Post-Onboarding Setup Center (`/settings/wizard`)

### 3.1 Checklist Config (`checklist.config.ts`)

Single source of truth defining 13 wizards. Each has:
- `slug`, `title`, `description`, `estimatedValue`, `estimatedMinutes`
- `priority` (HIGH/MEDIUM/LOW)
- `skippable` (boolean)
- `phase` (0-4) — drives Setup Center grouping
- `weight` (1-3) — drives weighted progress calculation
- `dependsOn` (string[]) — dependencies for smart reordering

### 3.2 The 13 Wizards by Phase

**Phase 0 — Foundation** (weight 3, must-do before anything else):

| Slug | Title | Skippable | Dependency | Fields |
|------|-------|-----------|------------|--------|
| `company` | Company Profile | yes | none | website, size, founded year, business type, phone, support email |
| `localization` | Localization & Currency | yes | none | timezone, currency, locale, date format, time format, fiscal year |
| `security` | Security | **no** | company | 2FA toggle, session timeout, password change |

**Phase 1 — Communication & Documents** (weight 2, vital for company working):

| Slug | Title | Skippable | Dependency | Fields |
|------|-------|-----------|------------|--------|
| `google-workspace` | Google Workspace | yes | company | OAuth connect, scope display, disconnect |
| `brevo` | Brevo Email | yes | company | API key, sender identity, usage stats, test send |

**Phase 2 — Operations** (weight 1-2):

| Slug | Title | Skippable | Dependency | Fields |
|------|-------|-----------|------------|--------|
| `ai-ops` | AI & Operations | yes | company | AI provider, model, budget, authority level |
| `integrations` | Integrations | yes | company | Status overview, links to settings |

**Phase 3 — Team & Admin** (weight 1):

| Slug | Title | Skippable | Dependency | Fields |
|------|-------|-----------|------------|--------|
| `billing` | Billing Profile | yes | company | Tax ID, contact, invoice cadence, address |
| `team` | Invite Team | yes | company | Bulk email invites, role assignment |
| `profile` | Your Profile | yes | none | Name, phone, job title, timezone |
| `org` | Org Placement | yes | team | Department selector |

**Phase 4 — Polish** (weight 1):

| Slug | Title | Skippable | Dependency | Fields |
|------|-------|-----------|------------|--------|
| `preferences` | Notifications & UX | yes | profile | Digest cadence, quiet hours, theme |
| `compliance` | Compliance | yes | billing | Data residency, AUP/DPA, retention |

### 3.3 Weighted Progress

Progress = (doneWeight / totalWeight) × 100

```
Phase 0: company(3) + localization(3) + security(3) = 9
Phase 1: google-workspace(2) + brevo(2)            = 4
Phase 2: ai-ops(2) + integrations(1)                = 3
Phase 3: billing(1) + team(1) + profile(1) + org(1) = 4
Phase 4: preferences(1) + compliance(1)             = 2
Total: 22 weighted points
```

This accurately reflects true completion — completing 10 low-weight items
but missing Google Workspace yields 20/22 = 91%, correctly signaling
"almost done but you're missing a vital integration."

### 3.4 Dependency Graph

```
security ──────► company ──► localization
                     │
                     ▼
              google-workspace ──► brevo
                     │
                     ▼
              ai-ops ──► integrations
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
       billing               team
          │                     │
          ▼                     ▼
       compliance            profile ──► org
                                  │
                                  ▼
                             preferences
```

Items with unmet dependencies show a lock icon and tooltip.

### 3.5 ThingsToDoPanel (Dashboard)

Phase-aware floating card on `/home`:
- Weighted progress bar with percentage
- "Recommended next" item (first visible pending whose dependencies are met)
- Phase rows with per-phase progress and up to 2 visible items each
- Lock icons for dependency-blocked items
- "View all" links for phases with >2 pending items
- "Hide this panel" button (dismisses globally)

### 3.6 Settings Wizard Index (`/settings/wizard`)

Full-phase listing page:
- Header with overall weighted progress bar
- Phase sections with title, description, per-phase progress bar
- Each item as a card with state badge (Done/Skipped/Pending/Locked)
- Dependency info shown on locked items
- Phase checkmark when all items in phase are done/skipped

---

## 4. File Manifest

### Backend (2 files changed)

| File | Change |
|------|--------|
| `backend/.../checklist/checklist.config.ts` | Added `google-workspace`, `brevo` entries; added `phase`, `weight`, `dependsOn` fields to `WizardConfig`; added `WIZARD_PHASES`, `PHASE_LABELS`, `PHASE_DESCRIPTIONS` exports |
| `backend/.../checklist/checklist.service.ts` | Seed comment updated (11→13); `actionPayload` now includes `phase`, `weight`, `dependsOn`; list response includes `phase`, `weight`, `dependsOn` in config |

### Frontend (18 files changed/created)

| File | Change |
|------|--------|
| `lib/wizard/types.ts` | Added `WizardSlug` values `google-workspace`, `brevo`; added `phase`, `weight`, `dependsOn` to `WizardConfig`; added `WIZARD_PHASES`, `PHASE_LABELS`, `PHASE_DESCRIPTIONS` |
| `hooks/useOnboardingChecklist.ts` | Added `phaseProgress`, `byPhase`, `nextRecommended`, `doneSlugs`; weighted progress calculation |
| `components/checklist/ThingsToDoPanel.tsx` | Rewritten with phase-aware display, weighted progress, dependency locking, next-recommended item |
| `app/settings/wizard/page.tsx` | Rewritten with phase grouping, weighted per-phase progress bars, lock indicators |
| `app/settings/wizard/[slug]/page.tsx` | Rewritten with wizard component registry dispatching to per-slug implementations |
| `app/settings/wizard/[slug]/wizards/CompanyWizard.tsx` | **NEW** — Full form with website, size, founded year, business type, phone, support email |
| `app/settings/wizard/[slug]/wizards/LocalizationWizard.tsx` | **NEW** — Full form with timezone, currency, locale, date/time format, fiscal year |
| `app/settings/wizard/[slug]/wizards/BillingWizard.tsx` | **NEW** — Full form with tax ID, contact, invoice cadence, address |
| `app/settings/wizard/[slug]/wizards/ProfileWizard.tsx` | **NEW** — Full form with name, phone, job title, timezone |
| `app/settings/wizard/[slug]/wizards/PreferencesWizard.tsx` | **NEW** — Full form with digest, quiet hours, theme |
| `app/settings/wizard/[slug]/wizards/SecurityWizard.tsx` | **NEW** — Full form with 2FA, session timeout, password |
| `app/settings/wizard/[slug]/wizards/AiOpsWizard.tsx` | **NEW** — Full form with provider, model, budget, authority |
| `app/settings/wizard/[slug]/wizards/OrgWizard.tsx` | **NEW** — Department selector |
| `app/settings/wizard/[slug]/wizards/IntegrationsWizard.tsx` | **NEW** — Integration status overview |
| `app/settings/wizard/[slug]/wizards/ComplianceWizard.tsx` | **NEW** — Full form with residency, AUP/DPA, retention |
| `app/settings/wizard/[slug]/wizards/TeamWizard.tsx` | **NEW** — Bulk email invites with role assignment |
| `app/settings/wizard/[slug]/wizards/GoogleWorkspaceWizard.tsx` | **NEW** — Google OAuth connect, scope display, disconnect |
| `app/settings/wizard/[slug]/wizards/BrevoWizard.tsx` | **NEW** — Brevo API key, sender identity, usage stats |
| `app/onboarding/setup/page.tsx` | Added Integrations step (step 6), updated step labels |
| `app/onboarding/setup/steps/TemplateStep.tsx` | Added `onNext` prop; moved `complete()` call to CompleteStep |
| `app/onboarding/setup/steps/IntegrationsStep.tsx` | **NEW** — Google + Brevo connect cards |
| `app/onboarding/setup/steps/CompleteStep.tsx` | Rewritten with Setup Center phase preview |

---

## 5. Integration Wiring

### 5.1 Google Workspace

The `GoogleWorkspaceWizard` and onboarding `IntegrationsStep` use the
existing `integrationsService` (`services/integrations.service.ts`):
- `getGoogleStatus()` — check connection
- `initiateGoogleOAuth()` — start OAuth flow
- `disconnectGoogle()` — revoke connection

The Google Workspace integration itself (Drive, Gmail, Calendar, Sheets
services + agent tools) is fully implemented — 173 tests across 15 suites.
The wizard just wraps the existing OAuth flow in the setup experience.

### 5.2 Brevo

The `BrevoWizard` and onboarding `IntegrationsStep` use the existing
`integrationsService`:
- `getBrevoStatus()` — check connection
- `connectBrevo(apiKey)` — save per-tenant API key
- `disconnectBrevo()` — remove connection
- `getBrevoUsage()` — show daily quota

The Brevo integration itself (send, batch, webhooks, suppression,
admin dashboard) is fully implemented — 187 tests. Tenants without
their own key fall back to the platform master key.

---

## 6. Honest Assessment: What's Complete vs Deferred

### ✅ Fully Complete

| Item | Notes |
|------|-------|
| Backend checklist config with 13 entries + phase/weight/dependsOn | All fields defined, no DB migration needed (config-only) |
| Checklist service returns phase/weight/dependsOn in responses | Mission feed items + list endpoint updated |
| Frontend wizard types with phase/weight/dependsOn | Mirrors backend exactly |
| `useOnboardingChecklist` hook with weighted progress | Phase progress, next-recommended, dependency checking |
| `ThingsToDoPanel` phase-aware display | Weighted bar, phase rows, lock icons, recommended next |
| `/settings/wizard` index with phase grouping | Per-phase headers, progress bars, lock indicators |
| All 13 wizard [slug] pages with actual form content | Each has meaningful fields and save/complete wiring |
| Google Workspace wizard page | OAuth connect, scope display, disconnect |
| Brevo wizard page | API key, sender identity, usage stats |
| Integrations step in Initial Onboarding (step 6) | Google + Brevo connect cards |
| CompleteStep with Setup Center preview | Shows all 5 phases with weighted progress |
| TypeScript compiles clean (both frontend + backend) | `npx tsc --noEmit` returns no errors |

### 🟡 Partially Complete

| Item | Status | Gap |
|------|--------|-----|
| Security wizard writes to real endpoints | ✅ UI complete | Backend 2FA/password endpoints need wiring — currently calls `storeComplete()` only |
| Profile wizard writes to user endpoint | ✅ UI complete | `PATCH /users/me` endpoint not available — currently calls `storeComplete()` only |
| Org wizard writes to user endpoint | ✅ UI complete | `PATCH /users/me` endpoint not available — currently calls `storeComplete()` only |
| Compliance wizard writes to backend | ✅ UI complete | No compliance acceptance endpoints yet — currently calls `storeComplete()` only |
| Brevo sender identity persistence | ✅ UI collects fields | Sender name/email not yet sent to `PUT /integrations/brevo/sender` |
| Initial Onboarding resumes from integrations step | ✅ Flow works | Server step 'review' maps to integrations step; step 'complete' won't show it on re-entry |

### ❌ Deliberately Deferred (out of scope)

| Item | Reason |
|------|--------|
| BullMQ background jobs for checklist reminders | Not part of onboarding scope |
| Email nudges for incomplete HIGH items | Needs notification system |
| Per-wizard Zod schemas for payload validation | Backend treats payload as opaque JSON |
| Switch/Slider shadcn components | Not available in project; uses Checkbox/Select instead |
| Setup Center as dedicated IconRail page | Current: floating panel + settings page. Dedicated nav entry can be added later |
| Milestone celebration animations | Framer Motion animations work; full celebration sequences deferred |
| "Quick Wins" section (create project, chat with Hermes) | Needs project creation integration |
| Checklist re-trigger for stale items (e.g., expired billing) | Needs scheduled job |
| 2FA actual implementation | Backend 2FA endpoints not built yet |

---

## 7. Key Design Decisions

1. **Config-only, no DB migration.** Phase/weight/dependsOn fields live in
   `checklist.config.ts` only. The `OnboardingChecklistEntry` table stays
   unchanged. This avoids a migration and keeps the schema flexible.

2. **Weighted progress over flat count.** A flat `5/11 = 45%` is misleading
   when the 5 done items are all LOW priority. Weighted progress reflects
   real completion: `company(3) + security(3) = 6/22 = 27%` feels correct
   when only Foundation is done.

3. **Dependencies are frontend-only.** The backend doesn't enforce dependency
   ordering. The fronten/OnboardingChecklistEntry. state machine remains
   simple (PENDING/DONE/SKIPPED/DISMISSED). Dependencies are enforced via
   UI (lock icons, disabled links) and next-item recommendation.

4. **Google Workspace and Brevo as first-class wizards.** These were buried
   under a LOW priority "Integrations" item. They are now individual HIGH
   priority wizards in Phase 1 — reflecting their real importance for
   company operations.

5. **Integration step in initial onboarding.** The 7-step wizard now includes
   a connections step. This is intentionally lightweight — connect or skip.
   Deep configuration happens in the Setup Center.

6. **CompleteStep calls `complete()` now, not TemplateStep.** Previously
   TemplateStep finalized onboarding before the user saw "Done". Now
   finalization happens when the user clicks "Open portal", ensuring the
   Integrations step is shown.

---

## 8. File Reference Index

### Backend

| Path | Lines | Purpose |
|------|-------|---------|
| `src/modules/onboarding/checklist/checklist.config.ts` | 170 | 13 wizard configs + phase/weight/dependsOn constants |
| `src/modules/onboarding/checklist/checklist.service.ts` | 310 | Seed (13), list, save, complete, skip, dismiss |
| `src/modules/onboarding/checklist/checklist.controller.ts` | 117 | REST endpoints (7) |
| `src/modules/onboarding/onboarding.service.ts` | 483 | Initial onboarding orchestration |
| `scripts/seed-checklist-for-existing-tenants.ts` | 57 | Migration script |

### Frontend Core

| Path | Lines | Purpose |
|------|-------|---------|
| `src/lib/wizard/types.ts` | 105 | All shared types (WizardConfig, CheckListEntryView, phases) |
| `src/hooks/useOnboardingChecklist.ts` | 120 | Hook with phase grouping, weighted progress, dependency check |
| `src/stores/onboardingChecklist.store.ts` | 165 | Zustand store with optimistic updates |
| `src/services/checklist.service.ts` | 33 | Axios wrapper for checklist endpoints |
| `src/services/integrations.service.ts` | 433 | Axios wrapper for Google/Brevo integration endpoints |
| `src/services/onboarding.service.ts` | 106 | Axios wrapper for initial onboarding endpoints |

### Frontend UI

| Path | Lines | Purpose |
|------|-------|---------|
| `src/components/checklist/ThingsToDoPanel.tsx` | 195 | Phase-aware dashboard floating panel |
| `src/components/wizard/WizardShell.tsx` | 32 | Shared wizard page shell |
| `src/app/settings/wizard/page.tsx` | 120 | Full Setup Center index with phase grouping |
| `src/app/settings/wizard/[slug]/page.tsx` | 55 | Dynamic wizard route + component registry |
| `src/app/onboarding/setup/page.tsx` | 220 | Initial onboarding orchestrator (7 steps) |
| `src/app/onboarding/setup/steps/IntegrationsStep.tsx` | 160 | Google + Brevo connect cards |
| `src/app/onboarding/setup/steps/CompleteStep.tsx` | 125 | Done screen with phase preview |

### Per-Wizard Pages (new in `src/app/settings/wizard/[slug]/wizards/`)

| Path | Lines | Purpose |
|------|-------|---------|
| `CompanyWizard.tsx` | 130 | Company profile form |
| `LocalizationWizard.tsx` | 145 | Localization & currency form |
| `BillingWizard.tsx` | 135 | Billing profile form |
| `ProfileWizard.tsx` | 100 | User profile form |
| `PreferencesWizard.tsx` | 115 | Notifications & UX form |
| `SecurityWizard.tsx` | 110 | Security settings form |
| `AiOpsWizard.tsx` | 110 | AI & Operations form |
| `OrgWizard.tsx` | 85 | Org placement form |
| `IntegrationsWizard.tsx` | 95 | Integration status overview |
| `ComplianceWizard.tsx` | 110 | Compliance settings form |
| `TeamWizard.tsx` | 110 | Team invite form |
| `GoogleWorkspaceWizard.tsx` | 135 | Google OAuth connect/disconnect |
| `BrevoWizard.tsx` | 140 | Brevo connect + sender identity |

---

## 10. V2 Completion (2026-07-22 13:30 PKT)

All original audit gaps were comprehensively fixed and tested:

### Backend additions (10 files, 72 unit tests)
- `TwoFactorService` — RFC 6238 TOTP (init/enable/disable/verifyChallenge)
- `TwoFactorController` (`MeSecurityController`) — `/api/v1/me/security/*` endpoints
- `MeProfileController` — `/api/v1/me/profile` GET/PATCH
- `ComplianceAcceptanceController` — AUP/DPA/residency/retention with audit logging

### Frontend wiring (5 wizards now fully wired)
- `ProfileWizard` — calls `PATCH /me/profile`
- `OrgWizard` — calls `PATCH /me/profile { primaryDepartmentId }`
- `SecurityWizard` — full 2FA flow, session timeout, password change
- `ComplianceWizard` — AUP/DPA acceptance + residency + retention
- `BrevoWizard` — persists sender identity via `PUT /integrations/brevo/sender`

### Google OAuth return-to-onboarding (fix for the flagged gap)
- New `origin` param in `ConnectGoogleDto` + `IntegrationsService.initiateGoogleOAuth`
- New `readOriginFromState()` helper + `buildCallbackRedirectUrl()` honors `origin`
- `IntegrationsStep` (onboarding) → `origin: 'onboarding'` → callback lands at `/onboarding/setup`
- `GoogleWorkspaceWizard` → `origin: 'settings'` → callback lands at `/settings/integrations`

### No DB migration required
All new data uses existing JSON columns (`User.metadata`, `Tenant.defaultsJson`,
`User.notificationPrefsJson`) and existing scalar columns (`User.departmentId`,
`User.phone`, `User.jobTitle`, etc.).

### Final test counts
- **Backend**: 1402 + 72 new = 1474 passing
- **Frontend**: 156 passing (45 onboarding + 111 unrelated)
- **TypeScript**: clean
- **ESLint**: 0 errors on new files

See `onboarding-audit-2026-07-22.md` for the complete v2 audit.

---

## 9. Testing & Audit (2026-07-22 12:30 PKT)

| Suite | Tests | File | Result |
|-------|-------|------|--------|
| Backend checklist service | 22 | `backend/src/modules/onboarding/checklist/__tests__/checklist.service.spec.ts` | ✅ pass |
| Backend onboarding service | 13 | `backend/src/modules/onboarding/__tests__/onboarding.service.spec.ts` | ✅ pass |
| Frontend wizard types/mapping | 17 | `frontend-tenant/src/lib/wizard/__tests__/onboarding-audit.test.ts` | ✅ pass |
| Frontend wizard file mapping | 3 | `frontend-tenant/src/lib/wizard/__tests__/wizard-files.test.ts` | ✅ pass |
| Frontend orchestrator step map | 7 | `frontend-tenant/src/lib/wizard/__tests__/onboarding-orchestrator.test.ts` | ✅ pass |
| Backend full suite (regressions) | 1342 | – | ✅ no regressions |
| Frontend/Backend TypeScript | 2 | – | ✅ clean |
| ESLint on changed files | – | – | ✅ 0 errors |

**Bug found & fixed during audit**: The `'review'` server step was mapping to
`'complete'` in the frontend hydration logic, which would bypass the new
IntegrationsStep on a page refresh after Template selection. Fixed by mapping
both `'review'` and `'team'` to `'integrations'` in
`/onboarding/setup/page.tsx:76`. Covered by `onboarding-orchestrator.test.ts`.

See `onboarding-audit-2026-07-22.md` for the complete honest audit.
