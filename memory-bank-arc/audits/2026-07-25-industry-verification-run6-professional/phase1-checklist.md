# Run-6 Pre-Execution Checklist (2026-07-25)

## Identified Industry Features (from docs)

### Financial & Compliance Group (`accounting-audit-services`)
- 8 extra Workspace items: Engagements, Loans, Portfolios, Audits, Tax, Payroll, Compliance, Risk
- Customers label → "Clients & Accounts", icon: Landmark
- KYC/AML fields on Customer (kycStatus, riskRating, taxId, financialSubType, lifecycleStage)
- 5 F&C project types: Audit Engagement, Tax Filing, Compliance Review, Bookkeeping Cycle, Payroll Cycle
- 3 named approval chain templates: audit-signoff, expense-approval-5k, compliance-exception
- 4 F&C dashboard widgets: AUDIT_COMPLETION_RATE, KYC_VERIFICATION_RATE, HIGH_RISK_CUSTOMER_EXPOSURE, TAX_FILING_CALENDAR
- 7 RAG knowledge entries (KYC/CIP, AML/SAR, BSA, OFAC, CPA CPE, PCAOB, US tax deadlines)
- Default F&C departments: Audit, Tax, Bookkeeping, Advisory, Administration
- Default agents per tier (Professional = 50 agents cap, 15-20 industry specialists available)

### Healthcare Group (`healthcare-life-sciences`)
- 4 extra Workspace items: Appointments, Medical Records, Pharmacy, Laboratory
- Customers label → "Patients", icon: Stethoscope
- Currently no full features (Stage 1 not implemented) - workspace stubs only

### Public & Social (`nonprofit-international`) - for Healthcare NGO
- 5 extra Workspace items: Programs, Grants, Field Operations, Cases, Licenses
- Customers label → "Citizens & Beneficiaries", icon: Users
- Workspace stubs only

## Pre-Execution Discovery: D13 Regression
- **Issue:** `GET /api/v1/industries/groups` returns `financial-compliance` with only 2 industrySlugs (`accounting-audit-services`, `financial-services`)
- **Reality:** Industry table has 3 industries in financial-compliance: `insurance`, `accounting-audit-services`, `financial-services`
- **Impact:** Industry picker UI shows 2 industries instead of 3 (matches the prior Run-5 D13 fix description but the fix appears not to have been deployed correctly, or the fix did not cover this endpoint)
- **Status:** **NEW DEFECT** logged as D18

## Verification Approach
1. Register Accounting tenant "Sahara Audit & Advisory" with Professional tier
2. Verify all F&C features (KYC, project types, approval chains, dashboard widgets, RAG)
3. Register Healthcare NGO "Horizon Community Health Alliance" with nonprofit-international
4. Verify NGO/Healthcare stub pages, departments, navigation differences
5. Capture all defects with screenshots + network evidence
6. Fix issues in Phase 9
7. Re-verify with fresh tenants in Phase 10

## Tenants to Register

### Tenant 1 — Accounting (Professional tier)
- Organization: Sahara Audit & Advisory
- Email: omar.siddiqui.sahara+20260725@neurecore-test.com
- Industry: Accounting & Audit Services
- Tier: Professional
- Country: Pakistan
- Type: Accounting & Audit Firm

### Tenant 2 — Healthcare NGO (Professional tier)
- Organization: Horizon Community Health Alliance (per prompt example)
- Email: ayesha.khan.horizon+20260725@neurecore-test.com
- Industry: Healthcare & Life Sciences (per prompt)
- Tier: Professional
- Country: Pakistan
- Type: Non-profit healthcare NGO
- Note: prompt says "Healthcare NGO Industries" — using healthcare-life-sciences industry as the most direct fit. The NGO aspect is fulfilled by organization type but industry is healthcare.