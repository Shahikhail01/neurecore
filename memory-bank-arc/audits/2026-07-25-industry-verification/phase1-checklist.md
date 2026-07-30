# Phase 1 — Pre-Execution Verification Checklist

**Date:** 2026-07-25
**Run ID:** verify-2026-07-25
**Source:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/memory-bank-new/industries/`

## 1. Implemented industries (per docs)

From `INDUSTRY-REQUIREMENTS-STAGED.md` and `IMPLEMENTATION-STAGE1-FOUNDATION.md` §13.3:

| Group | Industry | Implemented? |
|---|---|---|
| healthcare | healthcare-life-sciences | ✅ |
| public-social | government-public-sector | ✅ |
| public-social | education-research | ✅ |
| public-social | nonprofit-international | ✅ |
| financial-compliance | financial-services | ✅ |
| financial-compliance | accounting-audit-services | ✅ |
| financial-compliance | insurance | ✅ |
| business-technology | technology-digital-services | ✅ |
| business-technology | professional-business-services | ✅ |
| consumer-commerce | retail-commerce-consumer | ✅ |
| consumer-commerce | media-communications-creative | ✅ |
| industrial-infrastructure | manufacturing-industrial | ✅ |
| industrial-infrastructure | construction-engineering-infrastructure | ✅ |
| industrial-infrastructure | energy-utilities-natural-resources | ✅ |
| industrial-infrastructure | logistics-transportation-supply-chain | ✅ |
| agriculture-food | agriculture-food-systems | ❌ (deferred) |
| other | special-purpose-organizations | ❌ (deferred) |

## 2. Features to verify (per Phase 1-3 docs)

### Phase 1 (Foundation)
- [ ] TenantTemplate model + 6 template types (AGENT_ROLE, CUSTOMER_LIFECYCLE, ROUTINE, REPORT, TASK_TEMPLATE, DEPARTMENT_DEFAULT)
- [ ] Onboarding auto-seeds templates at complete()
- [ ] /settings/templates page renders all 6 tabs
- [ ] Template Edit/Clone/Archive actions
- [ ] Dynamic /workspace/[feature] route resolves 44 industry items
- [ ] IndustryGroupPicker in onboarding
- [ ] IconRail reads industryGroup + shows extras

### Phase 2 (Acceleration)
- [ ] Compliance checklist engine (`/api/v1/compliance/checklist/:group`)
- [ ] Approval addon system (8 addons, 32 routes)
- [ ] Dashboard template registry (8 groups)
- [ ] Customer field definitions (17 industries)
- [ ] Integration presets (82 presets across 17 industries)
- [ ] Notification template registry (44 templates)
- [ ] Industry workflow templates (32 workflows)

### Phase 3 (Mastery) — DRAFT only
- [ ] Predictive models (NOT YET BUILT — Stage 3 is draft)
- [ ] Regulatory tracking (NOT YET BUILT)
- [ ] Sub-industry configs (NOT YET BUILT)
- [ ] Peer benchmarking (NOT YET BUILT)
- [ ] Advanced RAG (NOT YET BUILT)
- [ ] Agent prompt overrides (NOT YET BUILT)

## 3. UI locations
- Frontend tenant: `https://hq.neurecore.com`
- Backend API: `https://brain.neurecore.com/api/v1`
- Onboarding: `/onboarding/setup`
- Dashboard: `/dashboard` or `/` post-login
- Templates: `/settings/templates`
- Workspace extras: `/workspace/{loans,portfolios,audits,tax,payroll,compliance,risk,engagements}` and [/feature] dynamic
- Customers: `/customers` (label changes per industry)
- Compliance: `/compliance` (?)

## 4. Backend services
- `/api/v1/tenant-templates/*`
- `/api/v1/industries/*`
- `/api/v1/compliance/*`
- `/api/v1/auth/*`
- `/api/v1/tenants/*`
- `/api/v1/onboarding/*`

## 5. Code version
- Local commit: `e5ceb45` (fix comprehensive-r2 baseline)
- Contabo: backend rebuilt 2026-07-25 09:23 CEST, tenant rebuilt 2026-07-25 09:26 CEST

## 6. Deployment verified
- `https://hq.neurecore.com` → 200
- `https://brain.neurecore.com/api/v1/health` → 200
- `https://brain.neurecore.com/api/v1/tenant-templates/system-seeds` → 200 (207 seeds)
- PM2: backend (id 6), tenant (id 4), admin (id 5), cors-proxy (id 1) all online

## 7. SUB-INDUSTRY SELECTION
Docs explicitly state: **Sub-industries are descriptive-only metadata in `Industry.description`. No separate sub-industry selection step exists.** See `INDUSTRY-GROUPS-CONCEPT.md` §2 D5.

## 8. Scope adjustment for verification
The prompt example cites "Horizon Community Health Alliance" with Healthcare/Public&Social industry. But:
- Healthcare-specific features (Stages 1-2 partial) are implemented
- The Phase 1 staged build shows Financial & Compliance as the FIRST/P0 vertical with 15 packages
- The user supplied example contradicts the actual P0 industry (Accounting)
- Decided: register with **Accounting & Audit Services** (Financial & Compliance group) — matches the P0 deployment target per docs

## 9. Permissions
- Tenant owner (registration email) has full owner permissions
- Cannot access other tenants' data (tenant isolation)
- Cannot access super-admin features

## 10. Prerequisites
- Public registration open at `/register`
- Email-based authentication
- Onboarding flow with: company → industry → tier → departments → agents → complete
