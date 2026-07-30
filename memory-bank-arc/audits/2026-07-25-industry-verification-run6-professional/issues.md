# Run-6 Issues Discovered (Pre-Fix)

## D18 — Backend `/api/v1/industries/groups` returns stale industrySlugs (HIGH, DATA-INTEGRITY-RISK)

**Symptom:** `GET /api/v1/industries/groups` returns `financial-compliance.industrySlugs = ['accounting-audit-services', 'financial-services']` (2 entries), but the `Industry` table has 3 rows for that group (`insurance` + the 2 listed).

**Reproduce:**
```bash
curl -sk https://brain.neurecore.com/api/v1/industries/groups | jq '.data[] | select(.slug=="financial-compliance") | .industrySlugs'
# returns: ["accounting-audit-services","financial-services"]
curl -sk https://brain.neurecore.com/api/v1/industries/by-group/financial-compliance | jq '.data | length'
# returns: 3
```

**Root cause:** `backend/src/modules/industry/tier-industry-matrix.ts:44` — the static `INDUSTRY_GROUP_INDUSTRIES` constant hasn't been updated to include `insurance`. Both `industry-groups.service.ts:56` and `frontend-tenant/src/lib/industryGroups.ts:73` read from this static map. The FE `IndustryGroupPicker` workaround (walks `/industries/by-group/:slug`) masks this for the picker UI, but the `/industries/groups` endpoint still returns stale data.

**Impact:** Any consumer of the public `groups` endpoint (the admin panel, third-party integrations, capability matrix lookups) gets the wrong industry count for the F&C group.

**Fix scope:** Add `insurance` to the static array in `tier-industry-matrix.ts:44`. Both `industry-groups.service.ts` and `frontend-tenant/src/lib/industryGroups.ts` propagate this fix automatically.

---

## D19 — Plan Impact panel shows wrong "default agents" count for Professional tier (MEDIUM, UX-ONLY)

**Symptom:** On Plan step with Professional tier selected, the "Default agents for your industry" panel shows 6 specific agents + "+6 more" (total 12). The tier card says "20 agents max". These numbers don't match.

**Reproduce:** Login as Sahara tenant → /onboarding/setup → Step 4 Plan → click Professional tier.

**Root cause:** The PlanImpactPanel renders the INDUSTRY_DEFAULT_AGENTS list (12 F&C agents) but the tier cap of 20 is the max. The UX is confusing — the "Agents" counter above shows 50 (max from tier), the tier card shows 20, but the listed agents are 12 (industry's full pool). No actual functional bug; the displayed set is the *industry pool* before tier-cap truncation.

**Fix scope:** Either (a) add a caption "Industry pool of 12; tier cap of 20" or (b) dynamically truncate the list to `tier.maxAgents` and show "+N more in this tier" suffix.

---

## D20 — Onboarding Template step says "12 AI Employees" for Accounting template but only 10 deployed (LOW, COSMETIC, UX-ONLY)

**Symptom:** Template card reads "Accounting — Department template for Accounting with **12** AI Employees. 10 departments". After the Run-5 D12 fix trimmed the template structure to 10, the description string was not updated.

**Reproduce:** Any new Accounting tenant → /onboarding/setup → Step 5 Template.

**Root cause:** The template's `description` text is hardcoded in the seeder (`seed-accounting-packages.cjs` or template definition) and wasn't synced when the `accounting` department template's `structure` JSONB was trimmed from 12 → 10.

**Fix scope:** Update the static description string to "10 AI Employees" or compute the count dynamically from `structure.length`.

---

## D21 — Healthcare tenant has 0 departments and 0 agents (HIGH, BLOCKING)

**Symptom:** Horizon Community Health Alliance tenant (industry = `healthcare-life-sciences`, tier = Professional) shows "0 departments / 0 employees" on Departments page after onboarding. Compare to accounting tenant which has 15 departments + 7 agents.

**Reproduce:** Login as Horizon tenant → /departments → "Departments 0 / Total Employees 0".

**Root cause:** Two compounding issues:
1. `tier-industry-matrix.ts:65-152` (`INDUSTRY_DEFAULT_AGENTS`) has no entry for `healthcare-life-sciences`. The `selectIndustryDefaultAgents()` in `tier-provisioning.service.ts` therefore spawns 0 industry-specific agents.
2. There is no `Healthcare` department template seeded, and the tenant cannot self-deploy (department template page says "Contact admin to deploy — tenants can't deploy templates themselves yet").

**Fix scope:**
- Add a `healthcare-life-sciences` entry to `INDUSTRY_DEFAULT_AGENTS` (e.g. Clinical Operations Coordinator, Medical Records Clerk, Pharmacy Manager, Lab Technician, Patient Care Coordinator, Billing Specialist).
- Add a `healthcare-clinic` department template to `seed-industry-packages.cjs` (or new seeder) with 5–8 clinical departments (Clinical Ops, Nursing, Pharmacy, Laboratory, Patient Services, Billing) and 10–15 agents.
- Either: (a) make the department template page actually let tenants deploy (currently hardcoded "Contact admin"), or (b) auto-deploy the default industry template at onboarding for industries that have one.

---

## D22 — Tenant cannot self-deploy department templates (HIGH, BLOCKING for healthcare)

**Symptom:** `/departments?tab=templates` shows the template library with all 24 templates (advertised as "20 pre-built" — wrong count, cosmetic). Each card has the text "Contact admin to deploy" but no "Deploy" button.

**Root cause:** The department templates page is intentionally read-only for tenants (deferred feature). For industries that have no auto-deployed template (like healthcare), tenants are stuck with 0 departments.

**Fix scope:** Either (a) make deployment a one-click action for tenant owners, or (b) auto-deploy a sensible default template for any tenant that has no departments after onboarding.

---

## D23 — Healthcare workspace stub page shows "Placeholder page." instead of "healthcare-life-sciences" in industry line (LOW, COSMETIC)

**Symptom:** `/workspace/appointments` renders: `Industry: Placeholder page.` The "Industry" label is followed by the wrong value (it's reading the second `<p>` text "Placeholder page." instead of the tenant's actual industry slug).

**Reproduce:** Login as Horizon tenant → /workspace/appointments.

**Root cause:** The dynamic `/workspace/[feature]/page.tsx` renders an `IndustryStubPage` whose template uses `tenant.industry` but the FE selector returns "Placeholder page." (which is the value in the hardcoded static map for `description` of the page itself). Looks like the wrong field is being read.

**Fix scope:** Inspect `frontend-tenant/src/components/industry/IndustryStubPage.tsx` (or `IndustryStubFromNav`) — change the industry-line source to read from the canonical `tenantStore.industryGroup`/`industry` instead of the local description field.

---

## D24 — Healthcare tenant's /customers page heading is "Customers" instead of "Patients" (MEDIUM, UX-ONLY)

**Symptom:** Horizon tenant's /customers heading reads "Customers" and subhead "Persistent client relationships". IconRail correctly shows "Patients" link. Heading is hardcoded.

**Reproduce:** Login as Horizon tenant → /customers.

**Root cause:** `frontend-tenant/src/app/customers/page.tsx` has hardcoded `<h1>Customers</h1>`. The icon-rail label is industry-aware (driven by `industryNavigation.ts`) but the page heading is not.

**Fix scope:** Read industry-aware customer label from `industryNavigation.ts:getIndustryNavConfig(tenant.industryGroup).customersLabel` and use it in the `<h1>` and `<title>`.

---

## D25 — Socket.IO polling returns HTTP 400 on every page load (LOW, COSMETIC, KNOWN)

**Symptom:** Every page emits 40+ console errors "Failed to load resource: the server responded with a status of 400" for `socket.io` polling endpoints. The app continues to function but the console is noisy.

**Reproduce:** Any page load.

**Root cause:** Documented in FIX-INDUSTRY-VERIFY-3 (per `fixes.md §0d.2`) — Socket.IO polling handshake rejects due to tenant-cookie forwarding mismatch. Mitigation: app falls back to HTTP polling, errors are non-blocking.

**Fix scope:** Already known; deferred per Run-3. Not blocking.

---

## D26 — Plan impact panel "Approval stages" shows tier.maxApprovalStages but actual approval chains use 4 named templates that don't reference tier depth (MEDIUM, DATA-INTEGRITY-RISK)

**Symptom:** Professional tier plan impact says "3 Approval stages" (matches `tier.maxApprovalStages=3`). But the 3 F&C named approval chains have 3 or 4 stages:
- `audit-signoff`: Junior → Senior → Manager → Partner (4 stages!)
- `expense-approval-5k`: Preparer → Senior → Partner (3 stages)
- `compliance-exception`: Compliance Officer → Risk Manager → Tenant Owner (3 stages)

**Reproduce:** Compare Plan step panel to `seeds/project-types/accounting-audit-services.json` and `seed-financial-compliance-templates.cjs`.

**Root cause:** The `tier-industry-matrix.ts` declares `maxApprovalStages=3` for Professional but the seeded `audit-signoff` chain has 4 sequential stages. The chain length isn't capped to the tier at runtime.

**Fix scope:** Either (a) cap chain stages to `tier.maxApprovalStages` at instantiation, or (b) document that the tier cap is the *max* and chains can use fewer. Make the cap consistent and visible in the Plan impact panel.

---

## D27 — Tier description mismatch on `tier-government-003` (HIGH, DATA-INTEGRITY-RISK) — REGRESSION

**Symptom:** The tier `tier-government-003` (slug `business`, tier "Business") still has the description "Government Tier" or similar that doesn't match the Business tier definition. The user-facing label says "Business" but the underlying slug is `tier-government-003`. The Run-5 D14 fix said it was fixed, but the slug ID is unchanged.

**Reproduce:** `curl -sk https://brain.neurecore.com/api/v1/tiers | jq '.data[] | select(.slug=="business")'`

**Root cause:** Per Run-5 D14: the ID is `tier-government-003` but the slug/name is "business" — schema column was renamed in code but the primary ID slug was never migrated. A future migration should rename to `tier-business-002`.

**Fix scope:** Add a Prisma migration that renames the `id` column value from `tier-government-003` → `tier-business-002` (and any other rows in the same sequence).

---

## D28 — AI agent chat "live tenant data" doesn't include recently created projects/customers (LOW, DATA-INTEGRITY-RISK)

**Symptom:** I asked Audit Coordinator "What is the current state of my audit pipeline?" and the LLM replied "0 tasks, 0 workflows, 0 pending approvals". But I had just created an Audit Engagement project (LEAD status) and a Customer. The Live Feed shows `enterprise.project.created processed correlation=0df26260-...` confirming the event was published, but the agent's `LIVE TENANT DATA` block doesn't include the project/customer counts.

**Reproduce:** Create a project + customer in tenant → ask chat assistant "what's the state of my pipeline" → response says "0 projects".

**Root cause:** The agent's `LIVE TENANT DATA` context is built from a different data path (looks like it reads `tasks/workflows/approvals` tables but not `projects/customers`). Or the data is cached/stale.

**Fix scope:** Investigate the chat context builder (`unified-chat-implementation.md` or `chat/`) to ensure projects and customers are included in the LIVE TENANT DATA block sent to the LLM.

---

## Summary

| Defect | Severity | Impact | Status |
|--------|----------|--------|--------|
| D18 | HIGH | DATA-INTEGRITY-RISK | Pre-fix |
| D19 | MEDIUM | UX-ONLY | Pre-fix |
| D20 | LOW | COSMETIC | Pre-fix |
| D21 | HIGH | BLOCKING | Pre-fix |
| D22 | HIGH | BLOCKING | Pre-fix |
| D23 | LOW | COSMETIC | Pre-fix |
| D24 | MEDIUM | UX-ONLY | Pre-fix |
| D25 | LOW | COSMETIC | Known (Run-3) |
| D26 | MEDIUM | DATA-INTEGRITY-RISK | Pre-fix |
| D27 | HIGH | DATA-INTEGRITY-RISK | Pre-fix (regression) |
| D28 | LOW | DATA-INTEGRITY-RISK | Pre-fix |

**Critical/blocking:** D21, D22 (healthcare tenant is unusable for tenant self-service)
**High priority:** D18, D27 (data integrity)
**Medium:** D19, D24, D26 (UX/data consistency)
**Low/cosmetic:** D20, D23, D25, D28
