# Tenant: mali@live.com

**Last Updated:** 2026-07-08 (evening)
**Investigated by:** API + Browser verification (hq.neurecore.com)

---

## 1. Tenant Overview

| Field | Value |
|-------|-------|
| **Tenant ID** | `726522f0-a9e4-4c13-b22f-a9a967b914dc` |
| **Name** | mali — ACCOUNTING |
| **Slug** | mali-live-com-accounting |
| **Status** | ACTIVE |
| **Industry** | ACCOUNTING |
| **Tier** | Enterprise (`tier_enterprise`) |
| **Plan** | Enterprise — $499/month, $4990/year |
| **Onboarding** | Completed 2026-07-03 |
| **Locale** | en-US |
| **Timezone** | UTC |
| **Currency** | USD |
| **Retention** | 90 days |

### Feature Flags
- HERMES_ENABLED: true
- HERMES_AUTO_LINK: true
- COMM_DIGEST_ENABLED: true
- COMM_THREADS_ENABLED: true
- COMM_FOLLOWUP_ENABLED: true
- COMM_MENTIONS_ENABLED: true
- COMM_PRESENCE_ENABLED: true
- AGENT_MESSAGING_ENABLED: true
- COMM_ACTIVITIES_ENABLED: true
- COMM_ESCALATION_ENABLED: true
- COMM_CONVERSATION_INTELLIGENCE_ENABLED: true

---

## 2. Departments

| Department ID | Name | Status | Parent | Notes |
|---------------|------|--------|--------|-------|
| `adcefd23-a24e-4145-ac72-1b2c1abfb35b` | Customer Success | ACTIVE | — | |
| `019bfd6c-5e7d-48ac-8c3f-40f662a43f2d` | Finance | ACTIVE | — | Primary department for Accounting package |
| `84d28896-7972-42b5-acdd-ec50ec590db5` | Human Resources | ACTIVE | — | |
| `2663c114-6d4d-470c-8205-604b9f1b72bb` | Legal | ACTIVE | — | |
| `e64de940-0292-446f-beac-55a7f47ffaab` | Specialized | ACTIVE | — | |
| `6122f834-ed02-4c2e-b4fc-71af3d4ada11` | Support | ACTIVE | — | |
| `4daf4d34-cf2e-4557-9614-79bbeb18629a` | Accounting | ACTIVE | — | Deployed from department template (3129456b-758a-43d5-bbc5-4a7c0ad58e3e) via package 35ff6009-c9ce-4d1d-a03d-d2114911bee3 |

### Accounting Department Sub-Agents (deployed from template)

| Agent ID | Name | Description |
|----------|------|-------------|
| `67f28fbe-d307-4a2e-ae4d-8279c881f81c` | Accounts Payable Specialist | AP specialist for invoice processing, three-way matching, payment scheduling, vendor management, 1099 reporting |
| `b94a2e33-f2df-4d98-a842-0102fc315537` | Accounts Receivable Specialist | AR specialist for invoice generation, collections, cash application, credit management |
| `a904a5ee-5874-4d80-886c-49767d7f9380` | Audit Coordinator | Financial statement audits, internal audits, compliance audits |
| `fa3decad-730e-4549-b82f-42a02c54ddab` | Budget Accountant | Budget preparation, variance analysis, rolling forecasts |
| `47224e5b-48ec-495a-bbd8-f11305970c0f` | Cost Accountant | Product costing, inventory valuation, manufacturing accounting |
| `3f745d4e-c9c5-4f75-ba18-c2b92d20495d` | Financial Reporting Specialist | GAAP financial statements, management reporting, board presentations |
| `7d95abfa-0640-475d-a72e-d3b148306120` | Fixed Assets Accountant | Asset acquisition, depreciation, capitalization, impairment testing |
| `8674a1ff-1f9e-44a2-b5af-f8888b268327` | General Ledger Accountant | Journal entries, account reconciliations, trial balance, GL maintenance |
| `e6f6ecd2-c84e-4b0f-b6b2-f060b6690189` | Intercompany Accounting Specialist | Cross-entity transactions, transfer pricing, cost sharing |
| `ba4b8214-c950-4111-ac79-1b96c427b8b0` | Payroll Accountant | Payroll processing, tax withholding, benefit accruals, garnishments |
| `d68a4549-659f-4442-b309-ec58baf23da0` | Tax Compliance Specialist | Federal/state/local tax filings, tax provisions, transfer pricing |
| `d166ac92-1eaa-4e3f-98ef-d86379d07562` | Treasury Accountant | Cash forecasting, liquidity management, debt covenants |

---

## 3. AI Employees (27 Total Agents)

### Finance Department Agents

| Agent ID | Name | Type | Status | Model | Department |
|----------|------|------|--------|-------|------------|
| `a74929c0-35fe-44e3-b9f9-bb489abb1c14` | M&A Analyst | FUNCTIONAL | ACTIVE | gpt-4o-mini | Finance |
| `845e225d-eeb0-4b26-bd3d-acf2f9d123ec` | Bookkeeper & Controller | FUNCTIONAL | IDLE | gpt-4o-mini | Finance |
| `782f5c54-ae9d-4c56-9ee9-b80d924f4ce5` | FP&A Analyst | FUNCTIONAL | IDLE | gpt-4o-mini | Finance |

### Customer Success Department Agents

| Agent ID | Name | Type | Status | Model | Department |
|----------|------|------|--------|-------|------------|
| `ee86de60-2c54-42bc-acd1-d2d4c54a13cf` | Customer Onboarding Specialist | FUNCTIONAL | IDLE | gpt-4o-mini | Customer Success |
| `b33c35a4-293e-4bf9-ac9a-45721fcebd38` | Customer Health & Risk Manager | FUNCTIONAL | IDLE | gpt-4o-mini | Customer Success |
| `377a8680-ca33-498c-b188-219e19916785` | Customer Retention & Renewal Manager | FUNCTIONAL | IDLE | gpt-4o-mini | Customer Success |

### Additional Agents (from Industry Package)

The tenant has deployed the **ACCOUNTING industry package** (`6e8fa654-e7d1-41d5-9bf2-ccb31c4001d5`) which includes:
- Investment Research Analyst (Finance)
- M&A Analyst (Finance)
- Bookkeeper & Controller (Finance)
- FP&A Analyst (Finance)
- Customer Onboarding Specialist (Customer Success)
- Customer Health & Risk Manager (Customer Success)
- Customer Retention & Renewal Manager (Customer Success)

**Package Source:** industry-package  
**Industry:** ACCOUNTING

---

## 4. Integrations

### Google Workspace
| Field | Value |
|-------|-------|
| **Provider** | google |
| **Label** | Google Workspace |
| **Description** | Gmail, Drive, Calendar, Sheets |
| **Status** | CONNECTED |
| **Scopes** | calendar, gmail.readonly, gmail.send, spreadsheets, drive |
| **Expires** | 2026-07-07T10:37:49.080Z |

### Brevo (Email Relay)
| Field | Value |
|-------|-------|
| **Provider** | brevo |
| **Label** | Brevo (Email Relay) |
| **Description** | Agent email aliases (300 emails/day free) |
| **Status** | NOT CONNECTED |

---

## 5. Workflows

| Workflow ID | Name | Status | Executions |
|-------------|------|--------|------------|
| `885fbe61-63e7-458c-9957-45f8c3f4e6fa` | sadfgsadf | DRAFT | 0 |

---

## 6. Owner Account

| Field | Value |
|-------|-------|
| **User ID** | `74a80f17-453c-448d-98de-78132914fad9` |
| **Email** | mali@live.com |
| **Name** | Mali Owner |
| **Role** | OWNER |
| **Tenant ID** | `726522f0-a9e4-4c13-b22f-a9a967b914dc` |
| **Status** | ACTIVE |

---

## 7. Account Tier Limits (Enterprise)

| Resource | Limit |
|----------|-------|
| Max Users | 500 |
| Max Agents | 200 |
| Max Departments | 50 |
| Max Storage (GB) | 500 |
| Max API Calls | 250,000/month |
| Max Conversation Messages | 100,000/month |
| Max File Size (MB) | 200 |
| Custom Branding | Yes |
| API Access | Yes |
| SSO | Yes |
| Audit Export | Yes |

---

## 8. API Endpoints (Production)

- **Base URL:** `https://brain.neurecore.com/api/v1/`
- **Tenant ID:** `726522f0-a9e4-4c13-b22f-a9a967b914dc`
- **Tenant UI:** `https://hq.neurecore.com`
- **Admin UI:** `https://cc.neurecore.com`

---

## 9. Browser Verification Summary (2026-07-08)

### Dashboard Stats (hq.neurecore.com)
| Metric | Value |
|--------|-------|
| Total Departments | 19 |
| Total Agents | 27 |
| Running Agents | 0 |
| Root/Sub Departments | 19 / 0 |
| Unassigned Agents | 9 |

### Departments with Active Agents
| Department | Agents |
|------------|--------|
| Customer Success | 3 |
| Finance | 3 |
| Human Resources | 2 |
| Legal | 4 |
| Specialized | 3 |
| Support | 3 |

### Agent Status (All 27)
- **Status:** All IDLE (0 running, 0 paused, 0 archived)
- **Types:** Mix of CORE and FUNCTIONAL agents

### Key Findings
1. **Accounting template deployed but not activated** — The "Accounting" department (4daf4d34) shows "Department template for Accounting with 12 AI Employees" but has **0 agents** assigned
2. **12 Accounting sub-departments exist** as empty templates (AP, AR, Audit, Budget, Cost, Financial Reporting, Fixed Assets, GL, Intercompany, Payroll, Tax, Treasury) — all showing 0 agents
3. **9 unassigned agents** — Agents without a department assigned
4. **All 27 agents are IDLE** — None are currently running
5. **Google Workspace integration** is connected and active

### Recommendations
- Deploy the 12 Accounting sub-department agents by activating the Accounting template
- Assign the 9 unassigned agents to appropriate departments
- Start/Resume agents to make them functional

---

## 10. Backend Permission Issue (2026-07-08)

### Issue Discovered
**All deploy/patch operations return `PERMISSION_DENIED` for both SUPER_ADMIN and tenant OWNER.**

### Endpoints Tested (all failed with 403):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/packages/deploy` | POST | Deploy package to tenant |
| `/api/v1/deploy/tenants/{id}/departments` | POST | Deploy single department |
| `/api/v1/deploy/tenants/{id}/agents` | POST | Bulk deploy agents |
| `/api/v1/deploy/agents/from-template/{id}` | POST | Spawn agent from template |
| `/api/v1/agents/{id}` | PATCH | Update agent (assign department) |

### Root Cause
Backend permission guards are blocking write operations for agent/department management. The SUPER_ADMIN role and OWNER role should have these permissions, but the guards are rejecting all requests.

### Evidence
```
Error: {"code":"PERMISSION_DENIED","message":"You don't have permission to perform this action."}
```

### Read Operations That Work
- `GET /api/v1/agents` - List agents ✓
- `GET /api/v1/departments` - List departments ✓
- `GET /api/v1/packages` - List packages ✓
- `GET /api/v1/tenants/{id}` - Get tenant details ✓

### Backend Fix Required
The backend needs to be checked for:
1. Permission guard configuration for deploy endpoints
2. Role-based access control (RBAC) for agent update operations
3. Tenant owner permissions for managing their own agents

Check backend guards in:
- `src/modules/agents/agents.controller.ts` - PATCH guard
- `src/modules/deploy/deploy.controller.ts` - deploy endpoint guards
- `src/modules/packages/packages.controller.ts` - deploy package guards

---

## 11. Cross-Page Session Fix (2026-07-08)

### Problem
Full-page navigation (e.g. opening `/departments` directly via URL bar) would log the user out. Client-side navigation (clicking a link) worked fine.

### Root Cause: `BaseAuthService.doInitialize()` HttpOnly cookie blind spot
The `__Host-nc_at` access-token cookie is `HttpOnly`, which means it cannot be read via `document.cookie`. The `doInitialize()` method used `tokenRepository.getAccessToken()` to check if a session exists. On a full page load, this returned `null` (correct — JavaScript can't read HttpOnly cookies), causing the code to fall into the `!cookie && cachedUser` branch, which called `userRepository.clearUser()` and set `status: 'unauthenticated'`. This immediately redirected every page to `/login` despite valid cookies in the browser jar.

### Fix Applied
In `BaseAuthService.doInitialize()`:
- **Changed** `this.tokenRepository.getAccessToken()` → `this.tokenRepository.getCsrfToken()` to check session presence.
- The CSRF cookie (`__Host-nc_csrf`) is NOT HttpOnly (it must be readable by JS to be echoed as the `X-CSRF-Token` header), so it works in both client-side and full-page navigation.
- If a cached user exists in Zustand AND the CSRF cookie is present, the session is treated as valid and `/auth/me` is called in the background to refresh the user data.

### Supporting Fix: `NEXT_PUBLIC_API_URL` env var
The `.env.local` file had `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` which was being inlined at build time, making all API calls go to `localhost:3000` instead of using Next.js relative proxy. Changed to `NEXT_PUBLIC_API_URL=/api/v1`.

### Deploy Notes
- After redeploying `.next/`, must `pm2 delete && pm2 start` (not just `restart`) to clear Next.js in-memory prerender cache.
- Verify the chunk hash in served HTML matches the chunk file on disk via `curl -s <page> | grep -oE '1225-[a-f0-9]+\.js'`.

### Files Changed
| File | Change |
|------|--------|
| `frontend-tenant/src/auth/impl/BaseAuthService.ts` | `doInitialize()` uses `getCsrfToken()` instead of `getAccessToken()` |
| `frontend-tenant/src/auth/transport/authHttpClient.ts` | `withCredentials: false` → `true` |
| `frontend-tenant/src/services/api.ts` | `withCredentials: false` → `true` (also in refresh call) |
| `frontend-tenant/src/core/services/api/clients/RestClient.ts` | `withCredentials: false` → `true` |
| `frontend-tenant/src/services/socket.ts` | Added `withCredentials: true` to Socket.IO options |
| `frontend-tenant/src/core/infrastructure/socket/SocketManager.ts` | Added `withCredentials: true` to Socket.IO options |
| `frontend-tenant/src/shared/hooks/useActivityFeed.ts` | Added polling fallback (30s interval) |
| `frontend-tenant/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` → `/api/v1` |
| `backend/src/common/auth/cookie-auth.service.ts` | `sameSite: 'none'` → `'lax'` for all cookies |

### Verification
- Login at `https://hq.neurecore.com/login` with mali@live.com ✓
- Redirect to `/home` ✓
- localStorage `auth-storage` shows user and `isAuthenticated: true` ✓
- Full page navigation to `/departments` → stays authenticated ✓
- API calls go to `https://hq.neurecore.com/api/v1/*` (relative) instead of `localhost:3000` ✓
