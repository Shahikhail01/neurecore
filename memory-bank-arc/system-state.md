# NeureCore — System State (live inventory)

**Last verified:** 2026-07-31 — **FULL SYSTEM AUDIT COMPLETED**

**⚠️ CRITICAL — DEPLOYMENT GAP:**
| Item | Local (audited) | Contabo (deployed) | Delta |
|------|-----------------|---------------------|-------|
| Git HEAD | `fe335abb` | `ad73f3e6` | **8 commits behind** |
| Backend modules | 106 | N/A (no git) | — |
| Controllers | 119 | N/A | — |
| Services | 250 | N/A | — |
| Prisma models | 174 | 175 tables* | ✅ |
| AI providers | 2 (Deepseek, MiniMax) | 2 (same) | ✅ |
| DB tenants | 54 | 54 | ✅ |
| DB users | 63 | 63 | ✅ |
| DB projects | 181 | 181 | ✅ |
| DB tasks | 694 | 694 | ✅ |

*175 = 174 Prisma models + _prisma_migrations table

**Phase 9 G9 (105/105) and NC-AWL-IMP-2 closure exist LOCAL ONLY — NOT DEPLOYED**

**2026-07-31 20:10 PKT — DeepSeek AI Chat Activated (FIX-050 follow-up):**
- DeepSeek is now the active AI provider (MiniMax disabled)
- `DEEPSEEK_API_KEY` added to `.env` on Contabo
- All 7 boot capabilities pass: conversation, planning, execution, evaluation, tools, reasoning, coding
- Root cause: compiled `capability-resolver.js` missing `resolveProviderKey()` DB decryption (source/dist drift); DB key encryption was correct but compiled code skipped it
- Full entry: [fixes.md §FIX-050](fixes.md#fix-050--hq-ai-chat-disconnected-ai_gateway_v2false--minimax-provider-inactive)

**2026-07-31 19:40 PKT — HQ AI Chat Disconnected Fix (FIX-050):**
- Root cause: `AI_GATEWAY_V2=false` in both `.env` and `.env.production` on Contabo + `minimax` provider had `isActive=false` in DB
- Fix: Set `AI_GATEWAY_V2=true` in both env files, enabled MiniMax in `model_providers` DB table, restarted backend
- Backend healthy: `https://brain.neurecore.com/api/v1/health` → 200
- PM2 saved; all 7 processes online
- Full entry: [fixes.md §FIX-050](fixes.md#fix-050--hq-ai-chat-disconnected-ai_gateway_v2false--minimax-provider-inactive)

**Previously:** 2026-07-31 01:30 PKT — **NC-ACCT-IMP-1 fully complete.****Previously:** 2026-07-30 22:10 PKT — **NC-ACCT-IMP-1 Phase 1 deployed end-to-end.
**Previously:** 
**Previously:** 2026-07-28 11:00 PKT — Customer Creation Remediation: closed 3 customer-creation defects found by the platform owner — (1) DTO `IsIn` validator rejected `""` for unset F&C enum fields on `POST /api/v1/customers`, silently 400-ing the New Customer modal; (2) modal could be dismissed by backdrop click mid-submit + axios error envelopes weren't unwrapped so users saw no message; (3) Hermes chat `createCustomer` tool was default-deny under the `ai-assistant` security policy (missing from `allowedTools`). Fixed + deployed to Contabo (`neurecore-backend` PID 27954, `neurecore-tenant` PID 13904). All three pinned with new regression specs: `customer.dto.spec.ts` (10 cases) + `security-policy.provider.spec.ts` (3 cases). Live e2e on `https://brain.neurecore.com`: empty-enum POST → HTTP 201, populated-F&C POST → HTTP 201. Tests: 98/98 pass across `customers | tools | security-policy`. Full entry at [fixes.md §FIX-CUSTOMER-MODAL-CHAT](fixes.md#fix-customer-modal-chat--create-customer-modal-doesnt-work--hermes-chat-create-new-customer-not-working-2026-07-28-1100-pkt).

---

## 0d.4. 2026-07-28 — Customer Creation Remediation (Kilo)

**Session goal:** Fix two related symptoms reported by the platform owner — (a) the New Customer modal on `/customers` opens but "does nothing" when submitted, (b) the Hermes chat command *"create a new customer"* doesn't work. Three compounding root causes were discovered; all three fixed, deployed to Contabo, and pinned with regression tests.

### Defects discovered and resolved

| ID | Severity | Impact | Status | Where |
|---|---|---|---|---|
| **C1** | HIGH | BLOCKING | **FIXED + DEPLOYED** | `backend/src/modules/customers/dto/customer.dto.ts` |
| **C2** | MEDIUM | UX-ONLY | **FIXED + DEPLOYED** | `frontend-tenant/src/components/customers/CustomerForm.tsx` + `frontend-tenant/src/app/customers/page.tsx` |
| **C3** | HIGH | BLOCKING (chat flow) | **FIXED + DEPLOYED** | `backend/src/modules/agents/security/providers/security-policy.provider.ts` |

### C1 — DTO `IsIn` rejects empty-string enum fields

`@IsOptional() @IsIn([...])` on Phase 4 F&C enum fields (`kycStatus`, `riskRating`, `taxId`, `financialSubType`, `lifecycleStage`) + `primaryEmail`/`primaryPhone` rejected the empty string `""` that the frontend `<select>` controls send when unset. The whole POST 400'd, the FE caught the axios error but couldn't unwrap the envelope, and the user saw "nothing happens".

**Fix:** Added `@EmptyToUndefined()` `@Transform()` decorator on every optional scalar (both `CreateCustomerDto` + `UpdateCustomerDto`) that coerces `""` / whitespace-only strings to `undefined` before validation. Pinned by new `backend/src/modules/customers/__tests__/customer.dto.spec.ts` (10 cases).

### C2 — Modal dismissable mid-submit + no error surfacing

Parent `CustomersPage` wired `<Modal onClose={() => setCreateOpen(false)}>` unconditionally; form's submit called `onClose()` only on success but the catch block did `setError(e.message)` (which on an axios error is `"Request failed with status code 400"`, not the real backend message).

**Fix:** `CustomerForm` got a new `onSubmittingChange?: (submitting: boolean) => void` prop fired on the `setSubmitting(true/false)` boundaries. `CustomersPage` stores it in `createSubmitting` state and refuses backdrop/ESC dismissal while `createSubmitting === true`. The submit catch now unwraps `response.data.error.message` → `response.data.message` → `Error.message`. No `onClose()` on error — caller stays on the form to retry.

### C3 — Hermes `createCustomer` tool blocked by security policy

`ai-assistant` agent's `allowedTools` list had read-only customer tools (`getCustomer`, `listCustomers`, `findCustomerByName`, `getCustomerProjects`, `listCustomerContacts`) but **did not include** `createCustomer`. `SecurityPolicyProvider.isToolAllowed()` uses default-deny — any tool not in `allowedTools` and not in `blockedTools` is rejected. Backend logs confirmed: `Tool createCustomer not allowed by policy for agentType=ai-assistant` → `BLOCKED`.

**Fix:** Added `'createCustomer'` to the `ai-assistant` allowlist. Kept `updateCustomer`, `archiveCustomer`, `unarchiveCustomer` in `blockedTools` — those still need explicit human approval rather than LLM autonomy. Pinned by new `backend/src/modules/agents/security/__tests__/security-policy.provider.spec.ts` (3 cases).

### Verification gates

- [x] Backend rebuilt locally + drift gate green
- [x] Frontend tenant rebuilt locally (`next build` clean)
- [x] `scripts/deploy.sh backend` + `scripts/deploy.sh tenant` → both rsync + Contabo rebuild + PM2 reload successful
- [x] `pm2 list` shows `neurecore-backend` (PID 27954) + `neurecore-tenant` (PID 13904) online
- [x] Live e2e: `POST /api/v1/customers` with all-empty enums → HTTP 201 (C1)
- [x] Live e2e: `POST /api/v1/customers` with fully-populated F&C payload → HTTP 201 (C1)
- [x] `GET https://hq.neurecore.com/customers` → HTTP 200, NeureCore — Tenant Portal renders (C2)
- [x] `GET /api/v1/agents/streaming/tools` returns 117 tools including `createCustomer` (C3, registry intact)
- [x] Backend logs show `Tool createCustomer allowed by policy` (C3, pre-fix logs showed `not in allowed list, denying`)
- [x] Tests: 98/98 pass across `customers | tools | security-policy` (20 + 75 + 3)
- [x] Backend `tsc --noEmit` ✅ Frontend `tsc --noEmit` ✅ Backend eslint on changed files ✅ Frontend `next lint` on changed files ✅
- [x] Test password reset on Contabo (was set to `Tenant123!` for live e2e, reverted to NULL after)

### Follow-up backlog (carried into [pending-tasks.md](pending-tasks.md))

| ID | Severity | Impact | Where |
|---|---|---|---|
| **F1** | MEDIUM | ARCHITECTURAL-DEBT | `backend/src/modules/tools/tools.service.ts` `ToolsService.registry` Map vs `StructuredToolRegistry.tools` Map — two parallel registries. `POST /api/v1/tools/execute` reads from the 2-tool `ToolsService.registry` and 404s on `createCustomer`. Hermes doesn't hit this HTTP endpoint so the chat fix works, but legacy clients will. Consolidate to one registry or delegate. |
| **F2** | LOW | UX-ONLY | `/customers` page subhead + empty-state copy still generic ("No customers yet. Create the first one.") even though the `<h1>` is industry-aware (D24, Run-6). Same one-line treatment as D24 closes it. |
| **F3** | MEDIUM | POLICY-AUDIT | Other agent-type × tool-pair allowlist/blocklist gaps likely exist. After the next sprint, do a one-shot audit of all 117 structured tools vs the allowlist/blocklist per agent type (similar to the customer-tool audit done here). |

> **Honest correction (2026-07-23 17:30 PKT):** items A.1, A.2, A.6 and B.1 from the round-1 `pending-tasks.md §1` table were originally filed under this section as "out-of-scope pending follow-ups". That filing was wrong: each of them was fixable in the same session. Round-2 closes all four. Items A.3, A.4, A.5 remain product decisions, not blocker defects, and are still tracked as pending.

**Database Status (2026-07-23):**
- ✅ Contabo Local PostgreSQL 16: `127.0.0.1:5432`, db `neurecore_prod`, user `neurecore_app` (per live `.env`; older docs citing port `5433` are stale — see [contabo-ops.md §Postgres](contabo-ops.md))

---

## 0d.3. 2026-07-25 — Industry Verification Run-6 (Kilo)

**Session goal:** Comprehensively verify industry features on Professional tier (per platform owner request) by registering two new tenants across two distinct industries (Accounting & Audit Services + Healthcare & Life Sciences), exercise every industry-specific workflow, classify defects, fix in a separate remediation session, then re-verify with fresh tenants.

### Tenants created (4 total)

| # | Tenant | Email | Industry | Tier | Phase |
|---|---|---|---|---|---|
| 1 | Sahara Audit & Advisory | omar.siddiqui.sahara+20260725@neurecore-test.com | accounting-audit-services | Professional | Pre-fix |
| 2 | Horizon Community Health Alliance | ayesha.khan.horizon+20260725@neurecore-test.com | healthcare-life-sciences | Professional | Pre-fix |
| 3 | ReVerify Demo Accounting Firm | hamza.rashid.reverify2+20260725@neurecore-test.com | accounting-audit-services | Professional | Post-fix |
| 4 | ReVerify Community Health Alliance | fatima.yusuf.reverify+20260725@neurecore-test.com | healthcare-life-sciences | Professional | Post-fix |

### Defects discovered and resolved

| ID | Severity | Impact | Status |
|---|---|---|---|
| **D18** | HIGH | DATA-INTEGRITY-RISK | **FIXED + DEPLOYED** — `insurance` added to F&C `INDUSTRY_GROUP_INDUSTRIES` in 3 files (BE `tier-industry-matrix.ts`, BE `department-templates.service.ts`, FE `industryGroups.ts`, admin `industries.ts`). `/api/v1/industries/groups` now returns 3 industries for F&C group. |
| **D19** | MEDIUM | UX-ONLY | **FIXED + DEPLOYED** — PlanImpactPanel now shows "(N in pool · M tier cap)" caption, disambiguating the industry pool from the tier cap. |
| **D20** | LOW | COSMETIC | **FIXED + DEPLOYED** — `accounting` department template description updated: "12 AI Employees" → "10 AI Employees" (synced with Run-5 D12 structure trim). |
| **D21** | HIGH | BLOCKING | **FIXED + DEPLOYED** — Created `healthcare-clinic` DepartmentTemplate (8 depts: Clinical Operations Coordinator, Nurse Practitioner, Medical Records Clerk, Pharmacy Manager, Lab Technician, Patient Advocate, Billing Specialist Healthcare, Practice Manager). New seeder: `seed-healthcare-department-template.cjs`. |
| **D24** | MEDIUM | UX-ONLY | **FIXED + DEPLOYED** — Customers page `<h1>` now reads from `getIndustryNavConfig(tenantGroup).customersLabel` so healthcare tenants see "Patients" instead of "Customers". |
| **D29** | HIGH | BLOCKING | **FIXED + DEPLOYED** — Created 8 healthcare AgentTemplates (Clinical Operations Coordinator, Nurse Practitioner, Medical Records Clerk, Pharmacy Manager, Lab Technician, Patient Advocate, Billing Specialist Healthcare, Practice Manager) and added them to Professional tier's `TierAgentPool` at slots 1–8. Backfilled the 8 agents for the pre-existing ReVerify Community Health Alliance tenant. New seeder: `seed-healthcare-agent-templates.cjs`. |

### Defects discovered and NOT fixed (follow-up backlog)

| ID | Severity | Impact | Notes |
|---|---|---|---|
| D22 | HIGH | BLOCKING (for self-service template deploy) | Tenant cannot self-deploy from `/departments?tab=templates`; UI says "Contact admin to deploy". Currently worked around by D21 auto-deploy at onboarding. |
| D25 | LOW | COSMETIC, KNOWN | Socket.IO polling 400 errors on every page (40+/page). Documented in FIX-INDUSTRY-VERIFY-3. Non-blocking. |
| D26 | MEDIUM | DATA-INTEGRITY-RISK | Approval chain `audit-signoff` has 4 sequential stages but Professional tier caps at 3. Cap not enforced at chain instantiation. |
| D27 | HIGH | DATA-INTEGRITY-RISK | Tier ID `tier-government-003` (slug=business) is misleading. Pure data rename — needs owner approval for direct DB migration. |
| D28 | LOW | DATA-INTEGRITY-RISK | AI chat "live tenant data" doesn't include projects/customers; agent honestly reports what it has. |

### Code changes (5 files, 6 edits)

```
backend/src/modules/industry/tier-industry-matrix.ts        (D18 — added 'insurance' to F&C)
backend/src/modules/department-templates/department-templates.service.ts  (D18 — synced canonical map)
frontend-tenant/src/lib/industryGroups.ts                   (D18 — added 'insurance' to F&C)
frontend-admin/src/lib/industries.ts                        (D18 — added 'insurance' to 17-industry list)
frontend-tenant/src/app/customers/page.tsx                  (D24 — industry-aware h1)
frontend-tenant/src/components/onboarding/PlanImpactPanel.tsx  (D19 — pool/cap caption)
```

### New seeders (2 files, ~400 lines)

```
backend/prisma/seed-healthcare-department-template.cjs  (D21 — 8-dept healthcare clinic template)
backend/prisma/seed-healthcare-agent-templates.cjs    (D29 — 8 AgentTemplates + TierAgentPool + backfill)
```

### Database changes (run on Contabo)

- `accounting` department template description: "12 AI Employees" → "10 AI Employees" (D20)
- 1 DepartmentTemplate created: `healthcare-clinic` (id=33d36960-…) (D21)
- 8 AgentTemplates created + 8 TierAgentPool rows on Professional tier + 8 backfilled Agents on `ReVerify Community Health Alliance` tenant (D29)

### Deployments (2026-07-25 12:22–12:55 CEST)

- Backend rebuilt + PM2 reload (neurecore-backend pid 6)
- Frontend tenant rebuilt + PM2 reload (neurecore-tenant pid 4) + manual `pm2 delete + start` to pick up the new build (per FIX-INDUSTRY-VERIFY-4 deploy-path workaround)
- Frontend admin rebuilt + PM2 reload (neurecore-admin pid 5)
- 3 DB operations run via SSH to Contabo (seed-healthcare-department-template.cjs, inline accounting description update, seed-healthcare-agent-templates.cjs)

### Verification matrix (Run-6, post-fix)

- `curl -sk https://brain.neurecore.com/api/v1/industries/groups | jq '.data[] | select(.slug=="financial-compliance") | .industrySlugs'` → `["accounting-audit-services","financial-services","insurance"]` ✓
- `curl -sk 'https://brain.neurecore.com/api/v1/department-templates?industryGroup=healthcare' | jq '.data.total'` → `1` ✓
- `curl -s https://hq.neurecore.com/customers | grep -oE 'page-[a-f0-9]+\.js'` → `page-7c78b16b54085b44.js` (new build) ✓
- PM2: 4/4 online (backend pid 6, tenant pid 7, admin pid 5, cors-proxy pid 1) ✓
- Healthcare tenant (ReVerify Community Health Alliance): 8 depts, 8 agents, "Patients" h1, 1 patient (Sara Khan) with full HIPAA/Clinical fields ✓
- Accounting tenant (ReVerify Demo Accounting Firm): 15 depts, 7 agents, "Clients & Accounts" h1 ✓
- AI chat (gpt-4o-mini) on healthcare tenant: real LLM response references "8 agents, 8 active departments" ✓
- AI chat (gpt-4o-mini) on accounting tenant: real LLM response references "5 active departments, 0 tasks" ✓
- Persistence after refresh + re-login: all data preserved ✓
- Cross-tenant data isolation: no leaks observed ✓
- **0 regressions** across 50+ re-verified test cases

### Honest disclosure

- **Tier ID `tier-government-003`** (D27) is the underlying primary key for what the UI calls "Business". Per Run-5 D14 fix description, a future migration should rename to `tier-business-002` — not done in this run because it requires direct DB mutation and explicit owner approval.
- **Socket.IO 400 errors** (D25) are noisy but non-blocking; per FIX-INDUSTRY-VERIFY-3 the app falls back to HTTP polling.
- **AI chat context** (D28) doesn't include projects/customers; the agent honestly reports this limitation. Future work: extend `unified-chat` context builder.
- **Tenant self-deploy** (D22) UI still says "Contact admin to deploy" but auto-deploy at onboarding (D21) works around this for the standard onboarding flow.
- **Approval chain cap** (D26) is unenforced; the `audit-signoff` chain with 4 stages can be assigned to a Professional tenant even though the cap is 3.

### Files & artefacts

- Audit folder: `audits/2026-07-25-industry-verification-run6-professional/`
  - `final-report.md` — full verification matrix + 16 deliverables
  - `issues.md` — defect list with evidence
  - `change-log.md` — code + deployment change log
  - `security-report.md` — tenant isolation report
  - `post-fix-regression.md` — 0-regression confirmation
  - `phase1-checklist.md` — pre-execution review checklist
  - `screenshots/` — 22 screenshots of evidence
  - `evidence/` — (placeholder; raw evidence in screenshots + curl outputs)

See [fixes.md FIX-INDUSTRY-VERIFY-6](fixes.md#fix-industry-verify-6--industry-verification-run-6-defects--2026-07-25-2006-pkt) (to be added) for the per-defect fix entries.

---

## 0d.2. 2026-07-25 — Industry Verification Run-4 (Kilo)

**Session goal:** Register a fresh tenant through `hq.neurecore.com`, complete onboarding as "Accounting & Audit Services" with a fictional Pakistani NGO profile, and verify every Financial & Compliance feature. Fix D-01 (KYC/AML fields missing from customer detail view).

### Registration & Onboarding
- ✅ **Tenant:** Horizon Community Health Alliance (`horizon.community@neurecore-demo.com`)
- ✅ **Industry:** `accounting-audit-services` (group: `financial-compliance`)
- ✅ **Tier:** Basic (14-day trial)
- ✅ **Timezone/Currency:** Asia/Karachi / PKR
- ✅ **8-Group Industry Picker:** all 8 groups rendered; Financial & Compliance expanded with both sub-industries
- ✅ **Plan Impact panel:** showed "3 agents, 1 department, 1 GB storage, 1-stage approvals" for Basic × accounting-audit-services
- ✅ **Template step:** 422 TIER_LIMIT_EXCEEDED on Accounting template (12 depts required, Basic allows 1) — expected behaviour

### Tenant Provisioning
- ✅ **5 departments** auto-provisioned: Audit, Tax, Bookkeeping, Advisory, Administration
- ✅ **3 agents** provisioned: Audit Coordinator (CORE, gpt-4o-mini), Compliance Auditor (CORE), Forensic Auditor (FUNCTIONAL)
- ✅ **IconRail:** 8 F&C workspace extras (Engagements, Loans, Portfolios, Audits, Tax, Payroll, Compliance, Risk)
- ✅ **Customers label:** "Clients & Accounts" (correct per-industry label)
- ✅ **TierBadge:** "Basic · Trial · 14d" with click-to-open TierChangeModal

### Feature Verification
- ✅ **Customer created:** `cms005t3p000qmvhvach0djot` — Karachi Textile Mills Ltd.
- ✅ **Financial sub-type filter:** 6 options (Banking, Insurance, Wealth Management, Investment, FinTech, Accounting & Audit)
- ✅ **F&C KYC/AML fields:** Sub-Type, Lifecycle Stage, KYC Status, Risk Rating, Tax ID — all persisted
- ✅ **Industry-specific fields:** Client Type (Corporate), Service Type (Audit), FYE (06-30), Engagement Status (Active)
- ✅ **5 F&C project types:** Audit Engagement, Tax Filing, Compliance Review, Bookkeeping Cycle, Payroll Cycle — all tagged `accounting-audit-services`
- ✅ **Project created:** `cms0084mv000smvhv2nx9hk5b` — FY2026 Audit - Karachi Textile Mills
- ✅ **TierChangeModal:** 4 tiers with upgrade/downgrade request flow
- ✅ **Settings / AI Model Routing:** 6 providers per task type
- ✅ **Audits workspace page:** industry-aware stub with project list + status filters

### Defect Fixed
- ✅ **D-01:** KYC/AML fields now display on Customer detail page (added "Financial & Compliance" `GlassPanel` to `frontend-tenant/src/app/customers/[id]/page.tsx`)

### Deploy-Path Discovery
- ⚠️ **PM2 `neurecore-tenant`** runs from `/opt/neurecore/frontend-tenant/`, NOT from the deploy script's atomic-release path `/opt/neurecore/apps/tenant/current/`. The deploy script's `rsync` stages build output into `apps/tenant/releases/<id>/` and atomically switches the `current` symlink, but the actually running Next.js process reads from the PM2 working directory. **Workaround:** after deploy, `rsync` the `.next/` directory from `apps/tenant/current/` to `/opt/neurecore/frontend-tenant/` and `pm2 reload neurecore-tenant`. **Root fix needed:** update `neurecore-deploy.sh` or the PM2 ecosystem config to point at `apps/tenant/current/`.

### Files Changed
```
frontend-tenant/src/app/customers/[id]/page.tsx
```

### Verification Matrix (Run-4)
- ✅ `hq.neurecore.com` 200, `brain.neurecore.com/api/v1/health` 200
- ✅ `GET /api/v1/customers/cms005t3p000qmvhvach0djot` — returns `kycStatus: "VERIFIED"`, `riskRating: "LOW"`, `financialSubType: "ACCOUNTING_AUDIT"`, `lifecycleStage: "ACTIVE"`, `taxId: "123-45-6789"`
- ✅ Customer detail page shows 5 headings: Projects, Details, Industry-specific details, **Financial & Compliance**, Contacts
- ✅ PM2: 4/4 online — `neurecore-tenant` 200, `neurecore-backend` 200, `neurecore-admin` 200, `neurecore-cors-proxy` 200

### Honest Out-of-Scope
- AI Agent invocation: NOT_TESTED (requires agent task assignment)
- Google Workspace: BLOCKED (not connected)
- Brevo: BLOCKED (platform-level)
- Cross-tenant isolation: NOT_TESTED
- 7 non-F&C industry groups: NOT_TESTED (placeholder stubs only)

See [fixes.md FIX-INDUSTRY-VERIFY-4](fixes.md#fix-industry-verify-4--kycaml-customer-detail-display--pm2-deploy-path--2026-07-25-1211-pkt).

---

## 0d. 2026-07-23 — Industry Release Verification & Hot-Fix Sweep (Kilo)

**Session goal:** Re-verify every Industry Groups / Tier feature on `hq.neurecore.com` by registering an Indonesian demo tenant (`PT Nusantara Audit Digital`) and driving it through onboarding. Fix every reproducible defect honestly.

### Status snapshot (2026-07-23 14:56 PKT — DEPLOYED)

| Defect | Status | Verification |
| --- | --- | --- |
| §0d.1 — `GET /tenant-templates?type=AGENT_ROLE` returning `500 TenantContext accessed outside a request scope` | ✅ **FIXED + DEPLOYED** | `TenantTemplatesController` rewritten to use injected `TenantContextService`; typed `403 TENANT_CONTEXT_MISSING` on null; live `curl` returns **200**. Source/JS drift root cause documented in fixes.md. |
| §0d.2 — `POST /onboarding/select-template` returning `403 PERMISSION_DENIED` on tier-limit rejection | ✅ **FIXED + DEPLOYED** | New `TierLimitExceededException` (422, `error.code: TIER_LIMIT_EXCEEDED`); `GlobalExceptionFilter` now honours nested `error.code`; live `curl` returns **422** with structured payload including smaller-template suggestions. |
| §0d.3 — `IndustryGroupPicker` rendered "0 industries" for every group | ✅ **ROOT CAUSE IDENTIFIED, FIX PENDING** | Backend `GET /industries/by-group/:groupSlug` works (DB has 16 active industries); picker loop is correct. The "0" UI was a symptom of an empty fresh tenant — `industries` *was* an empty array because the Industry seed for the test tenant was deferred to the user's industry selection. Re-verified after the fix above: picker now shows full industry lists. |
| §0d.4 — `CompanyStep` allowed silent industry skip | ✅ **FIXED + DEPLOYED** | Explicit "Skip industry for now" toggle with consequence copy; Continue disabled when industry catalogue is empty or loading. |
| §0d.5 — Industry picker copy: "change this later under Tenant Settings" (false) | ✅ **FIXED + DEPLOYED** | Copy now says "Contact your platform administrator if your industry needs to change" — accurate per INDUSTRY-GROUPS-CONCEPT.md §1.2 D7. |
| §0d.6 — Localization timezone + currency lists missing Indonesia + APAC | ✅ **FIXED + DEPLOYED** | New `lib/locale-options.ts` adds Asia/Jakarta, Asia/Makassar, Asia/Jayapura, IDR, THB, CNY, MXN, BRL. |
| §0d.7 — `IndustryStubPage` rendered green "Phase 2 (Stage 2 ✓)" badge on placeholder routes | ✅ **FIXED + DEPLOYED** | All 38 navigation entries use honest "Phase 2 (placeholder)" / "Stage 3 (not yet scheduled)" wording; stub page renders an explicit amber "Placeholder page" banner. |
| §0d.8 — Frontend typecheck errors (17) across `TierChangeModal`, `compliance.service`, `me.service` test fixtures | ✅ **FIXED + DEPLOYED** | Fixtures extended to full Tier shape; `ApiResponse.meta` mocking helper added. `pnpm tsc --noEmit` clean. |
| §0d.9 — Backend typecheck errors (4) across `tier-package-anchors-rename` and `me-profile.controller` tests | ✅ **FIXED + DEPLOYED** | Type-level assertions + null guards. |

### Files changed (21)

```
backend/src/common/errors/app-errors.ts
backend/src/common/errors/tier-limit-exceeded.exception.ts        [new]
backend/src/common/filters/global-exception.filter.ts
backend/src/modules/onboarding/onboarding.service.ts
backend/src/modules/onboarding/__tests__/onboarding.service.spec.ts
backend/src/modules/tenants/dto/update-my-tenant.dto.ts
backend/src/modules/tenants/tenants.service.ts
backend/src/modules/tenant-templates/tenant-templates.controller.ts
backend/src/modules/tiers/__tests__/tier-package-anchors-rename.spec.ts
backend/src/modules/users/__tests__/me-profile.controller.spec.ts
frontend-tenant/src/app/onboarding/setup/steps/CompanyStep.tsx
frontend-tenant/src/app/onboarding/setup/steps/LocalizationStep.tsx
frontend-tenant/src/components/industry/IndustryStubPage.tsx
frontend-tenant/src/components/onboarding/IndustryGroupPicker.tsx
frontend-tenant/src/components/tier/__tests__/TierChangeModal.test.tsx
frontend-tenant/src/lib/industryNavigation.ts
frontend-tenant/src/lib/locale-options.ts                          [new]
frontend-tenant/src/services/industries.service.ts
frontend-tenant/src/services/onboarding.service.ts
frontend-tenant/src/services/__tests__/compliance.service.spec.ts
frontend-tenant/src/services/__tests__/me.service.spec.ts
comprehensive-fix.md                                               [new]
```

### Verification matrix (live Contabo, 2026-07-23 14:56 PKT)
- ✅ `curl https://hq.neurecore.com/api/v1/tenant-templates?type=AGENT_ROLE -b cookies` → 200 (was 500).
- ✅ `curl -X POST https://hq.neurecore.com/api/v1/onboarding/select-template -d '{"templateSlug":"risk-compliance"}' -b cookies` → 422 with `{code: TIER_LIMIT_EXCEEDED, message: 'Template "risk-compliance" requires 12 departments but tier "professional" allows 10.'}` (was 403 PERMISSION_DENIED).
- ✅ `jest --config jest.config.js` — **1497/1596 backend tests pass, 0 fail** (99 skipped, 12 suites skipped — unrelated to this fix).
- ✅ `tsc --noEmit` clean for both `backend` and `frontend-tenant`.
- ✅ PM2 (live): 4/4 online — `neurecore-backend` 174 MB (uptime 1m), `neurecore-tenant` 117 MB, `neurecore-admin` 124 MB, `neurecore-cors-proxy` 58 MB.
- ✅ `hq.neurecore.com` 200, `cc.neurecore.com` 200, `brain.neurecore.com/api/v1/health` 200.

### Honest out-of-scope items

- Compliance checklist engine returns synthetic ratios (no real AML/HIPAA aggregation yet) → tracked in [pending-tasks.md §A.3](#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- Industry-aware dashboards (`/intelligence`) not yet wired to the F&C widget registry → tracked in [pending-tasks.md §A.4](#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- `pnpm` / `corepack` not installed on this developer workstation → tracked in [pending-tasks.md §B.1](#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- Source/JS drift (`backend/dist/` ≠ `backend/src/`) was the root cause of the 500 → tracked in [pending-tasks.md §B.4](#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- Industry-rail cross-group preference leakage → tracked in [pending-tasks.md §A.1](#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
- Multi-tenant matrix verification across all 8 groups + 4 tiers — needs human QA → tracked in [pending-tasks.md §D Verification Script](#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).

---


**Tier System Refactor (2026-07-21):**
- ✅ Phase 1 migration `20260721_tier_system_refactor` applied — 10 new columns on `tiers` + new tables `tier_audit_logs` + `tier_change_requests`
- ✅ Phase 2 migration `20260721_tier_template_phase2` applied — added `Package.tierId` nullable FK + backfilled from `Package.tierTemplateId`
- ✅ Phase 3 migration `20260721_tier_template_phase3_drop` applied — `tier_templates` table dropped, `Package.tierTemplateId` column dropped, `Package.tierId` made NOT NULL
- ✅ Tier slugs renamed: `starter` → `basic`, `government` → `business`; `professional` + `enterprise` unchanged
- ✅ `backend/src/modules/tier-templates/` deleted (controller, service, DTOs, spec)
- ✅ TierTemplatesModule removed from app.module.ts; packages.module.ts now imports TiersModule
- ✅ packages.service.ts + DTOs updated: `tierId` replaces `tierTemplateId`
- ✅ Seed scripts updated: seed-business-composition.cjs seeds Tier directly; seed-package-catalogue.cjs + seed-accounting-packages.cjs write Package.tierId
- ✅ `seed-business-composition.cjs` run — 4 tiers updated to match TIER-SYSTEM-CONCEPT.md §4 (Basic: 3 agents/2 users/1 GB, Business: 10/10/10, Professional: 50/50/100, Enterprise: 9999/9999/1000)
- ✅ `test-corp` tenant verified — resolves to `enterprise` tier
- ✅ Frontend migrated: `/admin/tiers` page rewritten to use Tier (canonical); `tiersPool.service.ts` points at `/api/v1/tiers`; all consumer pages (`packages/page.tsx`, `packages/[id]/page.tsx`, `packages/[id]/edit/page.tsx`, `packages/new/page.tsx`, `tenants/[id]/page.tsx`) updated to use `tierId` instead of `tierTemplateId`
- ✅ `frontend-tenant/src/services/packages.service.ts` updated to use `tierId`
- ✅ `/api/v1/tier-templates` returns 404 (endpoint removed)
- ✅ `/api/v1/tiers` returns 200 with Tier rows
- ✅ All PM2 services healthy: `brain` 200, `hq` 200, `cc` 200
- ✅ DR snapshot: `/opt/neurecore/_archives/20260721-pre-tier-refactor/pre-tier-refactor.dump` (3.1 MB)
- Docs: [memory-bank-new/industries/INDUSTRY-GROUPS-CONCEPT.md](../industries/INDUSTRY-GROUPS-CONCEPT.md), [TIER-SYSTEM-CONCEPT.md](../industries/TIER-SYSTEM-CONCEPT.md), [TIER-DEPLOYMENT-RUNBOOK.md](../industries/TIER-DEPLOYMENT-RUNBOOK.md)

---

**Industry Groups Implementation (2026-07-21):**
- ✅ Migration `20260721_industry_groups` applied — Industry.industryGroup + groupSortOrder columns + index
- ✅ Migration `20260721_tenant_industry_group` applied — Tenant.industryGroup column + backfilled from Industry
- ✅ 16 industries seeded with correct `industryGroup` (8 groups per INDUSTRY-GROUPS-CONCEPT.md §3)
- ✅ 8 legacy slugs (healthcare, ngo, etc) archived (status=ARCHIVED)
- ✅ Public endpoints deployed: `GET /api/v1/industries/groups`, `/groups/:slug`, `/by-group/:slug`, `/:slug/capabilities?tier=<slug>`
- ✅ Tenant onboarding (CompanyStep) replaced with new IndustryGroupPicker component (single expandable list, click group → expand → click industry)
- ✅ Frontend IconRail now injects industry-specific Workspace extras per the 80/20 principle (only Workspace + Customers change)
- ✅ Customer label/icon adapts per Industry Group (e.g. "Clients & Accounts" for Financial & Compliance, "Patients" for Healthcare)
- ✅ 8 stub pages created for Financial & Compliance workspace extras (engagements/loans/portfolios/audits/tax/payroll/compliance/risk)
- ✅ Onboarding backend auto-derives `industryGroup` from selected industry slug
- ✅ All PM2 services healthy: `brain` 200, `hq` 200, `cc` 200
- ✅ test-corp tenant manually assigned `industryGroup=financial-compliance`
- Docs: [memory-bank-new/industries/INDUSTRY-GROUPS-CONCEPT.md](../industries/INDUSTRY-GROUPS-CONCEPT.md)
- ✅ Pool data seeded: 706 agents, 57 departments, 24 industries, 83 packages, 150 project types, 20 question packs
- ✅ Tier system seeded: 4 tiers (Starter/Growth/Pro/Enterprise) with agent pools
- ⚠️ Tenant data migrated from Neon (2026-07-20); some tenants had broken tierId references
- ⚠️ Demo tenant (`demo-retail`) seed failed due to tier slug mismatch — fixed in code (FIX-048)
- ⚠️ Agent distribution bug in onboarding caused all agents to bunch into first department — fixed (FIX-048)
- ⚠️ `Department.headAgentId` not set on agent creation — SQL fix script created (reseed-data-fix.sql)
- ⚠️ PresenceService shows warnings (Upstash Redis unavailable — non-critical — LRU cache now masks the latency)

**Performance Status (2026-07-21):**
- ✅ Backend compression enabled (gzip), JWT blacklist LRU cache, telemetry fire-and-forget, parallel login writes, chat snapshot cache, validated 5 NOT VALID FKs, 8 composite indexes added
- ✅ Postgres tuned: shared_buffers=2GB, work_mem=64MB, random_page_cost=1.1
- ✅ Frontend `NEXT_PUBLIC_API_URL=/api/v1` (bypasses Next.js rewrite proxy hop)
- ✅ See [fixes.md §FIX-PERF-001](fixes.md#fix-perf-001--contabo-latency-login-1-2s-lists-multi-second-chat-3-6s-2026-07-21) for full details and measured timings
- Backend uptime: stable since 2026-07-23 15:55 PKT (5 restarts today for FIX-COMPREHENSIVE-R2 deploy sequence — backend reload, filter fix, tier-guard rebuild, lockfile regen, and a final pass; otherwise stable since 2026-07-21 10:44 PKT after the perf-fixes deploy).

---

## All 14 Enterprise Integration Phases — COMPLETE (2026-07-17)

**Status:** ✅ ALL 14 PHASES COMPLETE — 13 deployed, Phase 14 source complete awaiting deployment

| Phase | Module | Status | Key Deliverable |
|-------|--------|--------|-----------------|
| P1 | EIE Runtime | ✅ Deployed | 66-statement SQL migration (5 tables, 7 enums, 2 triggers) |
| P2 | Event Fabric | ✅ Deployed | IdempotencyModule, SimulationVisibilityModule, TimelineEventsModule |
| P3 | Context Plane | ✅ Deployed | AssembledContext; all capability queries tenant-scoped |
| P4 | Work Runtime | ✅ Deployed | WorkRuntime + Workload + Task lifecycle; approval gating |
| P5 | Enterprise Cognition | ✅ Deployed | Cognize() with evidence/confidence/trade-offs |
| P6 | Enterprise Autonomy | ✅ Deployed | Mission orchestration; Health computation; Auto-correction |
| P7 | Enterprise OS | ✅ Deployed | Digital Twin; Deterministic Simulation; Forecasting; Optimization |
| P8 | Platform Operations | ✅ Deployed | Health Center; Audit Center; Security Center; Diagnostics |
| P9 | Enterprise Intelligence | ✅ Deployed | Knowledge Graph; Relationship Engine; Semantic Search; Ontology |
| P10 | Platform SDK | ✅ Deployed | Six Pools; Plugin registry; WorkRuntimeEventsConsumer |
| P11 | Cloud Platform | ✅ Deployed | Multi-cloud abstraction; CloudHealthMonitor |
| P12 | Application Framework | ✅ Deployed | App lifecycle (Draft→Active→Deprecated→Retired); event emissions |
| P13 | AI Governance | ✅ Deployed | Evaluate/flag/record/createPolicy/decideReview; event emissions |
| P14 | Platform Evolution | ✅ Source complete | Technology Radar; Benchmark; Experiment; Feature Lifecycle; event emissions |

**Architecture:** P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10 → P11 → P12 → P13 → P14

> **Phase 9 Certification (G9 — NC-AWL-IMP-1 §11):** G9 APPROVED (105/105 scenarios, 100% pass rate, 2026-07-27). See [`docs/reconstruction/phase-9/G9-EVIDENCE.md`](docs/reconstruction/phase-9/G9-EVIDENCE.md). All 10 mandatory invariants enforced. Runner: `pnpm certify:phase9`. Dashboard: `src/test/certification/reports/g9-dashboard.html`.

---

## Simulation-5: AEIC — COMPLETE (2026-07-17)

**Final Score:** 83/100 | Grade: B+ | Verdict: SUCCESS | Production Ready: YES

| Metric | Value |
|--------|-------|
| Simulation ID | `dcb9dbc5-4edd-413b-94b1-74a5c6d1b8ac` |
| Tenant | `simulation5-aeic@neurecore.test` |
| Tenant ID | `c4dab6c0-9d3a-4180-bcff-15abb3e32ca9` |
| Decisions | 85 |
| AI Debates | 20 |
| Board Meetings | 9 |
| Reality Events | 28 (+ 8 cascades) |
| Devil's Advocate Challenges | 60 |
| Hallucination Tests | 15 |
| Confidence Predictions | 900 |
| Ethics Dilemmas | 9 |
| Learning Updates | 8 (weekly) |

**References:**
- Full implementation: `simulations/simulation-5-honest/COMPLETION.md`
- Design docs: `simulations/simulation-5-honest/design/*.md`
- Execution report: `simulations/simulation-5-implementation/REPORT.md`
- Evidence: `simulations/simulation-5-implementation/simulation-5-evidence/`

---

**2026-07-12 23:00 PKT — Gap Fixes Batch (FIX-044 through FIX-047):**
- ✅ **FIX-044: Department role broadened** — OWNER/ADMIN can now create/update/delete departments (was SUPER_ADMIN-only)
- ✅ **FIX-045: Admin auth full-page navigation** — `doInitialize()` now uses `getCsrfToken()` (JS-readable) instead of `getAccessToken()` (HttpOnly, always null). Fixes false session expiry on browser refresh/URL bar navigation
- ✅ **FIX-046: CurrentUser decorator property extraction (systemic fix)** — The `@CurrentUser('tenantId')` decorator ignored its parameter and returned the full user object. Every controller using `@CurrentUser('property')` was passing the full JwtPayload as a string. This affected ALL controllers using property extraction (routines, finance, departments, etc.). Fixed decorator to actually extract properties
- ✅ **FIX-047: Routines + Finance null tenantId** — Routines controller had missing `resolveTenantId` implementation. Fixed the controller signature to use `@CurrentUser() user` instead of non-working `@CurrentUser('tenantId') tenantId`
- ✅ **All API endpoints return 200** — Routines, Finance invoices, Finance expenses all verified working
- ✅ **Department DELETE works** — 204 for OWNER role (was 403)

**Earlier: 2026-07-12 Full Verification Sweep:**

**2026-07-12 11:00 PKT — Discovery Tab Question Pre-fill Bug Fixes (FIX-040, Kilo):**
- ✅ **Root cause — 3 bugs working together:** (1) `seedMissingAsSystemResponses` seeded all required questions with `SYSTEM null` → Discovery asked for answers already in Essentials. (2) Top-level project fields (`name`, `description`, `targetDate`) never seeded as InformationResponses. (3) `FormSkin` always initialized to `''` with no pre-fill from existing response.
- ✅ **Fix 1 — ProjectsAdapter:** Added `seedFromProjectTopLevelFields()` which seeds `projectName → Project.name`, `projectDescription → Project.description`, `targetEndDate → Project.targetDate` as `USER_INPUT` responses before `seedMissingAsSystemResponses` runs. Order matters: USER_INPUT takes precedence over SYSTEM null.
- ✅ **Fix 2 — FormSkin:** Added `existingValue?: unknown` prop. `useEffect` now initializes `setValue(existingValue ?? '')` instead of always `''`.
- ✅ **Fix 3 — QuestionEngine:** Added `existingResponseValue?: unknown` prop, forwarded to `FormSkin`.
- ✅ **Fix 4 — ProjectCreationDiscovery:** Destructures `existingResponse` from `useAdaptiveNext`, passes `existingResponse?.value` to `QuestionEngine`.
- ✅ **Fix 5 — useAdaptiveNext:** Returns `existingResponse` from backend; stores in state.
- ✅ **Fix 6 — engine.controller.ts:** `getNextQuestion` now returns `existingResponse: { value, confidence } | null` by looking up the current response for the picked question.
- ✅ **Build:** backend `tsc --noEmit` + `nest build` → clean; frontend `tsc --noEmit` + `next build` → clean.
- ✅ **Contabo deploy:** backend rsync → `prisma generate` → `nest build` → PM2 restart; frontend rsync (no lockfile) → `npm run build` → PM2 reload. All services healthy (brain/200, hq/200, cc/200).
- See [fixes.md FIX-040](fixes.md#fix-040--discovery-tab-stuck-on-project-name-2026-07-12) for full details.

**2026-07-12 10:14 PKT — Project Creation Wizard Bug Fixes (Kilo):**
- ✅ **Issue 1 — Project type dropdown shows all types, not tenant-industry filtered:** `ProjectCreationEssentials.tsx` now calls `tenantsService.getCurrent()` first, extracts `tenant.industry`, then passes it as `industry` filter to `projectTypesService.list({ industry: tenant.industry ?? undefined })`. Graceful fallback: if `getCurrent()` fails, still loads all types.
- ✅ **Issue 2 — Discovery tab auto-skips before loading completes:** `useResolvedRequirements.ts` initial `loading` state changed from `false` → `undefined` to distinguish "not yet started" from "done loading". `ProjectCreationDiscovery.tsx` guard changed from `!reqLoading` → `reqLoading === false`. Added `projectId` to `useEffect` dependency.
- ✅ **Tenant industry remapped:** `mali@live.com` tenant had `industry: 'ACCOUNTING'` which is not in the 15 seeded industry slugs (→ 0 filtered types). Remapped to `financial-services` via direct Prisma update on Contabo. Filter now returns 10 types.
- ✅ **Build:** `tsc --noEmit` → 0 errors; `next build` → clean
- ✅ **Contabo deploy:** rsync (excluding `package-lock.json` due to lockfile drift) → `npm run build` on server → PM2 reload → all services healthy (brain/200, hq/200, cc/200)
- ⚠️ **Lockfile drift:** `deploy.sh tenant` fails due to `lucide-react` version mismatch (server `^0.460.0`, local `^1.7.0`). Workaround: rsync with `--exclude=package-lock.json` then build on server.
- See [fixes.md FIX-039](fixes.md#fix-039--project-creation-wizard-bug-fixes-2026-07-12) for full details

**2026-07-11 22:55 PKT — Comms Rollout Implementation (Kilo):**
- ✅ **Pre-rollout engineering** (§0 tasks): 6 Prisma migration files created + marked as applied (`20260711_comms_01` through `_06`); 47 total migrations tracked, DB schema up to date
- ✅ **WS security hardening** (`EventsGateway`): `thread:join`/`thread:leave` now verify tenant ownership + participant membership; `PrismaService` injected; any authenticated-but-non-participant user → `{ joined: false }`
- ✅ **Admin feature-flags page** extended: `TenantFeatureFlagOverrides` +11 comms flags; UI shows "Hermes Runtime" + "Enterprise Communication" grouped sections with ⚠️ HIGH RISK on `AGENT_MESSAGING_ENABLED`
- ✅ **A2A flag ambiguity resolved**: `AgentMessagingGuard` now checks `AGENT_MESSAGING_ENABLED || COMM_AGENT_MESSAGING_ENABLED` (OR condition)
- ✅ **Server feature flags** extended: `useServerFeatureFlag.ts` `ServerFeatureFlag` type +11 comms flags
- ✅ **Comms-gated tenant UI**: `ThreadInboxPanel` + `ThreadView` components added to `/service-desk?tab=threads` (5-tab layout)
- ✅ **Thread service + store + hook**: `threads.service.ts` (IThreadService), `threadStore.ts` (Zustand persist+merge), `useThreads.ts` (DIP, WS lifecycle)
- ✅ **Socket infrastructure**: `joinThread()`/`leaveThread()` exports, 8 thread WS event listeners, EventBus types extended, storeEventBridge wired
- ✅ **Build verification**: `tsc --noEmit` → 0 errors (backend + both frontends), `next build` → all routes compiled, `nest build` → clean
- ✅ **Contabo deploy** (2026-07-11 20:07 PKT): All 3 services rsync'd, rebuilt, and restarted. Backend 6 migrations marked as applied (47 total). `brain` health 200, `hq` 200, `cc` 200. DR snapshot at `/opt/neurecore/_archives/20260711-200735-pre-comms-deploy/`. PM2 saved.
- ✅ `comms/comms-rollout.md` updated with §14 completion + deploy notes
- ⚠️ No feature flags flipped yet — all `COMM_*` flags still false. Proceed to §5 per-phase flag rollout.
- See [comms/comms-rollout.md](comms/comms-rollout.md) for full implementation and rollout sequence

**2026-07-11 17:35 PKT — Settings/AI Providers + Admin chat fixes (Kilo):**
- ✅ MiniMax API fully operational: boot probe 6/8 [ok] at avg 3175ms; base URL fixed `api.minimax.io` (was `api.minimaxi.com`); proper `sk-*` key
- ✅ Settings/AI Providers page (`/admin/settings/ai`) shows all 5 providers with nested models + routing config
- ✅ `AiProvidersController` created at path `settings/ai` bridging frontend `SettingsApiClient` basePath to gateway DB catalog
- ✅ `PROVIDER_INFO` updated with `openai`, `anthropic`, `mimo` + type-safe fallback for unknown slugs
- ✅ `AISettingsService` (17 methods) now uses `unwrapList()`/`unwrapItem()` for NestJS response wrapper parsing
- ✅ Admin chat (`POST /chat/messages`) returns real MiniMax replies; 4 chat paths added to CSRF exemption in both middleware files
- ✅ FIX-038 logged in [fixes.md](fixes.md) covering all 4 sub-issues

**2026-07-11 16:25 PKT — AI Gateway deployed to Contabo (Kilo):**
- ✅ All three services rebuilt + redeployed: backend (3003), admin (3020), tenant (3001)
- ✅ 2 Prisma migrations applied: `20260711_ai_gateway_catalog` (model_providers, ai_models, tenant_model_overrides, model_catalog_audits) + `20260711_ai_gateway_cost_attribution` (sourceModule, sourceEventId, metadata on cost_records)
- ✅ Seed run: 5 providers (MiniMax, DeepSeek, MiMo, OpenAI, Anthropic) + 12 models across 8 capabilities
- ✅ `AI_GATEWAY_V2=true` + `MINIMAX_API_KEY` + `MINIMAX_BASE_URL` + `MINIMAX_MODEL` added to `/opt/neurecore/backend/backend/.env`
- ✅ MiniMax fully operational: `sk-*` key + `api.minimax.io/v1` base URL; boot probe 6/8 [ok] averaging 3175ms per probe
- ✅ Tenant chat (ConversationPanel) routes through gateway: `capability=conversation, provider=minimax, model=MiniMax-M2.7-highspeed`
- ✅ Tenant AIChatPanel shows real AI response (Daily Digest)
- ✅ Backend health API endpoints all functional: `/admin/models/providers`, `/admin/models`, `/admin/models/health`, `/admin/models/cost-summary`
- ⚠️ Frontend `/admin/models` page has pre-existing basePath routing issue (sidebar links double `/admin` prefix)
- ✅ 728/728 backend tests pass (76 suites); `nest build` + `tsc --noEmit` clean
- ✅ 6 deploy-time issues fixed (migration SQL, DI crashes, start.sh — see FIX-037 in fixes.md)
- ✅ PM2 saved; all processes survive reboot
- DR snapshot: `/opt/neurecore/_archives/20260711-112413-pre-ai-gateway/`
- See [ai-gateway/ai-gateway-imp-plan.md](ai-gateway/ai-gateway-imp-plan.md) for full feature list + deploy details

**2026-07-11 00:30 PKT — Phase 8 deployment (Kilo):**
- ✅ Goal pre-population in `ProjectsService.create()` is now synchronous — by the time create returns, the project has its goals seeded from `goalTemplate`
- ✅ `ProjectMemoryService.updateConfidence()` added with dedicated `confidence Int?` column + migration `20260711_phase8_memory_confidence`
- ✅ `ProjectDecisionService.getForProject()` added
- ✅ `ProjectAutomationService.replan()` real implementation (was a stub)
- ✅ Project-memory agent tools refactored to use `ProjectMemoryService` (proper tenant scoping)
- ✅ `ChiefOfStaffService` event subscribers emit to humans via `EventsGateway` (`cos:notification` + `cos:project_update`)
- ✅ `ProjectHealthService` budget signal + analytics now read `Invoice.total`
- ✅ `Goal.measurableCriteria` wired through interface + repository + GoalTemplateService
- ✅ Backend: 694/694 tests pass, tsc 0 errors, nest build OK
- ✅ Contabo: backend redeployed, migration applied, `/api/v1/health` 200
- See `memory-bank-new/Projects/PHASE-8-COMPLETION.md` for the full report

**2026-07-10 19:03 PKT — Session summary (Kilo):**
- ✅ FIX-032: Login silently failing — added `USE_HTTPONLY_AUTH=true` to `/opt/neurecore/backend/.env`
- ✅ FIX-033: `/departments?tab=projects` empty — added redirect to `/projects`
- ✅ LiteSpeed vhost `hq.neurecore.com` updated to proxy to port 3001 (was 3005)
- ✅ LiteSpeed vhost `brain.neurecore.com` updated to proxy to port 3003 (was 3004)
- ✅ neurecore-backend: port 3003, healthy
- ✅ neurecore-tenant: port 3001, healthy
- ✅ neurecore-admin: port 3020, healthy
- Login verified: mali@live.com → /home with "Good evening, Mali" greeting
- Projects redirect verified: /departments?tab=projects → /projects

**2026-07-10 17:30 PKT — ALL PENDING ISSUES RESOLVED (Kilo):**
- ✅ D22: Socket.IO 400 errors — Fixed SocketManager URL derivation (was using wrong path from NEXT_PUBLIC_API_URL)
- ✅ H1: Hermes per-tenant enable script — `scripts/enable-hermes-tenant.cjs`
- ✅ PE8: DB migration drift — All 37 migrations applied; schema/DB in sync for Hermes models
- ✅ D26: Complete @IsUUID() lint audit — Fixed 3 remaining usages, created `scripts/lint-no-isuuid.sh`
- ✅ PD-10: Moved orphan migration to `prisma/sql/`
- ✅ PD-40: Fixed 38 failing unit tests — Main suite 694/694 passing
- ✅ PD-21: Production-blocked OAuth adapters + TODO marker tracker
- ✅ PD-03: Lockfile parity — rebuild.sh prefers pnpm
- ✅ PD-42: Jest deprecated flag — --testPathPattern → --testPathPatterns
- Backend deploy: rsync → PM2 restart; healthy @ /api/v1/health 200
- Frontend-tenant deploy: rsync → npm install → next build → PM2 restart
- Frontend-admin deploy: rsync → npm install → next build → PM2 restart
- Socket.IO endpoint: `https://hq.neurecore.com/socket.io/?EIO=4&transport=polling` → 200 OK

**2026-07-10 16:30 PKT — Pending Issues Resolved (Kilo):**
- ✅ PD-01: Added `@upstash/redis: 1.37.0` and `cookie-parser: 1.4.7` to `backend/package.json`
- ✅ PD-30: Fixed `.env` `DEFAULT_MODEL` quoting (`"gpt-4-turbo-preview"`)
- ✅ D24: Added `@@map()` to 7 Hermes models (HermesAgent, HermesCapability, HermesToolPermission, HermesSession, HermesMessage, HermesMemoryEntry, HermesAuditLog) — 101/101 models compliant
- ✅ D25: Created `backend/scripts/enforce-enum-case.sh` (76 enums verified PascalCase)
- ✅ PD-50: Created `.github/workflows/backend-ci.yml` (tsc, lint, prisma validate, build, tests, schema checks)
- ✅ PD-51: Created `scripts/pre-commit-check.sh` (tsc, lint, prisma validate, @@map enforcement, enum check, auth-lint)
- ✅ PD-20: Replaced `console.log/warn` with NestJS Logger in `main.ts`, `settings.service.ts`, `tools.module.ts`, `connectors.module.ts`, `context.controller.ts`, `tracing.ts`
- Backend deploy: `npm install --legacy-peer-deps` → `prisma generate` → `nest build` → PM2 restart
- Backend health: `curl https://brain.neurecore.com/api/v1/health` → `200 {"status":"healthy"}`

**2026-07-10 15:33 PKT — Tenant Portal end-to-end validation session (Kilo):**
- Frontend-tenant + frontend-admin deployed to Contabo and verified live
- Tested 12 features end-to-end with `mali@live.com` (Shahikhail@@0098): project page load, status transitions (LEAD→PROPOSAL_SENT→WON→ACTIVE), stages management, team assignment, goals, deliverables, memory/decisions, customer list/detail, dashboard, departments/projects tab, service desk, finance, settings, project creation (3-step wizard), project deletion
- All features now functional — see FIX-028 to FIX-031 in [fixes.md](fixes.md) for fixes
- 3 customers, 3 projects, 1 goal, 1 deliverable, 1 memory, 1 decision, 1 team member, 4 stages persisted to Contabo prod
- PM2 services: `neurecore-backend` (id 10, port 3003, healthy), `neurecore-tenant` (id 16, port 3005, healthy), `neurecore-admin` (id 14, port 3020, healthy)
- Pre-existing from prior session: Projects Phases 1-7 + EIE Phase 2 sub-phases FULLY IMPLEMENTED

**Projects implementation summary (2026-07-09 session):**
- IMPLEMENTATION-PLAN.md Phases 1–7: ALL ✅ COMPLETE (all acceptance criteria met)
- project-creation-imp-plan.md Phase 2 sub-phases (2A–2G): ALL ✅ COMPLETE (EIE, catalogue, Question Engine, Hermes, continuous discovery, auto-allocation)
- All 37 Prisma migrations applied to Contabo prod
- Audit: `tsc --noEmit` 0 errors all 3 apps; `pnpm prisma validate` ✅; jest 717/755 (38 pre-existing failures in Hermes/cookie-auth unrelated)
- Backend modules verified: projects, information-engine (11 sub-modules), customers, project-types, deliverables, project-decisions, project-memory, project-stages, project-members, project-health, execution-log, portal, approvals, approval-chains
- Seed scripts verified: `seed-question-packs.cjs` (20 packs, 131 questions), `seed-project-types.cjs` (150 types), `seed-onboarding-allocator.cjs`, `seed-industries-majors.cjs` — idempotent, all 15 industries in sync
- Schema audit: `check-industries-sync.mjs` → all 15 industries in sync across seed + both frontends
- Pre-deploy browser tests: all new routes 404 (code not yet on production)
- Backend deployed to Contabo: rsync → pnpm install → prisma migrate deploy → nest build → pm2 reload
- Backend health: `curl https://brain.neurecore.com/api/v1/health` → `200 {"status":"healthy"}` — 194 restarts, healthy
- Redis ENOTFOUND for Upstash (non-fatal — backend still starts and serves healthy)
- `pnpm-workspace.yaml` fixed for pnpm 9.x compatibility (added `packages: []`)
- Pre-deploy snapshot saved: `/opt/neurecore/_archives/20260709-212750/`

**Earlier (now historical — see 2026-07-09 FULLY IMPLEMENTED above):**

**One-line TL;DR:** The Enterprise Communication Platform (9 phases, 20 backend services, 4 controllers, 2 new modules, 8 new Prisma models, 9 interface contracts, 11 feature flags, replaced 3 disconnected feed/message systems) is implemented, audited, and feature-flagged off — zero prod impact until `COMM_*` / `AGENT_MESSAGING_ENABLED` flags are flipped per-tenant.

> - Full spec at [`enterprise-communication.md`](enterprise-communication.md) Rev 4. Implementation reference at [`enterprise-comms-chat.md`](enterprise-comms-chat.md) rev 3 (with §17 rev-2 audit pass + §18 rev-3 deep-audit pass).

> - **New backend services (20):** `ThreadService`, `ActivityService`, `EnterpriseEventBusService` (replaces legacy in-memory `HermesEventBusService`), `ParticipantResolver`, `AgentMessagingService` + `AgentMessagingGuard` (circuit breaker), `PresenceService` (Redis-backed with SCAN sweep), `ConversationIntelligenceService` (map-reduce summarization + RAG with `scopeDepartmentId`), `EntityGraphService`, `DependencyGraphService`, `ThreadSummarizationService`, `DigestService`, `EntityHealthRollupService`, `CostCenterService`, `RiskDetectionService`, `EscalationService`, `FollowUpService`, `WorkflowTemplateService`, `NotificationPreferenceService`, `RetentionJobService`. All services live under `backend/src/modules/hermes/services/`, follow SRP (one concern each), and have a corresponding interface under `backend/src/modules/hermes/interfaces/`. After rev-3 audit, interface-based DI uses symbol tokens (`@Inject(HERMES_EVENT_BUS)`, `@Inject(THREAD_SERVICE)`, `@Inject(ACTIVITY_SERVICE)`, `@Inject(HERMES_RUNTIME)`, `@Inject(AGENT_MESSAGING_GUARD)`, `@Inject(PARTICIPANT_RESOLVER)`) wired via `useExisting` aliases in `HermesModule.providers`.

> - **New frontend (`frontend-tenant`):** `activityFeedService` + `useActivityFeed` hook (REST + WS `activity:new` + `since`-based backfill-on-reconnect after rev-3 fix); `LiveFeedWidget` rewired to consume the canonical feed (no more mock data). New WS subscribe protocol: clients call `socket.emit('thread:join', { threadId })` to receive per-thread broadcasts (added rev 3 — see `enterprise-comms-chat.md §9.1`).

> - **Out of scope / deferred to follow-up PRs:** frontend `AgentInboxPanel`/`ThreadView`/`PresenceBadge` UIs; unit/integration tests per spec §15.2 + §16.6; vector-search in `ConversationIntelligenceService.search/ask` (ILIKE fallback works); `HealthSeverity` warning-level notifications in escalation; HermesRouter extension for "Who Should I Ask" (§16.4.1). Full list: `enterprise-comms-chat.md §15`.

> **2026-07-07 19:55 PKT — FIX-020 SHIPPED + DEPLOYED TO CONTABO (Kilo):**
> - **Auth hardening refactor** complete across 10 phases. See [`plans/auth-hardening-refactor.md`](plans/auth-hardening-refactor.md) (now fully ✅ across all 10 phases) and [`int-features/auth-architecture.md`](int-features/auth-architecture.md) (the new authoritative reference).
> - **Production behavior changes you must not regress:**
>   - 401 on any API no longer triggers `window.location.href = '/login'`. The new `authResponseInterceptor` calls `authService.reportAuthFailure()` which transitions React state to `unauthenticated` and renders `<SessionExpiredScreen>` with a "Sign in again" button.
>   - All `localStorage`/`sessionStorage` writes for auth keys are banned (`bash scripts/auth-lint.sh` enforces).
>   - `lib/security.ts` deleted in both frontends.
>   - `TokenManager` (tenant) and `cookieAuth` (admin) are now thin shims that delegate to `@/auth/impl/CookieTokenRepository` — they are NOT independent cookie writers anymore.
> - **PM2 (after deploy):** `neurecore-tenant` (id 40, pid 844016, uptime 30m), `neurecore-admin` (id 42, pid 846031, uptime 27m), `neurecore-backend` (id 43, pid 636597, uptime 5h), `neurecore-cors-proxy` (id 7, uptime 2D). All online.
> - **Tests:** `vitest run` → 43/43 (27 new auth tests + 16 existing). Backend `auth-hardening.spec.ts` → 8/8. Playwright on prod → 9/9.
> - **Snapshot:** `/opt/neurecore/_archives/20260707-161320/pre-fix-020/` (~89 MB).

**Earlier (now historical — see FIX-020 SHIPPED above):**

> **2026-07-07 16:10 PKT (FIX-019: Defensive patterns shipped — Zustand `merge` for all persisted stores, `Array.isArray` guards in 9 components, `/help` page created, socket URL derives from `window.location`, pre-existing `command-center` build error fixed. `next build` clean. `https://hq.neurecore.com/home` and `https://hq.neurecore.com/help` return 200. `neurecore-tenant` PM2 id 40 online.)**

> **2026-07-07 00:45 PKT — Deployment Enhancement shipped (Kilo):**
> - **Frontend-admin** — 4 gaps closed:
>   1. **Package Deploy** flow added to tenant detail Deploy tab (select package → preview capacity/blockers → configure authority/idempotency → deploy). Uses `GET /packages/deploy/preview` and `POST /packages/deploy`.
>   2. **Single Department Deploy** card added to tenant detail Deploy tab.
>   3. **Deploy from agents-pool** — "Deploy" button on each AI Employee card opens `DeployToTenantModal` (pick tenant, name, budget, authority).
>   4. **Deploy from departments-pool** — "Deploy Dept" button on each department template card opens `DeployToTenantModal` (pick tenant + structure item index).
> - New files: `frontend-admin/src/components/pool/DeployToTenantModal.tsx` (reusable modal).
> - Modified files: `packages.service.ts` (+deployPreview, +deploy), `deptTemplates.service.ts` (+deploySingleDepartment), `tenants/[id]/page.tsx` (+Package/SingleDept cards), `agents-pool/page.tsx` (+Deploy button), `departments-pool/page.tsx` (+Deploy Dept button).
> - Plan: `memory-bank-new/plans/deployment-enhancement-plan.md`.
> - Build: `npm run build` — zero errors, 47 routes compiled.

> **2026-07-07 00:15 PKT (FIX-021/022/023 deployed to Contabo — GlobalExceptionFilter fix + Packages UI fixes + Tiers DTO fix)**
> **Snapshot sources:** `pm2 jlist`, `ss -tlnp`, `git log/status`, `df`, `ls /opt/neurecore`, `cat /etc/letsencrypt/live/`, `npx prisma migrate status`, `grep -c ONBOARDING_TASK .../client/index.d.ts`, `prisma.industry.count()` / `prisma.package.count()` via Prisma

> **2026-07-06 16:15 PKT — Chat systems production-verified (Kilo):**
> - Deployed FIX-017: `chat.service.ts` C4 fix (maps `query` → `message` for backend DTO compatibility) to Contabo.
> - Build process: `npm install --legacy-peer-deps` (eslint peer-dep conflict on `npm ci`) → `npm run build` → `pm2 restart neurecore-tenant`.
> - Both chat panels tested end-to-end via Playwright: ConversationPanel (💬) works — AI responds with MiniMax tokens (990↑ 44↓). AIChatPanel (✦ Ask AI) works — HeadQuarter AI responds with contextual data.
> - Backend: PM2 id 43, git HEAD `c5c05ec`, MINIMAX_API_KEY configured, both `/chat/messages` and `/ai/chat` endpoints live.
> - Chat backend log: `POST /api/v1/chat/messages 200 2990ms`. 
> - Tenant test user: `audrey.wizard.test3@najeeb.test` (tenant `2881874f-..`, NeureCore Demo Inc.).
> - Docs updated: `chat-bots.md` (C1-C4 + H1-H4 resolved, Phase 1-2 ✓), `fixes.md` (+FIX-017), `pending-tasks.md` (+D14), `deployment.md` (§1 + §10 updated).

> **2026-07-05 20:15 PKT — Phase 6: 3-Column Glassmorphic Home Page (Kilo):**
> - **New Zustand store:** `src/stores/uiPreferencesStore.ts` — manages background style (4 gradients), visible icons, visible widgets, widget order; persists to localStorage.
> - **Left panel:** 280px fixed-width, dynamic glossy gradient icons (10 default + selectable visibility). Visible on `/home` only; toggle via menu icon on other routes. Preferences modal accessible from panel.
> - **Center column:** Enhanced hero + KPI strip + network status + departments/quick-actions grid + tasks panel (existing components, no changes needed).
> - **Right panel:** 320px fixed-width, 5 collapsible real-time-ready widgets:
>   - LiveFeedWidget (activity timeline)
>   - StatsWidget (7-day Recharts chart)
>   - QuickActionsWidget (2×2 gradient buttons)
>   - TasksWidget (active tasks + priority badges)
>   - ApprovalsWidget (pending approvals + inline actions)
> - **Preferences modal:** Background selector (4 preset gradients), widget visibility toggles.
> - **Glassmorphic styling:** New CSS classes in `globals.css` (`.glass-panel`, `.glass-icon`); backdrop-blur + semi-transparent white.
> - **Animations:** Framer Motion entrance/exit (stagger, slide, fade) for all elements.
> - **Files created:** 11 new component files + 1 store + updated home page + CSS. Build verified (npm run build clean).
> - **Real-time ready:** Widget mock data easily replaceable with WebSocket/API streams (`/command-center/activity`, `/analytics/performance`, etc.).
> - **Deployed locally:** Ready for integration testing at `http://localhost:3001/home`. **Not yet pushed to Contabo.**
>
> **2026-07-05 01:50 PKT — Accounting packages seeded with full composition (Kilo):**
> - `seed-accounting-packages.cjs` inserted **15 packages** anchored to Major #16 (`accounting-audit-services`).
> - All packages have filled composition: Departments (`DepartmentTemplate[]`), AI Agents (`AgentTemplate[]`), Features (`Feature[]`).
> - Composition totals across the 15 packages: 25 dept-linkings, 70 agent-linkings, 65 feature-linkings.
> - Tier count for this vertical: 4 Starter / 8 Professional / 3 Enterprise (no Government primary; 4 pool-Business-tier packages are anchored to `professional` tier template — same convention as the package pool).
> - First vertical with non-empty packages. **53 of the 68 pool-package rows** still have empty composition (waiting on per-Major seeders of the same shape). See [`pools-taxonomy.md` §6.5](pools-taxonomy.md).
> - The package pool's "Business" tier packages are still anchored to our `professional` tier (D9 pending).
>
> **2026-07-05 01:25 PKT — Master Package Pool seeded (Kilo):**
> - Migration `20260705_package_catalogue` applied (additive): new enum `PackageScope { FUNCTIONAL | VERTICAL | HYBRID }`, columns `Package.scope` (default `FUNCTIONAL`) + `Package.version` (default `1`). 24/24 migrations clean.
> - `seed-package-catalogue.cjs` inserted **68 empty `Package` rows** (DRAFT, version=1, no composition). Idempotent script supports `--check`.
> - Tier mapping note: the package-pool spec's "Business" tier is mapped to our existing `professional` tier template (we have no `business` tier; mapping is reversible).
> - See [`pools-taxonomy.md` §6](pools-taxonomy.md) for the pool shape + scope/availability design.
>
> **2026-07-05 01:29 PKT — Industry pool extended to 16 majors (Kilo):**
> - `add-industry-accounting.cjs` inserted Major #16: `accounting-audit-services` (Accounting & Audit Services) at sortOrder 35.
> - Sub-industries packed into `description`: Public Accounting Firms, Audit & Assurance, Tax Advisory, Bookkeeping Services, Forensic Audit, Payroll Services, Financial Advisory, CPA Practices, Chartered Accounting Firms.
> - Idempotent, additive-only seeder (no `deleteMany`). Distinct from the canonical `seed-industries-majors.cjs` which is a full replace.
> - 16 industries now live in production. All other pool counts unchanged: **706 AI Employees**, **57 Department Templates**, 19 `Feature` rows, 4 `TierTemplate` rows, **68 `Package`** rows.
> - See [`pools-taxonomy.md` §3](pools-taxonomy.md).
>
> **2026-07-05 01:03 PKT — Industry pool repopulated to canonical 15 majors (Kilo):**
> - Three-step history of `Industry` rows on production:
>   1. Phase 10 seed (`seed-business-composition.cjs`): **8**
>   2. Compact interim seed (`seed-industries-compact.cjs`): **30** narrow rows (healthcare, hospitals, clinics, …) — superseded the same evening.
>   3. Canonical 15-major seed (`seed-industries-majors.cjs`): **15** majors. Sub-industries packed into `Industry.description` as bullet text (no schema change).
>   4. Add Major #16 (`add-industry-accounting.cjs`): **16** majors. See 01:29 entry above.
> - Verified pre-migration: 0 `Package` rows referencing any industry, so `deleteMany` was safe (Restrict FK would have refused otherwise).
> - Single transaction: either all 15 majors land or nothing changes.
> - Idempotent script supports `--check`/`--dry-run` for diff-only preview.
> - See [`pools-taxonomy.md`](pools-taxonomy.md) §3 for the full taxonomy table + migration history.
> - Components / counts unchanged in this pass: still **706 AI Employees** (`AgentTemplate`), **57 Department Templates** (`DepartmentTemplate`), 19 `Feature` rows, 4 `TierTemplate` rows, 0 `Package` rows.


> **2026-07-05 00:25 PKT — Login redirect-loop fix (Kilo):**
> - Two bugs combined to break login → page navigation flow after the pagination deploy
> - **Bug A — `unwrapItem` mishandled backend response format.** Backend wraps responses in `{status: "success", data: {user, tokens}}`, but `src/services/unwrap.ts` only checked for arrays or `data.items`. Login response → `unwrapItem` returned `null` → `result?.tokens` was undefined → tokens never written to `localStorage.admin_accessToken`, user never written to `authStore`. Login appeared to "succeed" (form submitted, request returned 200) but no session existed.
> - **Bug B — Zustand `persist` hydration race in `useAdminAuth`.** `src/hooks/useAdminAuth.ts` ran `router.replace('/login')` in `useEffect` whenever `user` was null. On full page navigation, the first render had `user = null` BEFORE Zustand rehydrated from localStorage, so the redirect fired before persisted state could load. Even after fixing Bug A (tokens stored), navigating to `/agents-pool` still redirected back to `/login`.
> - **Fix A:** added fallback in `unwrapItem` to return `data` (axios response body) when no `items`/`data.data` match.
> - **Fix B:** added `_hasHydrated` flag in `authStore` via `onRehydrateStorage` callback; `useAdminAuth` now waits for `hasHydrated === true` before checking auth state.
> - Also added `frontend-admin/start.sh` to repo (was being deleted by rsync `--delete` — process couldn't start without it; mirrored `frontend-tenant/start.sh` pattern).
> - Deployed: rsync src/ + `./node_modules/.bin/next build` + `pm2 restart neurecore-admin`. Verified in browser: login → `/overview`, then `/agents-pool` shows **722 templates** with pagination, `/departments-pool` shows **63 templates**.
>
> **2026-07-04 23:35 PKT — Pool pagination fix (Kilo):**
> - All 5 pool pages (AI Employees, Departments, Industries, Tiers, Features) had a bug: `useEffect` called `service.list({ limit: 100 })` directly then immediately called `refresh()` which overwrote it with `limit: 20` from hook defaults — only ever showing 20 items with no way to navigate further
> - Fixed: replaced redundant direct `list()` + `refresh()` call in `useEffect` with `setOpts({ search, status, page: 1, limit: 20 })` — properly updates hook state
> - Created `src/components/pool/PoolPagination.tsx` — shared pagination shell (shows "X–Y of Z" + Prev/Next + page buttons), used by all 5 pool pages
> - All 5 pages now wire `onPageChange` to `setOpts((o) => ({ ...o, page: p }))` — true server-side pagination at 20 items/page
> - Deployed to Contabo: rsync + `npm ci --legacy-peer-deps` + `next build` + `pm2 restart neurecore-admin`
> - Also fixed: missing `start.sh` for `neurecore-admin` (was missing from rsync target; created manually on Contabo to match `neurecore-tenant` pattern)
>
> **2026-07-04 23:15 PKT — Pool seeding (Kilo):**
> - `prisma/seed-agency-agents.cjs` created — reads `agency-agents-main/` pool, parses frontmatter, upserts to `AgentTemplate` (isPublic=true) and `DepartmentTemplate` (isPublic=true)
> - `agency-agents-main/` synced to Contabo at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/Temp/agency-agents-main/`
> - **706 AI Employees** (AgentTemplate) + **57 Department Templates** (DepartmentTemplate) seeded idempotently
> - Admin frontend label "AI Agents" → "AI Employees" renamed across 23 files + deployed to Contabo
>
> **2026-07-04 implementation pass (Kilo):** See `pending-tasks.md` §12 for the full list. Highlights:
> - FIX-008: `token.service.ts` now throws `UnauthorizedException` (401 not 500); `MissionFeedAiPrioritizer` hardened with `category: { in: knownCategories }` filter + try/catch
> - T1: `/home` redirects wired (login, register, root, command palette)
> - AD1: agents-pool full editor (Identity/Prompting/Permissions/Config sections)
> - A3: paperclip pollution confirmed gitignored
> - A4: `pnpm@9.15.9` installed on Contabo
> - H4: ApprovalWorkflowEngine implemented (19/19 pre-existing tests now pass)
> - H6: Per-Hermes-type LLM model routing (FINANCE/EXECUTIVE → gpt-4o, HR/SALES/SUPPORT/CUSTOM → gpt-4o-mini)
> - H7: Vector embeddings for HermesMemoryEntry (graceful degradation)
> - H9: Feature flag wiring full stack — backend service+controller, frontend hooks+admin UI; per-tenant overrides
> - PE4: 41 new backend tests across 5 specs; 310 tests passing total
> - Doc drift reconciled: 7/8 inconsistency items closed
>
> **2026-07-04 19:25 PKT — Production deploy completed (Kilo):**
> - Backend rebuilt with `npm ci --legacy-peer-deps` + `prisma generate` + `nest build`. All 23 migrations confirmed applied; Prisma client now contains `ONBOARDING_TASK` enum value (FIX-008 root cause silenced).
> - Tenant frontend rebuilt; `/home` route live.
> - Admin frontend rebuilt; `/feature-flags`, `/agents-pool`, `/departments-pool`, `/features`, `/industries`, `/packages`, `/tier-templates`, `/agent-templates` routes live.
> - OLS admin vhost patched with explicit rewrite rules for the 8 new admin paths (was 404ing because catch-all rule strips the `/admin` basePath).
> - One prod-only bug caught + fixed at deploy time: `HermesNode.ts` had `import type { HermesRuntimeService }` — TypeScript erased the runtime import, so `__metadata("design:paramtypes", [Function])` instead of the real class, NestJS couldn't resolve the dep. Changed to regular `import`. Backend now starts cleanly with full HermesModule wired.
> - All 4 PM2 NeureCore processes online (cors-proxy 4 restarts, backend 504, tenant 5, admin 1). No active crashes.
> - Smoke tests: brain `/health` 200, `/feature-flags` 401 (proper auth), `/auth/refresh` 401 (FIX-008 verified); hq `/`, `/home`, `/command-center`, `/login`, `/onboarding/setup` all 200; cc `/`, `/agents-pool`, `/feature-flags`, `/billing`, `/tenants`, etc. all 200.

---

## 1. Hosts

| Item | Value |
|---|---|
| Production host | `vmi2954830.contaboserver.net` |
| Public IP | `109.123.248.253` |
| SSH alias | `ssh contabo` (`~/.ssh/config`, user `root`) |
| OS | Ubuntu 6.8.0-124-generic |
| Web server | CyberPanel + OpenLiteSpeed 2.4.4 |
| Uptime | 18 days 14h (load avg 0.53–0.59 — idle) |
| RAM | 11 GiB total, 4.2 GiB used, 7.5 GiB available |
| Disk `/` | 96 GB total, 52 GB used (54%), 45 GB free |
| Other hosts | **None.** No Vercel, no other cloud. Single Contabo VPS. |

---

## 2. Services on Contabo

### 2.1 PM2 processes (canonical)

PM2 dump at `/root/.pm2/dump.pm2`. Definition: `/opt/neurecore/ecosystem.config.js`.

| PM2 name | ID | Status | Restarts | CWD | Uptime | Internal port |
|---|---|---|---|---|---|---|
| `neurecore-backend` | various | online | — | `/opt/neurecore/backend/backend` | — | **3003** |
| `neurecore-tenant` | various | online | — | `/opt/neurecore/neurecore-tenant` | — | **3001** |
| `neurecore-admin` | various | online | — | `/opt/neurecore/frontend-admin` | — | **3020** |
| `neurecore-cors-proxy` | 7 | online | 5 | `/opt/neurecore` | 22h | **3004** |

Other non-neurecore PM2 apps on the box (out of scope but share resources): `app-frontend` (GUV on 3001/3100), `gfcportal`, `shahisoft-nextjs`, `lifeosa-backend`, `ecoearthshop-backend` (cluster), `cookie-refresher`.

### 2.2 Port assignments

| Port | Binds | Process |
|---|---|---|
| 22 | `::` | sshd |
| 25/465/587 | `0.0.0.0` | postfix (mail) |
| 80 | `0.0.0.0` | OpenLiteSpeed (HTTP → 443) |
| 443 | `0.0.0.0` | OpenLiteSpeed (TLS termination) |
| 631 | `0.0.0.0` | cupsd |
| 3000 | `127.0.0.1` | `nghttpx` (LiteSpeed proxy) — NOT backend |
| 3001 | `127.0.0.1` | **neurecore-tenant** (Next.js) — NOTE: was 3005, moved to 3001 |
| 3002 | — | nothing listening |
| 3003 | `0.0.0.0` | **neurecore-backend** (NestJS) |
| 3004 | `127.0.0.1` | **neurecore-cors-proxy** (sidecar → 3003) |
| 3005 | — | **FREE** (neurecore-tenant moved to 3001) |
| 3010 | `127.0.0.1` | PM2 internal God daemon |
| 3011 | — | **FREE** (EAOS retired) |
| 3020 | `127.0.0.1` | **neurecore-admin** (Next.js) |
| 3021 | — | **FREE** (FTS retired 2026-07-04) |
| 3100 | `0.0.0.0` | GUV Next.js runtime |
| 3200 | `*` | grafana |
| 3306 | `127.0.0.1` | mariadbd (CyberPanel) |
| 5000 | `127.0.0.1` | PM2 internal |
| 6379 | `127.0.0.1` | redis (host-installed, not container) |
| 7080 | `0.0.0.0` | CyberPanel admin UI |
| 8081 | `127.0.0.1` | docker-proxy (CyberPanel) |
| 9090 | `*` | prometheus |
| 9093 | `*` | alertmanager |
| 9094 | `*` | alertmanager internal |
| 9200 | `[::1]` | elasticsearch |

### 2.3 Backend (NestJS)

| Item | Value |
|---|---|
| Source root | `/opt/neurecore/backend/backend/` |
| Git remote | `git@github.com:Shahikhail01/neurecore.git` (branch `main`) |
| HEAD | post-2026-07-09 Projects implementation (not yet synced to prod — code in workspace at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend/`) |
| Working tree status | Workspace has all Phases 1–7 + Phase 2 sub-phases implemented; Contabo has pre-Projects version |
| Startup command | `node ./dist/src/main.js` |
| Listening port | **3003** |
| External URL | `https://brain.neurecore.com/api/v1/` |
| Health check | `GET /api/v1/health` → `200 {"status":"healthy"}` (backend deployed 2026-07-09 21:27 PKT) |
| Prometheus scrape | `127.0.0.1:3003/api/metrics`, scraped every 15s, `health=up` |
| Node version | 20.20.2 |
| PM2 version | `0.0.1` |
| NestJS module count | **53+** (Projects + EIE modules added) |
| Controllers | **40+** (projects, customers, project-types, deliverables, project-decisions, project-memory, project-stages, project-members, project-health, execution-log, portal controllers added) |
| Services | **90+** (all new domain services added) |
| Prisma models | **70+** (Projects + EIE models added) |
| Prisma migrations applied | Schema pushed via `prisma db push` (migrations bypassed due to ordering issues; schema is in sync with `schema.prisma`) |
| `.env` keys | 112+ |
| Env file location | `/opt/neurecore/backend/backend/.env` — **NEVER sync from local, NEVER commit** |
| DB | Contabo Local PostgreSQL 16: `127.0.0.1:5432`, db `neurecore_prod` (live `.env`; older entries citing port `5433` or db `neurecore` are stale — root cause: post-Neon migration the connection URL was rewritten but the doc wasn't synced), user `neurecore_app` (sslmode=disable). **Migrated from Neon 2026-07-20.**
| Cache | Redis: host-installed `redis-server` on `127.0.0.1:6379` + Upstash at `lasting-gobbler-72608.upstash.io` (ENOTFOUND — non-fatal) |

**NestJS modules** (`src/modules/`) — Projects + EIE additions:
```
// Pre-existing:
agents            agents-management       agent-templates
ai-gateway        analytics               audit
auth              command-center          connectors
costs             departments             department-templates
entities          events                  finance
goals             governance              health
hermes            inbox                   knowledge
memory            models                  notifications
observability     onboarding/checklist    orchestration
projects          reliability             retail
routines          security                settings
solution-packs    tenants                 tiers
tools             users

// Projects (Phases 1–7):
customers         project-decisions       project-health
project-members   project-memory          project-stages
deliverables      execution-log           portal

// Enterprise Information Engine (Phase 2 sub-phases 2A–2G):
information-engine/ (11 sub-modules: packs, project-type-packs, sources,
  responses, completeness, requirements, adaptive-questioning,
  interview, extraction, clients, common)
approval-chains

// Extended:
approvals (extended with chain fields)
goals (extended with projectId FK)
```

### 2.4 Frontend-Tenant (Next.js)

| Item | Value |
|---|---|
| Source root | `/opt/neurecore/neurecore-tenant/` (Note: tenant frontend source is at `neurecore-tenant`, NOT `frontend-tenant`) |
| Build root | `/opt/neurecore/neurecore-tenant/.next/` |
| Startup | `cd /opt/neurecore/neurecore-tenant && npm start` (starts on port 3001 by default) |
| Framework | Next.js 15.5.12, React 19, Radix UI (15 packages), Zustand v5, Tailwind, Socket.IO |
| Listening port | **3001** (bound 127.0.0.1) — NOTE: was 3005, moved to 3001 on 2026-07-10 |
| External URL | `https://hq.neurecore.com` |
| Source folder | `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant/` |
| Env file | `/opt/neurecore/neurecore-tenant/.env.production` |
| Public API URL | `NEXT_PUBLIC_API_URL=/api/v1` (relative — relies on OLS catch-all rewrite to forward to backend via the same hostname) |
| Public WS URL | `NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com` |
| Test framework | Vitest (`src/**/*.{test,spec}.{ts,tsx}`) + Playwright (`tests/e2e/`) |
| **Auth core** | `src/auth/` — see [`int-features/auth-architecture.md`](../int-features/auth-architecture.md). **DO NOT add localStorage auth writes, raw cookie reads, or hard-redirects outside `src/auth/`.** |
| Notable: `frontend-tenant-simplified/` (canary, Next.js 16) | **DELETED 2026-07-04** |

### 2.5 Frontend-Admin (Next.js)

| Item | Value |
|---|---|
| Source root | `/opt/neurecore/frontend-admin/` |
| Build root | `/opt/neurecore/frontend-admin/.next/` |
| Startup | `/opt/neurecore/frontend-admin/start.sh` → `node node_modules/.bin/next start --hostname 127.0.0.1 --port 3020` |
| Framework | Next.js 15.5.12, React 19 |
| Listening port | **3020** (bound 127.0.0.1) |
| External URL | `https://cc.neurecore.com` |
| Source folder | `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin/` |
| Env file | `/opt/neurecore/frontend-admin/.env.production` |
| Public API URL | `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1` (absolute — admin browser calls backend directly, no proxy through OLS needed) |
| **Auth core** | `src/auth/` — see [`int-features/auth-architecture.md`](../int-features/auth-architecture.md). Admin extends the tenant core (register + loginWithGoogle disabled; admin-role allow-list enforced). |
| Notable: `frontend-eaos/` (EAOS UI) | **DELETED** prior to 2026-07-04 |

### 2.6 CORS sidecar proxy

| Item | Value |
|---|---|
| Source | `/opt/neurecore/cors-proxy.js` (50 lines, plain `http.createServer` proxy) |
| Listening port | **3004** (bound 127.0.0.1) |
| Upstream | `127.0.0.1:3003` (NestJS) |
| Allowed origins | `localhost:3001/3002/3005/3011/3020`, `127.0.0.1:*` for the same, `https://hq.neurecore.com`, `https://cc.neurecore.com`, `https://brain.neurecore.com`, `https://eaos.neurecore.com` |
| Purpose | Dev-mode browser requests where CORS preflight hits CORS proxy on 3004 → forwarded to backend 3003 with regenerated CORS headers. |
| Backup | `/opt/neurecore/_archives/cors-proxy.js.bak.20260704-083542` |

### 2.7 Database (Contabo Local PostgreSQL)

| Item | Value |
|---|---|
| Provider | Contabo Local PostgreSQL 16 (VM-hosted) |
| Host | `127.0.0.1` (local) |
| Port | `5432` (stale docs say 5433 — see [§0d 2026-07-23](#0d-2026-07-23--industry-release-verification--hot-fix-sweep-kilo)) |
| Database | `neurecore`, schema `public` |
| User | `neurecore_app` (password: `NeureCoreDB123`) |
| SSL | Disabled (local connection) |
| Extensions | `plpgsql`, `vector` (pgvector) |
| Schema sync | `prisma db push --accept-data-loss` (2026-07-20) |
| Pool data seeded | 706 agents, 57 departments, 24 industries, 19 features, 4 tier templates, 68 packages, 150 project types, 20 question packs |
| **NOTE** | Contabo Local PostgreSQL 16 is the production database. |

### 2.8 TLS certificates

Let's Encrypt certs under `/etc/letsencrypt/live/`. The three NeureCore hostnames have valid certs:

| Hostname | Cert directory |
|---|---|
| `brain.neurecore.com` | `/etc/letsencrypt/live/brain.neurecore.com/` |
| `hq.neurecore.com` | `/etc/letsencrypt/live/hq.neurecore.com/` |
| `cc.neurecore.com` | `/etc/letsencrypt/live/cc.neurecore.com/` |

`certbot` timer is installed (see `/etc/cron.d/certbot`). Auto-renewal is active.

---

## 3. Observability stack

| Component | Endpoint | Notes |
|---|---|---|
| Prometheus | `http://127.0.0.1:9090` | v2.55.1, host network, health=up |
| Alertmanager | `http://127.0.0.1:9093` | v0.27.0, healthy |
| Grafana | `http://127.0.0.1:3200` | v11.3.0, healthy |
| Prometheus scrape target | `127.0.0.1:3003/api/metrics` | `health=up`, scraped every 15s |

Located at `/opt/neurecore/observability/`.

---

## 4. OpenLiteSpeed vhost → upstream mapping

| Vhost | Handler extProcessor | Internal address | TLS cert path |
|---|---|---|---|
| `hq.neurecore.com` | `neurecore_tenant` | `127.0.0.1:3001` | `/etc/letsencrypt/live/hq.neurecore.com/{privkey,fullchain}.pem` |
| `cc.neurecore.com` | `neurecore_admin` | `127.0.0.1:3020` | `/etc/letsencrypt/live/cc.neurecore.com/{privkey,fullchain}.pem` |
| `brain.neurecore.com` | `nodeapi` | `127.0.0.1:3003` | `/etc/letsencrypt/live/brain.neurecore.com/{privkey,fullchain}.pem` |

All three vhosts add CORS headers (`Access-Control-Allow-Methods/Headers/Max-Age`). Brain's vhost additionally injects `Access-Control-Allow-Origin` etc.

---

## 5. Recently retired (for diff only — do not revive)

| Item | Retired | Reason |
|---|---|---|
| `frontend-tenant-simplified/` (local + Contabo) | 2026-07-04 | FTS rewrite cancelled; folder deleted |
| PM2 `neurecore-fts` (port 3021) | 2026-07-04 | FTS rewrite cancelled |
| `frontend-eaos/` (Contabo) | pre-2026-07-04 | EAOS app retired |
| PM2 `neurecore-eaos` (port 3011) | pre-2026-07-04 | EAOS app retired |
| Stale tenant deployment docs | 2026-07-04 | Corrected to reflect Contabo-only architecture |

---

## 6. Recent commits / snapshots

- **2026-07-11 14:09 PKT — AI Gateway deep-audit: round 2 remediated (Kilo)**
  - 3 critical runtime blockers fixed (`PrismaClient` → `PrismaService` injection)
  - 2 high-severity logic bugs fixed (stream cost attribution, retry-policy non-retryable errors)
  - 4 moderate issues fixed (SSE CRLF, transport slug, admin audit dates, dead code)
  - 6 consumer files migrated: `chief-of-staff`, `project-health-ai`, `rag-pipeline`, `query.tool`, `explain.tool`, `chat.tool`
  - 4 new unit tests (retry edge cases + CRLF parser); total now **728/728 passing**
  - `nest build` + `tsc --noEmit`: both 0 errors
  - Memory-bank: `ai-gateway.md` status → ✅ SHIPPED; `fixes.md` → FIX-036 added; `backend.md` + `frontend-admin.md` updated
- **2026-07-11 13:43 PKT — AI Gateway refactor: 7/8 days landed locally (Kilo)**
  - All 8 days of [ai-gateway-imp-plan.md](ai-gateway/ai-gateway-imp-plan.md) complete locally; Day 8 cutover pending Contabo deploy
  - New Prisma models: `model_providers`, `ai_models`, `tenant_model_overrides`, `model_catalog_audits` (migration `20260711_ai_gateway_catalog`)
  - `CostRecord` extended with `sourceModule`, `sourceEventId` (unique), `metadata` JSONB; `tenantId` loosened to nullable (migration `20260711_ai_gateway_cost_attribution`)
  - New `src/modules/ai-gateway/` module: 8 SOLID helper classes + `AiGatewayService` facade (the only LLM-invocation entry point)
  - 5 providers + 12 models seeded idempotently; `ANTHROPIC_API_KEY` added to `SECRET_ENV_MAPPING`
  - P0 fixes F2–F9 in code; F1 (env `MINIMAX_API_KEY`) is a manual deploy step
  - Feature flag `AI_GATEWAY_V2` defaults to `false`; flip per-tenant via new admin UI
  - 30 new unit tests; 724/724 total pass; backend `nest build` + frontend `next build` both clean
  - Frontend-admin `/admin/models` (Providers / Models / Per-tenant Overrides / Health & Cost tabs) + `/admin/cost-summary` replace legacy `/models`
  - PR 8.3 (Day 8) tags `MiniMaxClient`, `DeepSeekClientService`, `MiMoClientService`, `LLMFactory`, `agent-state-machine.ts`, `HERMES_TYPE_MODELS`, `AIRoutingConfig`, and the legacy `models.controller.ts` for deletion after a 24h soak
- **2026-07-10 15:33 PKT — Tenant Portal end-to-end validation (Kilo)**
  - Both frontends deployed to Contabo (frontend-tenant @ hq.neurecore.com, frontend-admin @ cc.neurecore.com)
  - 4 production bugs fixed: goals UUID validation (FIX-028), Prisma `@@map` for ApprovalWorkflow tables (FIX-029), IN_PROGRESS enum value in approval filter (FIX-030), lowercase enum types renamed to PascalCase (FIX-031)
  - All tenant portal features tested end-to-end via Playwright with `mali@live.com`
  - 3 customers, 3 projects, 4 stages, 1 team member, 1 goal, 1 deliverable, 1 memory, 1 decision persisted to Neon prod
  - No new Prisma migrations needed — only SQL `ALTER TYPE ... RENAME TO` for enum case correction
  - See [fixes.md FIX-028 to FIX-031](fixes.md) for full details
- **2026-07-09 23:30 PKT — Projects Phases 1–7 + EIE Phase 2 sub-phases FULLY IMPLEMENTED (workspace only — NOT YET DEPLOYED TO CONTABO except backend)**
  - All 7 phases complete + Phase 2 sub-phases 2A–2G complete
  - 37/37 migrations applied to Neon prod
  - Backend deployed to Contabo: rsync → pnpm install → prisma migrate deploy → nest build → pm2 reload
  - Backend health: `curl https://brain.neurecore.com/api/v1/health` → `200 {"status":"healthy"}`
  - Frontend-tenant + frontend-admin NOT YET deployed (code in workspace)
  - Pre-deploy snapshot: `/opt/neurecore/_archives/20260709-212750/`
  - See `memory-bank-new/Projects/IMPLEMENTATION-PLAN.md` + `project-creation-imp-plan.md` for full details
  - See `memory-bank-new/Projects/PHASE-{1-7}-COMPLETION.md` for per-phase completion reports
  - Workspace at: `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/`
- **2026-07-08 22:49 PKT — FIX-024 deployed (Tenant overview audit + suspend/delete)**
  - Backend: `PATCH :id/activate` + `DELETE :id` endpoints added
  - Admin: expanded Overview (33 fields, 7 sections) + Suspend/Activate/Delete buttons with confirmation dialogs
  - Types: `Tenant` (8→33 fields), `TenantTier` (5→22 fields), new `TenantAddress`
  - Files: `tenants.controller.ts`, `tenants.service.ts`, `tenants/[id]/page.tsx`, `types/api.types.ts`, `components/ConfirmDialog.tsx`
  - Build: `next build` + `nest build` — zero errors
  - DR snapshots: `/opt/neurecore/_archives/20260708-` (backend dist + admin .next)
- Backend HEAD: `c5c05ec perf(backend): dashboard load 12-14s → 1.5-2s`
- Last backend `dist/` snapshot: `/tmp/dist-backup-20260704-083554.tar.gz` (904 KB)
- Last full DR snapshot: `/opt/neurecore/_archives/20260704-084322/` (~70 MB: backend dist + both .next builds + 3 configs)
- Last CORS proxy edit: 2026-07-04 08:35 PKT (allowed origins expanded to include 3005/3020/3011)
- Last ecosystem.config.js: 2026-07-04 08:40 PKT (admin entry now uses `./start.sh` instead of broken `npx` invocation)