# Run-6 Code & Deployment Change Log

**Date:** 2026-07-25 12:22–12:55 CEST

## Source code changes

### Backend (`backend/src/modules/`)

1. **`industry/tier-industry-matrix.ts:44`**
   - Before: `'financial-compliance': ['accounting-audit-services', 'financial-services'],`
   - After: `'financial-compliance': ['accounting-audit-services', 'financial-services', 'insurance'],`
   - Fix: D18 — `insurance` industry missing from the canonical static map; consumers of `INDUSTRY_GROUP_INDUSTRIES['financial-compliance']` were returning only 2 entries.

2. **`department-templates/department-templates.service.ts:13-22`**
   - Before: hardcoded stale map with wrong slugs (`manufacturing`, `construction`, `energy-utilities`, `transportation-logistics`, `retail-ecommerce`, `hospitality-food-service`, `agriculture-food-production`, `special-purpose-vehicles`) and missing `insurance`.
   - After: aligned with canonical 16 industries per `INDUSTRY-GROUPS-CONCEPT.md` §3.
   - Fix: same D18 — `findAll({ industryGroup })` filter was returning wrong results for the other 7 groups.

### Frontend Tenant (`frontend-tenant/src/`)

3. **`lib/industryGroups.ts:73`**
   - Before: `'financial-compliance': ['accounting-audit-services', 'financial-services'],`
   - After: `'financial-compliance': ['accounting-audit-services', 'financial-services', 'insurance'],`
   - Fix: D18 — same as backend.

4. **`app/customers/page.tsx`**
   - Before: `<h1 className="text-2xl font-bold text-zinc-100">Customers</h1>` (hardcoded)
   - After: `<h1>{tenantGroup ? (getIndustryNavConfig(tenantGroup as any)?.customersLabel ?? 'Customers') : 'Customers'}</h1>` (industry-aware)
   - Import added: `import { getIndustryNavConfig } from '@/lib/industryNavigation';`
   - Fix: D24 — healthcare tenant showed "Customers" instead of "Patients".

5. **`components/onboarding/PlanImpactPanel.tsx:165`**
   - Before: `<div>Default agents for your industry</div>`
   - After: `<div>Default agents for your industry ({maxAgentAgents} in pool · {formatLimit(c.maxAgents)} tier cap)</div>`
   - Fix: D19 — disambiguate industry pool size vs tier cap.

### Frontend Admin (`frontend-admin/src/`)

6. **`lib/industries.ts:18-34, 47, 69`**
   - Before: 16 industries (missing `insurance`); label map missing `insurance`; group map missing `insurance`.
   - After: 17 industries including `insurance`; label `"Insurance"`; group `'financial-compliance'`.
   - Fix: D18 — admin tenant creation form would not offer `insurance` as an industry choice.

## New seeders

7. **`backend/prisma/seed-healthcare-department-template.cjs`** (NEW)
   - 220 lines. Idempotent upsert of `healthcare-clinic` DepartmentTemplate with 8-dept structure (Clinical Operations Coordinator, Nurse Practitioner, Medical Records Clerk, Pharmacy Manager, Lab Technician, Patient Advocate, Billing Specialist Healthcare, Practice Manager).
   - Fix: D21 — healthcare tenants had 0 departments and no template option.

8. **`backend/prisma/seed-healthcare-agent-templates.cjs`** (NEW)
   - 195 lines. Idempotent: upserts 8 AgentTemplate rows by name (natural key — AgentTemplate has no slug column), then populates `tier_pro` TierAgentPool with the 8 new templates at slots 1-8, and backfills the 8 existing healthcare tenants with one agent per department (round-robin).
   - Fix: D29 — Professional tier had 0 TierAgentPool rows; healthcare tenants couldn't get agents provisioned at onboarding.

## Database changes (run on Contabo)

9. **`accounting` department template description**
   - Before: `"Department template for Accounting with 12 AI Employees."`
   - After: `"Department template for Accounting with 10 AI Employees. Includes AP/AR, Audit Coordinator, Budget, Cost, Financial Reporting, Fixed Assets, GL, Payroll, Tax Compliance roles."`
   - Run: `node -e "..."` against production DB.
   - Fix: D20 — description string was stale after the Run-5 D12 fix trimmed the structure from 12 → 10.

10. **`healthcare-clinic` DepartmentTemplate CREATED**
    - Run: `node prisma/seed-healthcare-department-template.cjs`
    - Result: `CREATED healthcare-clinic (id=33d36960-fff7-4f54-a864-649d9735f50a)`
    - Fix: D21.

11. **8 healthcare AgentTemplates CREATED + 8 TierAgentPool rows + 8 backfilled Agents**
    - Run: `node prisma/seed-healthcare-agent-templates.cjs`
    - Result: 8 UPDATE, 8 CREATE TierAgentPool, 8 BACKFILL Agent
    - Fix: D29.

## Deployments

| Time (CEST) | Service | Action | PM2 | Health |
|---|---|---|---|---|
| 12:22:42 | backend | sync + nest build + prisma migrate deploy + pm2 reload | online 6 | healthy |
| 12:32:46 | frontend-tenant | sync + next build + pm2 reload | online 4 (then restarted) | chunk hash 5e17... (new build) |
| 12:38:xx | frontend-tenant | pm2 delete + pm2 start (manual restart per FIX-INDUSTRY-VERIFY-4 deploy-path workaround) | online 7 | serving from `/opt/neurecore/frontend-tenant/.next/` |
| 12:42:35 | frontend-admin | sync + next build + pm2 reload | online 5 | healthy |
| 12:35-12:55 | (DB) | ran 2 new seeders + 1 inline description update | n/a | data persisted |

## Post-deploy smoke tests

- `curl -sk https://brain.neurecore.com/api/v1/industries/groups | jq '.data[] | select(.slug=="financial-compliance") | .industrySlugs'` → `["accounting-audit-services","financial-services","insurance"]` ✓
- `curl -sk 'https://brain.neurecore.com/api/v1/department-templates?industryGroup=healthcare' | jq '.data.total'` → `1` ✓
- `curl -s https://hq.neurecore.com/customers | grep -oE 'page-[a-f0-9]+\.js'` → `page-7c78b16b54085b44.js` (new build) ✓
- PM2 processes: 4/4 online, no restarts in 10+ minutes ✓
