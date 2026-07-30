# Google Workspace

## Overview
Integrate NeureCore AI employees with Google Workspace: Gmail, Google Drive, Google Calendar, and Google Sheets. Most fully implemented integration feature.

## Category
INTEGRATION (integrationKey: `google_workspace`)

## Implementation Status
- ✅ **Fully audited + Phase-1 + Phase-2 + Phase-3 shipped (2026-07-07)** — see [google-services.md](./google-services.md) for comprehensive details.

## Quick Reference
| Area | Status | Details |
|------|--------|---------|
| Backend | ✅ | `GoogleDriveService` (~600 LOC; `mode:'fulltext'` search, `webViewLink` on folder create, **share/list/revoke permissions (G8)**, `deleteFile`); `GoogleGmailService`; `GoogleCalendarService`; `GoogleSheetsService`; `GoogleAuthClient`; Drive cleanup scheduler; OAuth flow (audience-aware callback) + admin-revoke (G7); pure `oauth-callback.util`; pure `csv.util` |
| Tenant UI | ✅ | Google Sign-In, integration connect/disconnect, **Sheets browser (`/settings/integrations/sheets`)** with CSV-seeded create, **Calendar browser (`/settings/integrations/calendar`)**, Drive tree view, Gmail compose, OAuth callback. Cross-links from `/settings/integrations` and `/settings/integrations/google` |
| Admin UI | ✅ | Read-only platform overview at `/settings/integrations` consuming `GET /integrations/google/platform-status`; **per-tenant Revoke button (G7)** wired to `POST /integrations/admin/google/:tenantId/disconnect`; OAuth callback can route to admin via `audience:'admin'` (G1) |
| Agent Tools | ✅ | `EmailTool` (Gmail), `DocumentsTool` (Drive + **`share`/`unshare` permissions (G8)**), `ReportsTool` (Drive), `ContextTool` (Drive), `CalendarTool` (Calendar), `SheetsTool` (Sheets + **`import_csv`/`export_csv` (G9)**) |
| Sheets | ✅ | `GoogleSheetsService` + 6 Sheets endpoints + `SheetsTool` with 8 actions; tenant UI at `/settings/integrations/sheets` supports create-with-CSV-import, search, and A1 range read/write/edit |
| **Operations** | ✅ | `runbook.md §9` (G10) — Google OAuth credential rotation procedure: pre-flight, OAuth client recreation, in-place `sed` edit of `backend/.env.production`, PM2 restart, smoke test, per-tenant DB spot-check, audit-log verification, failure-mode cheatsheet |

## OAuth Scopes Requested
- `gmail.readonly`, `gmail.send`, `drive`, `calendar`, `spreadsheets`

## Key File References
- `backend/src/modules/integrations/google/`
  - `oauth-callback.util.ts` — pure `readAudienceFromState` + `buildCallbackRedirectUrl` (G1)
  - `oauth-callback.util.spec.ts` — 10 tests (G1)
  - `__tests__/google-drive.service.spec.ts` — 7 tests (G5 + G6)
  - `__tests__/google-drive-sharing.spec.ts` — 9 tests (G8)
  - Drive, Gmail, Calendar, Sheets services; AuthClient; RateLimiter; Cleanup; Interface
- `backend/src/modules/integrations/integrations.controller.ts` (~600 LOC) — 8 sections: OAuth (G1), Gmail, Calendar, Drive, Sheets, Search (G6), **Drive permissions (G8)**, **Admin override (G7)**
- `backend/src/modules/integrations/integrations.service.ts` (~280 LOC) — OAuth init (`audience`), callback, disconnect, **`adminDisconnectGoogle` (G7)** with audit-log wiring
- `backend/src/modules/integrations/__tests__/integrations.service.admin.spec.ts` — 4 tests (G7)
- `backend/src/modules/tools/built-in/`
  - `calendar.tool.ts` (342 LOC)
  - `sheets.tool.ts` (~340 LOC, incl. **`import_csv`/`export_csv` (G9)**)
  - `csv.util.ts` + `csv.util.spec.ts` (G9)
  - `documents.tool.ts` (~400 LOC, incl. **`share`/`unshare` (G8)**)
  - `email.tool.ts`, `reports.tool.ts`, `context.tool.ts`
- `backend/src/modules/agents/services/agents.service.ts:164-173` — eager Drive folder provisioning on agent creation
- `frontend-tenant/src/app/settings/integrations/`
  - `sheets/page.tsx` (451 LOC, **new Phase 2**)
  - `calendar/page.tsx` (458 LOC, **new Phase 2**)
  - `google/page.tsx` (351 LOC) — Open-Google-apps panel
  - `page.tsx` (581 LOC) — Google card quick-access to Sheets/Calendar
  - `google/compose/page.tsx` — Gmail compose
  - `callback/google/page.tsx` — OAuth callback UI
- `frontend-tenant/src/services/integrations.service.ts` (~430 LOC) — proxies all Google endpoints through backend incl. 6 Sheets methods + `searchDrive({mode})` + Drive permissions
- `frontend-admin/src/app/settings/integrations/page.tsx` (~340 LOC) — platform overview + **Phase-3 Revoke button (G7)**
- `memory-bank-new/runbook.md` §9 — **Phase-3 credential-rotation runbook (G10)**

## Unit Test Coverage (post-Phase-3)
Run: `npx jest --config jest.config.js src/modules/integrations/google src/modules/integrations/__tests__ src/modules/tools/built-in/csv.util.spec.ts` → **53 of 53 tests passing**

| Spec | Cases | Gap |
|------|-------|-----|
| `oauth-callback.util.spec.ts` | 10 | G1 — incl. relative-URL regression |
| `google-drive.service.spec.ts` | 7 | G5 (2) + G6 (3) + idempotent-existing-folder (1) + idempotent-revoke (1) |
| `google-drive-sharing.spec.ts` | 9 | G8 — validation, POST/GET/DELETE happy paths, sendNotification, error paths |
| `integrations.service.admin.spec.ts` | 4 | G7 — NotFound + hadCalendar variants + Prisma update assertions |
| `csv.util.spec.ts` | 22 | G9 — colToLetter, parseCsv (all delimiters, RFC-4180, CRLF), toCsv, csvEscape, full round-trip |

## Implementation Gaps (post-Phase-3)

### Closed Phase 1 (2026-07-07 morning)
- 🔴 **G1** OAuth callback relative-URL bug → absolute-URL redirect with `audience` routing
- G5 `createFolder` returns `webViewLink`
- G6 Drive `mode:'fulltext'` search

### Closed Phase 2 (2026-07-07 afternoon)
- G2 Tenant Sheets UI (`/settings/integrations/sheets`)
- G3 Tenant Calendar UI (`/settings/integrations/calendar`)
- G4 Service-layer methods for Sheets + `searchDrive({mode})`

### Closed Phase 3 (2026-07-07 evening)
- G7 Admin revoke endpoint + audit-log integration + Admin UI Revoke button
- G8 Drive sharing + permissions endpoints + `DocumentsTool.share`/`unshare` actions
- G9 `SheetsTool.import_csv`/`export_csv` actions + pure CSV helpers
- G10 Client-secret rotation runbook in `memory-bank-new/runbook.md` §9

## Post-Phase-5 Fixes (2026-07-12)

See `google-services.md §10` for the comprehensive 2026-07-12 audit:
- **G-CRIT-1**: Fixed placeholder `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `frontend-tenant/.env.local`
- **G-CRIT-2**: Added missing `GOOGLE_TOKEN_ENCRYPTION_KEY` to `backend/.env`
- **G-CRIT-3/Fixed CryptoService**: `ENCRYPTION_KEY` vs `GOOGLE_TOKEN_ENCRYPTION_KEY` mismatch; added dev-fallback for backward compat
- **Live E2E verification**: Calendar, Sheets, Docs, Slides, Drive, Gmail all verified against mnpiracha@gmail.com
- **728/728 tests pass**

### Forward-looking (deferred)
| # | Gap | Priority |
|---|-----|----------|
| G11 | Admin "Connect on behalf of tenant" CTA (requires service-account / impersonation) | Low |
| G12 | Drive file copy/move (`files.copy`, `parents`) | Low |
| G13 | Cross-calendar `find_free_slots` (multi-calendar free/busy) | Low |
| G14 | Drive full-text subscribe via `changes.watch` webhook | Low |
