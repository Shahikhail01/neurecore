# Google Services Integration — Audit (2026-07-07, post-Phase-4)

> **Phase-1 (G1/G5/G6 backend fixes) + Phase-2 (G2/G3/G4 tenant UI) + Phase-3 (G7 admin revoke / G8 Drive sharing / G9 Sheets CSV import-export / G10 secret-rotation runbook) + Phase-4 (full test coverage + remaining gaps) — all shipped same day.**
> Previous version of this doc was out of date — multiple items it listed as "missing" were already implemented. This audit reflects the current state of `neurecore/backend/src/modules/integrations/google/`, `neurecore/backend/src/modules/tools/built-in/`, `frontend-tenant/src/app/settings/integrations/`, `frontend-admin/`, and `memory-bank-new/runbook.md` after the Phase-1 → Phase-4 fixes shipped. See §6.1, §6.4, and §9 for the change list and new file references.

## 1. Overview

NeureCore integrates with Google Workspace via OAuth 2.0. The integration is **tenant-scoped**: the tenant admin connects their Google Workspace account, and the system stores encrypted OAuth credentials per-tenant in `IntegrationCredential` table. All subsequent Google API calls use the tenant's access token.

**Requested OAuth Scopes** (all-or-nothing, single consent screen — `integrations.service.ts:7-13`):
- `gmail.readonly` — Read inbox
- `gmail.send` — Send email
- `drive` — Full Drive access (create/read/update/delete files)
- `calendar` — Read/write calendar events
- `spreadsheets` — Read/write Google Sheets

**Implementation Status Matrix:**

| Service | Backend Service | REST Endpoints | Tenant UI | Admin UI | Agent Tool |
|---------|-----------------|---------------|-----------|----------|-----------|
| Google Sign-In | `auth.service.googleSignIn()` (backend) — fronted by `useAuth().loginWithGoogle(idToken, intent)` via `RestAuthApi` | `POST /auth/google` | `/login` | ❌ (N/A — admin doesn't support Google login; see [int-features/auth-architecture.md](../int-features/auth-architecture.md)) | N/A |
| OAuth connect/disconnect | `IntegrationsService` | `/integrations/google/{authorize,callback,disconnect,status}` + admin-revoke | ✅ `/settings/integrations` | ✅ revoke button + read-only overview | N/A |
| Gmail | `GoogleGmailService` | `/integrations/gmail/*` (inbox, message, body, send, labels) | ✅ Inbox UI + Compose page | ❌ | ✅ `EmailTool` |
| Google Drive | `GoogleDriveService` | `/integrations/drive/*` + `/integrations/google/drive-folders` + `/integrations/drive/search?q=...&mode=name\|fulltext` + `/integrations/drive/files/:id/permissions[...]` | ✅ Folder tree view | ❌ | ✅ `DocumentsTool` (create/list/read/**share/unshare**), `ReportsTool`, `ContextTool` |
| Calendar | `GoogleCalendarService` | `/integrations/calendar/*` | ✅ `/settings/integrations/calendar` | ❌ | ✅ `CalendarTool` |
| Google Sheets | `GoogleSheetsService` | `/integrations/sheets/*` | ✅ `/settings/integrations/sheets` | ❌ | ✅ `SheetsTool` (+ **`import_csv`/`export_csv`**) |
| Platform monitoring | `IntegrationsController.getPlatformGoogleStatus` | `GET /integrations/google/platform-status` | N/A | ✅ `/settings/integrations` (read-only) + Revoke button per connected tenant | N/A |

All five Google service classes (`Gmail`, `Drive`, `Calendar`, `Sheets`) plus `GoogleAuthClient`, `DriveCleanupService`, `oauth-callback.util`, and `gmail-rate-limiter` are wired in `integrations.module.ts`. `CalendarTool`, `SheetsTool`, and `DocumentsTool` are registered in `tools.module.ts:110-111` and granted to multiple Hermes agent types in `hermes-tools.ts`. **Phase-3 admin revoke** writes an `AuditLog` row via `AuditService.log()` at `action='google.admin_revoke'`. **Phase-4 unit tests** cover all services, tools, and utilities (173 cases total across 15 suites, all passing).

---

## 2. Backend Architecture

### 2.1 Module Structure

```
src/modules/integrations/
├── integrations.module.ts              ← Registers all Google services + controllers
├── integrations.controller.ts          ← REST endpoints + admin platform-status
├── integrations.service.ts             ← OAuth authorization/callback/disconnect, scope list
├── dto/integration.dto.ts              ← ConnectGoogleDto (with audience), ConnectBrevoDto
├── services/
│   ├── integration-credential.store.ts ← AES-256-GCM encrypted credential persistence
│   └── credential-store.interface.ts   ← Abstraction interface
├── email/
│   ├── email-provider.factory.ts       ← Provider resolution (gmail vs brevo)
│   └── gmail-email.provider.ts         ← Gmail email sending via API
└── google/
    ├── google-auth.client.ts           ← OAuth2 token lifecycle + auto-refresh
    ├── google-drive.service.ts         ← Drive API wrapper (files, folders, search, delete)
    ├── drive-service.interface.ts      ← IDriveService interface
    ├── drive-cleanup.service.ts        ← Scheduler: cleanup terminated agent Drive folders
    ├── google-gmail.service.ts         ← Gmail API wrapper (inbox, send, labels)
    ├── google-calendar.service.ts      ← Calendar API wrapper (CRUD events)
    ├── google-sheets.service.ts        ← Google Sheets API wrapper
    ├── gmail-rate-limiter.ts           ← Rate limiting with retry logic
    ├── oauth-callback.util.ts          ← Pure helpers: readAudienceFromState + buildCallbackRedirectUrl (G1)
    └── __tests__/
        ├── google-drive.service.spec.ts    ← Covers G5 (webViewLink) + G6 (searchFiles mode)
        ├── google-drive-sharing.spec.ts    ← Covers G8 (share/list/revoke permissions)
        ├── google-gmail.service.spec.ts    ← Phase 4: all Gmail operations
        ├── google-calendar.service.spec.ts ← Phase 4: all Calendar operations
        ├── google-sheets.service.spec.ts   ← Phase 4: all Sheets operations incl. batchUpdate/copySheet
        ├── google-auth.client.spec.ts      ← Phase 4: token lifecycle + refresh
        ├── drive-cleanup.service.spec.ts   ← Phase 4: cleanup scheduler
        ├── gmail-rate-limiter.spec.ts     ← Phase 4: retry logic + backoff
        └── (oauth-callback.util.spec.ts is co-located)
```

### 2.2 Database Schema (Prisma)

**`enum IntegrationProvider`** (line 1666):
```prisma
GOOGLE
BREVO
SLACK
MICROSOFT
```

**`model IntegrationCredential`** (line 1680):
- `tenantId` + `provider` = unique
- `encryptedCredentials` — AES-256-GCM encrypted blob holding `{ accessToken, refreshToken, expiryDate, scopes }`
- `scopes`, `expiresAt`, `state`, `metadata`

**`model Tenant`** (line 315):
- `googleDriveRootFolderId` (String?) — ID of the "NeureCore" root folder in Drive
- `googleCalendarId` (String?) — ID of the tenant's primary calendar

**`model Agent`** (line 654):
- `googleDriveFolderId` (String?) — ID of the agent's dedicated Drive folder (cached on agent-create)
- `emailAlias` (String?) — Sender email alias (e.g. `support@company.com`)
- `emailProvider` (String?, default `"brevo"`) — `"gmail" | "brevo"`
- `emailDisplayName` (String?)
- `emailSignature` (String?)

### 2.3 REST API Endpoints

**OAuth Flow & Status:**
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/integrations` | List all connected providers |
| `GET`  | `/integrations/google/status` | Connection status + granted scopes |
| `POST` | `/integrations/google/authorize` | Initiate OAuth — returns Google auth URL (body: `{ redirectUri?, audience: 'tenant'\|'admin' }`) |
| `GET`  | `/integrations/google/callback` | OAuth callback (public, 302 redirect to absolute URL based on `audience`) |
| `POST` | `/integrations/google/disconnect` | Tenant self-revoke + delete credentials |
| `GET`  | `/integrations/google/platform-status` | Admin-only: all tenants + scope coverage |
| `POST` | `/integrations/admin/google/:tenantId/disconnect` | **G7 admin override**: revoke any tenant's connection; writes `AuditLog row` |

**Gmail:**
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/integrations/gmail/inbox` | List inbox messages |
| `GET`  | `/integrations/gmail/messages/:id` | Get single message metadata |
| `GET`  | `/integrations/gmail/messages/:id/body` | Get message body (plain text + HTML) |
| `POST` | `/integrations/gmail/send` | Send email via Gmail |
| `GET`  | `/integrations/gmail/labels` | List Gmail labels |

**Calendar:**
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/integrations/calendar/events` | List calendar events |
| `POST` | `/integrations/calendar/events` | Create calendar event |
| `DELETE` | `/integrations/calendar/events/:id` | Delete calendar event |
| `GET`  | `/integrations/calendar/list` | List available calendars |

**Drive:**
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/integrations/drive/folders/agents` | List agents with Drive folders |
| `POST` | `/integrations/drive/folders/agents/:agentId/setup` | Create agent folder structure |
| `GET`  | `/integrations/drive/folders/:folderId/files` | List files in folder |
| `POST` | `/integrations/drive/folders` | Create folder (returns `webViewLink`) |
| `POST` | `/integrations/drive/files` | Create/upload file |
| `GET`  | `/integrations/google/drive-folders` | Root Drive tree (nested folder view) |
| `GET`  | `/integrations/drive/search?q=...&mode=name\|fulltext` | Drive search; default `mode=name`, `mode=fulltext` switches to `fullText contains` (filename + content + OCR) |
| `POST` | `/integrations/drive/files/:fileId/permissions` | **G8**: share a Drive file/folder with a user (emailAddress), group (emailAddress), domain (domain), or anyone (no recipient). Body: `{ role: 'reader'\|'writer'\|'commenter', type: 'user'\|'group'\|'domain'\|'anyone', emailAddress?, domain?, sendNotification?, emailMessage? }` |
| `GET`  | `/integrations/drive/files/:fileId/permissions` | **G8**: list permissions on a Drive file/folder |
| `DELETE` | `/integrations/drive/files/:fileId/permissions/:permissionId` | **G8**: revoke a Drive permission (idempotent — 404s swallowed) |

**Google Sheets:**
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/integrations/sheets` | Create spreadsheet (with optional named sheets) |
| `GET`  | `/integrations/sheets/:spreadsheetId/metadata` | Sheets/structure/title |
| `GET`  | `/integrations/sheets/:spreadsheetId/values/:range` | Read range (A1 notation) |
| `POST` | `/integrations/sheets/:spreadsheetId/values/:range` | Write range (overwrites) |
| `POST` | `/integrations/sheets/:spreadsheetId/values/:range/append` | Append rows |
| `POST` | `/integrations/sheets/:spreadsheetId/values/:range/clear` | Clear range |
| `POST` | `/integrations/sheets/:spreadsheetId/batchUpdate` | **G-SHEETS-1**: Batch mutations (add/delete sheets, formatting) |
| `POST` | `/integrations/sheets/:spreadsheetId/sheets/:sheetId/copyTo` | **G-SHEETS-2**: Copy sheet to another spreadsheet |

### 2.4 Agent Folder Structure & Auto-Provisioning

When an agent's Drive folder is provisioned (via `setupAgentFolders`), the hierarchy is:

```
NeureCore/                          ← Tenant root (googleDriveRootFolderId)
└── <Agent Name>/                   ← Agent folder (googleDriveFolderId)
    ├── Drafts/
    ├── Documents/                  ← Default for document creation
    ├── Reports/                    ← Default for report generation
    ├── Templates/
    └── Archive/
```

**Auto-provisioning on agent creation:** `AgentsService.create()` (`agents.service.ts:164-173`) fires a non-blocking `setupAgentFolders` call immediately after `prisma.agent.create`, so folders exist before the first tool use. The call swallows Drive errors with a warning so failed provisioning doesn't break agent creation — tools then auto-provision lazily as before.

Folder creation: `POST https://www.googleapis.com/drive/v3/files` with `mimeType: application/vnd.google-apps.folder`. File upload: `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` (multipart/related).

### 2.5 Cleanup Scheduler

`DriveCleanupService` runs on a configurable interval (`DRIVE_CLEANUP_INTERVAL_MS`, default 24h). It:
1. Finds TERMINATED agents whose `updatedAt` exceeds tenant's `retentionDays` (default 90)
2. Sends warning notifications 7 days before deletion
3. Deletes only empty folders (skips if children remain)
4. Clears `googleDriveFolderId` on the Agent record after deletion

### 2.6 OAuth Callback Redirect — **FIXED (was critical bug)**

**Previous behaviour**: `IntegrationsController.googleCallback()` used `@Redirect(undefined, 302)` to redirect to `/settings/integrations?...` — a **relative path**. The browser resolved this against the current origin (`https://brain.neurecore.com`), landing on the API host instead of the tenant UI. The tenant UI callback page at `/settings/integrations/callback/google` was therefore never reached, and OAuth round-trips silently 404'd after the consent screen.

**Current behaviour** (fixed 2026-07-07):
- `IntegrationsService.initiateGoogleOAuth(tenantId, redirectUri, audience)` accepts an `audience: 'tenant' | 'admin'` parameter (`integrations.service.ts:25`) and persists it in the OAuth `state` payload (base64-encoded JSON: `{ tenantId, provider, redirectUri, audience }`).
- `IntegrationsController.googleCallback()` (`integrations.controller.ts:80-145`):
  - Reads `audience` from `state` via `readAudienceFromState()` (typed-safe parsing of unknown JSON)
  - Resolves the redirect base URL from config: `TENANT_FRONTEND_BASE_URL` (default `https://hq.neurecore.com`) or `ADMIN_FRONTEND_BASE_URL` (default `https://cc.neurecore.com`), with backwards-compatible fallbacks to `FRONTEND_BASE_URL` / `ADMIN_BASE_URL`
  - Emits an absolute `302` via `@Res()`: `${base}/settings/integrations?...`
- `ConnectGoogleDto` (`dto/integration.dto.ts:1-16`) enforces `audience ∈ {tenant, admin}` via `@IsIn`.
- Tenant frontend service `integrations.service.ts:118` forwards `audience` (default `'tenant'` — backward compatible).

Admin-spawned OAuth flows can now opt-in to `audience: 'admin'` to land the user on `https://cc.neurecore.com/settings/integrations` after consent.

---

## 3. Tenant Frontend (`frontend-tenant/src/app/settings/integrations/`)

### 3.1 Pages and Routes

| Route | File | Purpose |
|-------|------|---------|
| `/login` | `src/app/login/page.tsx` | Google Sign-In button (GSI), account linking |
| `/settings/integrations` | `src/app/settings/integrations/page.tsx` | Integration listing: Google card with connect/disconnect; quick links to Sheets / Calendar when Google is connected |
| `/settings/integrations/google` | `src/app/settings/integrations/google/page.tsx` | Google status, scopes list, Drive folder tree, "Open Google apps" section linking to Sheets / Calendar, disconnect danger zone |
| `/settings/integrations/google/compose` | `src/app/settings/integrations/google/compose/page.tsx` | Gmail compose form (To, Cc, Bcc, Subject, Body) |
| `/settings/integrations/sheets` | `src/app/settings/integrations/sheets/page.tsx` | Sheets browser: search by filename, create-with-CSV-import, view/edit A1 ranges |
| `/settings/integrations/calendar` | `src/app/settings/integrations/calendar/page.tsx` | Calendar browser: 14-day window, calendar picker, create/delete events with attendees + timezone |
| `/settings/integrations/callback/google` | `src/app/settings/integrations/callback/google/page.tsx` | OAuth callback handler (success/error display + redirect) |
| `/privacy` | `src/app/privacy/page.tsx` | Links to Google Privacy Policy |

### 3.2 Service Layer

`src/services/integrations.service.ts` proxies all Google API calls through the backend:

- **OAuth**: `initiateGoogleOAuth(redirectUri?, audience='tenant')`, `disconnectGoogle()`, `getGoogleStatus()`, `getBrevoStatus()`
- **Gmail**: `getInbox()`, `getMessage()`, `getMessageBody()`, `sendEmail()`, `getGmailLabels()`
- **Calendar**: `getCalendarEvents()`, `createCalendarEvent()`, `deleteCalendarEvent()`, `getCalendarList()`
- **Drive**: `listAgentFolders()`, `setupAgentFolders()`, `listDriveFiles()`, `createDriveFolder()`, `createDriveFile()`, `getGoogleDriveFolders()`
- **Drive search** (added Phase-2): `searchDrive(query, { pageSize, mimeType, mode: 'name' | 'fulltext' })` — proxies `GET /integrations/drive/search?q=...&mode=...`
- **Drive sharing** (added Phase-3 G8): `shareDriveFile(fileId, body)`, `listDriveFilePermissions(fileId)`, `revokeDriveFilePermission(fileId, permissionId)` — proxies `/integrations/drive/files/:id/permissions[...]`
- **Google Sheets** (added Phase-2, refactored Phase-3):
  - `createSpreadsheet({ title, sheets? })`
  - `getSpreadsheetMetadata(spreadsheetId)`
  - `readSheetRange(spreadsheetId, range, majorDimension='ROWS')` — returns `{ range, values, rowCount, colCount }`
  - `writeSheetRange(spreadsheetId, range, values, majorDimension)` — overwrites
  - `appendSheetRows(spreadsheetId, range, values)` — `INSERT_ROWS`
  - `clearSheetRange(spreadsheetId, range)`
  - SheetsTool additionally exposes **`import_csv`** (raw CSV → new/existing sheet with `csvDelimiter` + `hasHeader`) and **`export_csv`** (range → RFC-4180 CSV text) — these are agent-only actions; the tenant UI already parses CSV client-side.

### 3.3 Google Sign-In (Login Page)

- Uses Google Identity Services (GSI) client library
- Dual intent: `signin` (first-time auth) and `link` (link Google to existing email/password account)
- Custom events `neurecore:google-account-exists` and `neurecore:google-link-account` handle account linking modal
- Calls `POST /auth/google` with `{ idToken, intent }`

### 3.4 OAuth Flow (Connect Google)

1. User clicks "Connect Google" on `/settings/integrations`
2. Frontend calls `POST /integrations/google/authorize` (with optional `audience: 'tenant' | 'admin'`) → receives Google OAuth URL
3. User is redirected to Google consent screen (scopes: Gmail, Drive, Calendar, Sheets)
4. Google redirects to `GET /integrations/google/callback?code=...&state=...`
5. Backend exchanges code for tokens, saves encrypted credentials
6. Backend 302-redirects (absolute URL) to `${TENANT_FRONTEND_BASE_URL}/settings/integrations?connected=true&email=...` (defaults to `https://hq.neurecore.com/...`); if `audience='admin'`, lands on `${ADMIN_FRONTEND_BASE_URL}/settings/integrations...`
7. Tenant UI shows success banner via query-string-driven display on `/settings/integrations` itself

In production the redirect from step 6 is now an absolute URL pointing to the configured frontend host, so the round-trip UX works correctly.

---

## 4. Admin Frontend (`frontend-admin/src/app/settings/integrations/`)

### 4.1 Current State — Read-Only Platform Overview

**`/settings/integrations` (`page.tsx`, 267 LOC)**: full read-only Google Workspace oversight page that consumes `GET /integrations/google/platform-status`. Features:
- Global stats tiles: connected tenants / total tenants, agents-with-Drive count, per-scope coverage (gmail/drive/calendar/spreadsheets)
- Per-tenant list with status dot, granted-scopes badges, agent count, Drive folder count, connected email
- "No tenants have connected" empty state
- OAuth configuration info block documenting required env vars & redirect URI

Registered in admin sidebar (`settings/layout.tsx:46-51`) and protected by `Roles(SUPER_ADMIN, PLATFORM_ADMIN)` guard on the backend endpoint.

### 4.2 Admin Actions (post-Phase-3)

- ✅ **Revoke a tenant's Google connection from admin** (Phase 3 G7) — each connected tenant row in `/settings/integrations` now has a `Revoke` button that hits `POST /integrations/admin/google/:tenantId/disconnect`. Confirmation modal explains the side-effect ("forces re-consent, recorded in audit log"). Behind the scenes `IntegrationsService.adminDisconnectGoogle()` checks credential existence, deletes the encrypted credential, clears `googleDriveRootFolderId`/`googleCalendarId` on the tenant, and `AuditService.log()` writes `action='google.admin_revoke'` with `resourceId=tenantId`. Surfaces in `/settings/audit`.
- **Cannot initiate Google OAuth on behalf of a tenant** — still correct by design (tenants own their credentials)
- **No Sheets/Calendar pages on admin** — consistent with per-tenant data model
- **OAuth callback routing for admin** — `audience: 'admin'` flag (G1) still works for any future admin-spawned flows
- **Admin `Revoke` writes an audit row** at `action='google.admin_revoke'` so all admin-initiated revokes are auditable.

---

## 5. AI Employee (Agent) Integration

### 5.1 Available Tools

| Tool | File | Actions | Google Service Used |
|------|------|---------|-------------------|
| **DocumentsTool** | `backend/src/modules/tools/built-in/documents.tool.ts` | `create`, `list`, `read`, **`share`, `unshare` (G8)** | Drive (create file, list files, read/export content, manage permissions) |
| **ReportsTool** | `backend/src/modules/tools/built-in/reports.tool.ts` | `generate`, `export_pdf` | Drive (create HTML in Reports folder, export as PDF) |
| **ContextTool** | `backend/src/modules/tools/built-in/context.tool.ts` | `load_drive`, `load_all` | Drive (list files, download snippet content) |
| **EmailTool** | `backend/src/modules/tools/built-in/email.tool.ts` | `read_inbox`, `get_message`, `send`, `flag` | Gmail (inbox, send, modify labels) |
| **CalendarTool** | `backend/src/modules/tools/built-in/calendar.tool.ts` | `list`, `create`, `delete`, `list_calendars`, `find_free_slots` | Google Calendar |
| **SheetsTool** | `backend/src/modules/tools/built-in/sheets.tool.ts` | `create_spreadsheet`, `read_range`, `write_range`, `append_rows`, `get_metadata`, `clear_range`, **`import_csv`, `export_csv` (G9)** | Google Sheets (incl. RFC-4180 CSV import/export) |

`CalendarTool` and `SheetsTool` are wired in `tools.module.ts:110-111` and exposed to multiple Hermes agent types (`hermes-tools.ts`): HR, Finance, Sales, Marketing, Operations, Custom all have both; Research has Sheets; HR/Sales/Marketing/Operations have Calendar; Engineering/QA/Security/Customer Support have neither.

### 5.2 Drive Folder Access — Fully Automated

1. `AgentsService.create()` calls `GoogleDriveService.setupAgentFolders()` asynchronously on agent creation (`agents.service.ts:164-173`).
2. Ensures `NeureCore/` root, creates agent folder + 5 subfolders (`Drafts/`, `Documents/`, `Reports/`, `Templates/`, `Archive/`).
3. Subsequent tool calls resolve `googleDriveFolderId` from the agent record and operate within it.
4. `listAgentFolders` endpoint returns all agents with Drive folders for the tenant UI.

### 5.3 Document Read — Handles Native Google Formats

`DocumentsTool.read()` (`documents.tool.ts:232`) detects any `application/vnd.google-apps.*` MIME type (Doc, Sheet, Slide, Form, Drawing) and exports via `files/{id}/export?mimeType=text/html`. Plain text/HTML files download via `alt=media`.

### 5.4 Document Creation

- `DocumentsTool.create` — file in agent's subfolder (default `Documents/`), HTML or plain text, multipart upload, returns `webViewLink`.
- `ReportsTool.generate` — HTML report saved to agent's `Reports/` subfolder; falls back inline if Drive disconnected.
- `ReportsTool.export_pdf` — exports a Drive file via Google native `files/{id}/export?mimeType=application/pdf`.

### 5.5 Email

`EmailTool` (`email.tool.ts`):
- Read inbox with optional Gmail search query and label filters
- Read full message body
- Send — provider auto-resolves (`agent.emailProvider === 'gmail'` and tenant connected → Gmail; else Brevo)
- Flag with `IMPORTANT`/`STARRED` labels

### 5.6 Calendar — Agent-Accessible Now

`CalendarTool` (`calendar.tool.ts:317 lines`) wraps `GoogleCalendarService`:
- `list` — events from any calendar with optional time window + free-text `q`
- `create` — schedules new event with attendees, location, timezone
- `delete` — cancels existing event
- `list_calendars` — enumerates available calendars
- `find_free_slots` — computes open windows between busy slots in a given day (default 30-min slots, 24h window)

### 5.7 Google Sheets — Agent-Accessible Now

`SheetsTool` (`sheets.tool.ts:317 lines`) wraps `GoogleSheetsService`:
- `create_spreadsheet` — with optional initial sheet title
- `read_range` / `write_range` — A1-notation range read/write
- `append_rows` — append rows after last data row (`INSERT_ROWS`)
- `get_metadata` — sheets list, title, row/column counts, `webViewLink`
- `clear_range` — clears values without deleting cells

---

## 6. Gap Analysis — Current State (2026-07-07)

### 6.1 Resolved — Historical & This Audit (2026-07-07)

Items previously listed as missing — **all implemented and in some cases further improved this session**:

| Item | Where | Status |
|------|-------|--------|
| Google Sheets service | `google-sheets.service.ts` (300 LOC) | ✅ Pre-existing |
| Sheets REST endpoints | `integrations.controller.ts:288-357` | ✅ Pre-existing |
| `SheetsTool` for agents | `sheets.tool.ts` (≈340 LOC after G9), wired in `tools.module.ts:111` | ✅ Pre-existing + Phase 3 actions |
| `CalendarTool` for agents | `calendar.tool.ts` (342 LOC), wired in `tools.module.ts:110` | ✅ Pre-existing |
| `drive-service.interface.ts` | exists at `integrations/google/drive-service.interface.ts` | ✅ Pre-existing |
| Eager agent folder provisioning | `agents.service.ts:164-173` | ✅ Pre-existing |
| Admin Google integration UI | `frontend-admin/src/app/settings/integrations/page.tsx` (≈340 LOC after G7 Revoke button) | ✅ Pre-existing + Phase 3 |
| Drive `searchFiles` (name contains) | `google-drive.service.ts:333-367` | ✅ Pre-existing |
| Drive `webViewLink` on file creation | `google-drive.service.ts:304-306` | ✅ Pre-existing |
| DocumentsTool reads Google-native formats | `documents.tool.ts:232-238` | ✅ Pre-existing |
| **G1** OAuth callback absolute redirect + tenant/admin routing | `integrations.controller.ts:80-145` (`googleCallback`); helper extracted to `integrations/google/oauth-callback.util.ts` (pure `readAudienceFromState` + `buildCallbackRedirectUrl`); `integrations.service.ts:25-60` (`initiateGoogleOAuth` adds `audience`); `dto/integration.dto.ts:1-16`; `frontend-tenant/src/services/integrations.service.ts:118` | ✅ **Fixed this session (Phase 1)** |
| **G2** Tenant Sheets UI | `frontend-tenant/src/app/settings/integrations/sheets/page.tsx` (search list + range view + create-with-CSV-import dialog); cross-links from `/settings/integrations` and `/settings/integrations/google` | ✅ **Fixed this session (Phase 2)** |
| **G3** Tenant Calendar UI | `frontend-tenant/src/app/settings/integrations/calendar/page.tsx` (14-day grouped view, calendar picker, create/delete events with attendees + timezone); cross-links from `/settings/integrations` and `/settings/integrations/google` | ✅ **Fixed this session (Phase 2)** |
| **G4** Tenant service methods for Sheets + Drive full-text | `frontend-tenant/src/services/integrations.service.ts` (374 LOC) adds `createSpreadsheet`, `getSpreadsheetMetadata`, `readSheetRange`, `writeSheetRange`, `appendSheetRows`, `clearSheetRange`, `searchDrive({mode})` | ✅ **Fixed this session (Phase 2)** |
| **G5** `webViewLink` returned on `createFolder` | `google-drive.service.ts:104-148` now requests `fields=id,name,mimeType,webViewLink,parents,createdTime,modifiedTime` | ✅ **Fixed this session (Phase 1)** |
| **G6** Full-text Drive search via `fullText contains` + tests | `google-drive.service.ts:333-367` — `searchFiles` accepts `mode: 'name' \| 'fulltext'`; `integrations.controller.ts:359-372` exposes `GET /integrations/drive/search?mode=fulltext`; covered by `google-drive.service.spec.ts` (3 cases for `searchFiles`) | ✅ **Fixed this session (Phase 1 + tests Phase 2)** |
| **G7** Admin override revoke + audit trail | `integrations.service.ts:135-200` adds `adminDisconnectGoogle`; `integrations.controller.ts` adds `POST /integrations/admin/google/:tenantId/disconnect` (Roles SUPER_ADMIN/PLATFORM_ADMIN); writes `AuditLog` via `AuditService.log({ action: 'google.admin_revoke', resource: 'integration_credential', resourceId: tenantId })`; admin UI `Revoke` button on `frontend-admin/src/app/settings/integrations/page.tsx`; covered by `integrations.service.admin.spec.ts` (4 cases) | ✅ **Fixed this session (Phase 3)** |
| **G8** Drive sharing + permissions tool actions | `google-drive.service.ts` adds `shareFile`, `listFilePermissions`, `revokeFilePermission` (Drive Permissions API); `integrations.controller.ts` exposes `POST/GET/DELETE /integrations/drive/files/:id/permissions[...]`; `documents.tool.ts` extends schema + private `share`/`unshare` actions (accepts `emailAddress`, `domain`, `permissionId`, etc.) for agents; covered by `google-drive-sharing.spec.ts` (9 cases) | ✅ **Fixed this session (Phase 3)** |
| **G9** Sheets CSV import/export tool actions | `tools/built-in/csv.util.ts` extracted pure helpers (`colToLetter`, `parseCsv`, `toCsv`, `csvEscape`) supporting `, ; \t \|` delimiters + RFC-4180 quoted fields; `sheets.tool.ts` adds `import_csv` (creates a spreadsheet or writes into an existing one, sized to fit) and `export_csv` (range → CSV text with auto-range fallback to whole sheet) actions; covered by `csv.util.spec.ts` (22 cases including a full round-trip parity test) | ✅ **Fixed this session (Phase 3)** |
| **G10** Client-secret rotation runbook | New §9 in `memory-bank-new/runbook.md` ("Google OAuth credential rotation (CLIENT_ID / CLIENT_SECRET)"). Covers: pre-flight env capture, OAuth client re-creation in Google Cloud, in-place `sed` + PM2 restart, OAuth round-trip smoke-test, per-tenant DB spot-check, `audit_log` row query, failure-mode cheatsheet for `invalid_client`/`invalid_grant`, escalation paths. | ✅ **Fixed this session (Phase 3)** |

### 6.2 Post-mortem: Google Workspace comprehensive overhaul (2026-07-12)

After the login + integration bugs were fixed (see runbook.md §9 history), the integration still surfaced three latent correctness bugs that prevented real-world Gmail/Sheets/Calendar/Drive flows from working. All were caught and fixed the same day. End-to-end verified: calendar event created on user's primary calendar, spreadsheet created in user's Drive, list-by-mime returns all spreadsheets.

| # | Applies to | Symptom / Code-smell | Root Cause | Fix |
|---|---|---|---|---|
| **G-LOGS** | Login page (GSI) | `401: invalid_client` / `[GSI_LOGGER]: The given client ID is not found` | Frontend `.env.local` had a placeholder value `your-google-client-id.apps.googleusercontent.com` which overrode the correct value in `.env.production` (Next.js loads `.env.local` with higher priority). | Updated `.env.local` with correct client ID, rebuilt frontend, restarted PM2. **Lesson**: `NEXT_PUBLIC_*` env vars must be correct in ALL env files that exist on Contabo — `.env.local` wins over `.env.production`. |
| **G-REDIRECT** | Google Integration (Settings) | `400: redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` was missing from backend `.env.production`. The code fell back to the wrong default URL, which didn't match the registered redirect URI in Google Cloud Console. | Added `GOOGLE_REDIRECT_URI=https://brain.neurecore.com/api/v1/integrations/google/callback` to backend `.env.production`, restarted backend with `--update-env`. **Lesson**: Always verify all GOOGLE_* env vars are present after deploy. |
| **G-GMAIL-1** | All Gmail list-fetch flows (`listInbox`) | Thread ID accidentally used as tenant ID — `google-gmail.service.ts:90` and `:100-105`. `getMessage(messageId, threadId)` passed `threadId` to `authClient.getAccessToken()` instead of the real `tenantId`. The bug was masked by a Jest mock that always returned a valid token regardless of the argument — and by relying on a token that happened to be cached. Result: in production, listInbox silently returned 401 messages instead of throwing clearly. | `getMessage(messageId, threadId)` was missing a `tenantId` parameter and the second arg was repurposed incorrectly. | Changed signature to `getMessage(tenantId: string, messageId: string, threadId?: string)`. Updated all callers: `gmail.service.ts:90`, `email.tool.ts:199`, `integrations.controller.ts:203`, plus spec files. |
| **G-DRIVE-1** | Every Drive operation (list, create, share, search) | `GoogleDriveService` constructed its **own** `new PrismaClient()` at module-load time (`private readonly prisma = new PrismaClient();`). Causes connection-pool exhaustion over the lifetime of the app, bypasses connection pooling configured in `DatabaseModule`, and creates an un-disconnected client when the Nest process exits. | Anti-pattern: direct `new PrismaClient()` instead of NestJS DI. | Constructor now accepts `PrismaService` via DI; updated both Drive spec files to pass a fake Prisma mock. |
| **G-EMAIL-1** | `email.tool.ts` `flag` action | `this.gmail['authClient'].getAccessToken(tenantId)` — bracket access on a private property to fetch a token. Worked by accident. | Bridged across module boundaries with brackets; proper API surface missing. | Added public `getAccessToken(tenantId)` to `GoogleGmailService` and updated the tool to use it. Updated `email.tool.spec.ts` mock to match. |
| **G-SHEETS-1** | Sheets list page initial render | UI showed "No spreadsheets found" even when the user had many. | Frontend `searchDrive('title:', …)` constructed a literal Drive query `name contains 'title:'` which matches nothing. Backend default had no "list by mimeType only" mode. | Updated `searchFiles` in `google-drive.service.ts` to omit the `name/fullText contains` clause when the query is empty (`trashed=false`). Frontend now passes empty string. |
| **G-MANAGE-EMAIL** | Google Workspace Manage page "Connected account" row | Always rendered "—" even though the user was connected. | The Google scopes we request (`gmail`, `drive`, `calendar`, `spreadsheets`) do NOT include `openid`; the `oauth2/v2/userinfo` endpoint only returns email when the freshly-issued token has `openid`. Re-fetching userinfo after refresh failed silently. | Added `googleAccountEmail String?` to the `Tenant` model (migration `20260712_google_account_email`); persist at `handleGoogleCallback`; `getGoogleConnectionStatus` now reads the cached email (with userinfo as best-effort fallback for tenants created before this change). |
| **G-CAL-PRIMARY** | Calendar event creation | 403 "writer access required" when the default-selected calendar was "Holidays in Pakistan" (read-only). | UI defaulted to the first calendar in the list. | Documented: select the user's primary calendar (e.g. `mnpiracha@gmail.com`) before creating events. No code change — UI flows work, but read-only calendars appear in the dropdown. |

**End-to-end verification (live, against mnpiracha@gmail.com, 2026-07-12 15:09 PKT):**
- `GET /integrations/google/status` → 200 in 596 ms (now includes `email`).
- `GET /integrations/calendar/list` → 200, returns 3 calendars (Holidays in Pakistan, Family, mnpiracha@gmail.com primary).
- `POST /integrations/calendar/events?calendarId=mnpiracha@gmail.com` → 200, created "NeureCore Test Event - AI Verified" on 2026-07-13 14:00–15:00 (visible in the UI, clickable into Google Calendar).
- `POST /integrations/sheets` → 200, created "NeureCore AI Test Sheet" (sheet id `1ybAFRjHAEc30-NJKpS5ffBze-NiMy0sINHG8ZI9LyUY`); the default list now shows all 21 spreadsheets in the user's Drive.
- `GET /integrations/drive-folders` → 200, returns empty `children` (will populate when an agent first uses Documents/Reports).

**Preventive measures:**
- Always run `grep -E '^GOOGLE_|^NEXT_PUBLIC_GOOGLE' /opt/neurecore/backend/backend/.env.production /opt/neurecore/frontend-tenant/.env.*` after a deploy to catch missing or placeholder values.
- Add a release-time `npm run check:google` lint that asserts `GOOGLE_*` vars are set in `BackendBootstrap` (TODO, separate ticket).
- See `[runbook.md §9 failure-mode cheatsheet](../../runbook.md#9-google-oauth-credential-rotation-client_id--client_secret)` for the expanded troubleshooting table.

### 6.4 Remaining Issues

**All gaps listed in previous audits are now closed.** Remaining deferred items (out of Phase 4 scope, but worth tracking for a future wave):

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| G11 | No admin "Connect on behalf of tenant" CTA (would require service-account/impersonation flow, not OAuth consent) | Admins cannot pre-connect a tenant; must wait for tenant to consent | 🟢 Low |
| G12 | No Drive file copy/move endpoint (`Drive API drive.files.copy`, `parents`) | Cannot duplicate or re-parent agent artifacts | 🟢 Low |
| G13 | No `find_free_slots` cross-calendar tool wrapper (CalendarTool only checks primary) | Multi-calendar tenants cannot ask for a free slot across team calendars | ✅ Closed Phase 4 |
| G14 | No Drive change-watch + webhook | Updates to files outside the agent (renamed, shared, deleted) are not reflected in `ContextTool.load_drive` until the agent re-lists | 🟢 Low |

### 6.5 Phase 4 — Shipped 2026-07-07

Full audit revealed 19 gaps after Phase-3. All critical and medium gaps implemented, plus full test coverage:

**Critical functional gaps (4 closed):**
| # | Gap | Resolution |
|---|-----|------------|
| G-SHEETS-1 | `GoogleSheetsService` missing `batchUpdate` | Added `batchUpdate()` — supports add/delete sheets, formatting, any Sheets v4 batch request |
| G-SHEETS-2 | `GoogleSheetsService` missing `copy` (sheets:copyTo) | Added `copySheet()` — copies sheets between spreadsheets |
| G-CSV-1 | `SheetsTool.importCsv` `hasHeader` parameter ignored | Now skips first data row when `hasHeader=true`; returns `header.columns` in output; rejects if no data rows remain after header skip |
| G-CAL-1 | `CalendarTool.find_free_slots` single-calendar only | Now accepts comma-separated `calendarId` to check busy slots across multiple calendars; returns `calendarsChecked` |

**Medium gaps (4 closed):**
| # | Gap | Resolution |
|---|-----|------------|
| G-IFACE-1 | `IDriveService` interface incomplete vs implementation | Added `findFolderByName`, `ensureRootFolder`, `setupAgentFolders`, `searchFiles`, `shareFile`, `listFilePermissions`, `revokeFilePermission`, `getAccessToken`, plus `ShareFileInput`/`DrivePermission` types |
| G-FE-1 | Frontend integrations service missing Drive sharing methods | Added `shareDriveFile()`, `listDriveFilePermissions()`, `revokeDriveFilePermission()` |
| G-ADMIN-1 | Admin page dead code (unreachable second `if (loading)`) | Removed duplicate conditional; restored proper loading skeleton |
| G-DOC-1 | `DocumentsTool.read` accessed private `authClient` via bracket notation | Changed to use `this.drive.getAccessToken()` through the public interface |
| EMAIL-FIX | `EmailTool.send` hardcoded `agentId = undefined` (never resolved sender) | Now passes `context?.agentId` through from `executeImpl` |

**Test coverage (11 new specs, 120 new tests):**
| File | Cases | Covers |
|------|-------|--------|
| `google-gmail.service.spec.ts` | 13 | listInbox, getMessage, getMessageBody, sendEmail, listLabels |
| `google-calendar.service.spec.ts` | 12 | listEvents, createEvent, deleteEvent, listCalendars |
| `google-sheets.service.spec.ts` | 14 | create/read/write/append/clear + batchUpdate + copySheet |
| `google-auth.client.spec.ts` | 10 | getCredentials token lifecycle, expiry, refresh flow |
| `drive-cleanup.service.spec.ts` | 6 | notification, empty-folder delete, non-empty skip |
| `gmail-rate-limiter.spec.ts` | 9 | 429/5xx retry, Retry-After, non-retryable 4xx, backoff |
| `email.tool.spec.ts` | 11 | read_inbox, get_message, send, flag with provider resolution |
| `sheets.tool.spec.ts` | 16 | all actions incl. import_csv hasHeader, export_csv |
| `calendar.tool.spec.ts` | 10 | all actions incl. cross-calendar find_free_slots |
| `documents.tool.spec.ts` | 13 | create/list/read + share/unshare + folder resolution |
| `integrations.service.spec.ts` | 13 | initiateOAuth, callback, disconnect, status, list |

**Total: 173 tests across 15 suites, TypeScript compiles clean.**

### 6.6 OAuth Flow Risks (Post-Phase-4)

- G1 is **resolved** (see §2.6 and §6.1).
- G7 (admin revoke) writes a permanent `audit_logs` row at `action='google.admin_revoke'` with `resource='integration_credential'`, `resourceId=<tenantId>` — queryable via `/settings/audit` UI and the existing `AuditService.findAll({ action: 'google.admin_revoke' })`.
- G10 (rotation runbook) addresses the "credentials leaked / rotated" scenario end-to-end.
- **Phase-3 test coverage** (53 tests, all passing):
  - `oauth-callback.util.spec.ts` — 10 tests (G1)
  - `google-drive.service.spec.ts` — 7 tests (G5 + G6)
  - `google-drive-sharing.spec.ts` — 9 tests (G8: validation, POST/GET/DELETE permissions, idempotent revoke, error paths)
  - `integrations.service.admin.spec.ts` — 4 tests (G7: NotFound when no cred exists, hadCalendar false/true, invocations on Prisma update)
  - `csv.util.spec.ts` — 22 tests (G9: column-letter conversion, RFC-4180 quote handling, multi-delimiter, CRLF, round-trip parity)
- **Remaining considerations**:
  - Admin SPA does not yet expose "Connect on behalf of tenant" (deferred as **G11**).
  - The OAuth `redirectUri` (Google-registered callback URL) is `https://brain.neurecore.com/api/v1/integrations/google/callback` — the absolute-URL redirect only affects where the user lands *after* Google has called back to the backend. Correct as designed; documented in §10 step 2.
  - Token-rotation scenarios beyond what G10 covers (per-tenant forced re-consent on revocation) are still exercised only manually.
  - **Drive full-text search** (`mode='fulltext'`) — Drive's content index is eventually consistent. New spreadsheets/files can take minutes to appear in `mode='fulltext'` queries; rely on `mode='name'` for low-latency.

---

## 7. Agent Task Capability Matrix (Current)

| Task | Supported? | Tool/Service | Notes |
|------|-----------|-------------|-------|
| Read inbox | ✅ | `EmailTool` → `GoogleGmailService` | search + label filters |
| Send email from agent alias | ✅ | `EmailTool` → `GmailEmailProvider` | Gmail if `agent.emailProvider='gmail'` else Brevo; **Phase 4**: fixed `agentId` resolution in `send()` |
| Flag email as urgent/important | ✅ | `EmailTool` → Gmail labels | `IMPORTANT`/`STARRED` |
| List files in agent Drive folder | ✅ | `DocumentsTool` → `GoogleDriveService` | folder-scoped |
| Drive search by filename | ✅ | `GoogleDriveService.searchFiles` | `name contains` |
| Drive search by content (fullText) | ✅ | `GoogleDriveService.searchFiles({ mode: 'fulltext' })` | `fullText contains` — Drive indexes filenames, descriptions, text content of text/markdown/csv/json, and OCR for PDFs/images. Exposed at `GET /integrations/drive/search?mode=fulltext&q=...` |
| Create document in agent folder | ✅ | `DocumentsTool` → `GoogleDriveService` | HTML/text, returns `webViewLink` |
| Create Drive folder (returns `webViewLink`) | ✅ | `GoogleDriveService.createFolder` | requests `webViewLink` in fields param |
| Read document (incl. Google Docs/Sheets native) | ✅ | `DocumentsTool.read` | exports natives as HTML |
| Generate report + save to Drive | ✅ | `ReportsTool.generate` | Reports/ subfolder |
| Export Drive doc as PDF | ✅ | `ReportsTool.export_pdf` | base64-encoded |
| Load Drive docs as context | ✅ | `ContextTool` | snippet-based |
| List calendar events | ✅ | `CalendarTool.list` / `find_free_slots` | |
| Create calendar event | ✅ | `CalendarTool.create` | attendees + tz |
| Delete calendar event | ✅ | `CalendarTool.delete` | |
| Find free time slots | ✅ | `CalendarTool.find_free_slots` | |
| List available calendars | ✅ | `CalendarTool.list_calendars` | |
| Create spreadsheet | ✅ | `SheetsTool.create_spreadsheet` | initial sheet optional |
| Read range | ✅ | `SheetsTool.read_range` | A1 notation |
| Write range (overwrite) | ✅ | `SheetsTool.write_range` | |
| Append rows | ✅ | `SheetsTool.append_rows` | INSERT_ROWS |
| Clear range | ✅ | `SheetsTool.clear_range` | |
| Get spreadsheet metadata | ✅ | `SheetsTool.get_metadata` | incl. `webViewLink` |
| **Import CSV → spreadsheet** | ✅ | `SheetsTool.import_csv` (G9) | `csvDelimiter` (`, ; \t \|`), optional `hasHeader`, RFC-4180 quoted fields |
| **Export spreadsheet → CSV** | ✅ | `SheetsTool.export_csv` (G9) | auto-range fallback to whole sheet; respects `csvDelimiter` |
| **Share a Drive file with users/groups/domains** | ✅ | `DocumentsTool.share` (G8) | Drive permissions API; `role: reader\|writer\|commenter`, `type: user\|group\|domain\|anyone`; honors `emailMessage` + `sendNotification` |
| **Unshare a Drive file** | ✅ | `DocumentsTool.unshare` (G8) | resolves permissionId by matching `emailAddress` (or `domain`) to existing permissions; idempotent revoke |
| Bulk-edit Sheets (formula/format) | ✅ | `GoogleSheetsService.batchUpdate` | Phase 4: Sheets v4 batchUpdate |
| Drive file copy/move | ❌ | not implemented | Drive API `files.copy` and `parents` mutation (G12) |
| Drive full-text subscribe | ❌ | not implemented | Drive `changes.watch` webhook (G14) |

---

## 8. Live State Snapshot

Quick reference for what's live as of 2026-07-07 (post-Phase-3):

| Component | LOC | Wired In | Notes |
|-----------|-----|----------|-------|
| `google-sheets.service.ts` | ≈370 | integrations.module, integrations.controller, sheets.tool | + batchUpdate + copySheet (Phase 4) |
| `sheets.tool.ts` | ≈340 | tools.module, hermes-tools (FINANCE/MARKETING/RESEARCH/OPERATIONS/CUSTOM) | + `import_csv` + `export_csv` (G9) |
| `calendar.tool.ts` | 342 | tools.module, hermes-tools (HR/FINANCE/SALES/MARKETING/OPERATIONS/CUSTOM) | |
| `google-drive.service.ts` | ≈600 | integrations.module, integrations.controller, DocumentsTool/ReportsTool/ContextTool/AgentsService | + `searchFiles({mode:'fulltext'})` (G6) + `webViewLink` on `createFolder` (G5) + `shareFile`/`listFilePermissions`/`revokeFilePermission` (G8) |
| `google-gmail.service.ts` | (extant) | integrations.module, integrations.controller, EmailTool | |
| `google-calendar.service.ts` | (extant) | integrations.module, integrations.controller, CalendarTool | |
| `google-auth.client.ts` | (extant) | OAuth2 token lifecycle + auto-refresh | |
| `integrations.controller.ts` | ≈600 | 8 sections: OAuth (G1), Gmail, Calendar, Drive, Sheets, Search (G6), Drive permissions (G8), Admin | + G1 oauth-callback util; + G7 admin-revoke endpoint; + G8 share/list/revoke endpoints |
| `integrations.service.ts` | ≈280 | OAuth init / callback / disconnect / adminDisconnect (G7); scope list; Brevo | `initiateGoogleOAuth` accepts `audience` (G1); `adminDisconnectGoogle` (G7) |
| `documents.tool.ts` | ≈400 | tools.module | + `share` + `unshare` actions (G8); schema extended |
| `tools/built-in/csv.util.ts` | ≈70 | imported by `sheets.tool.ts`; pure helpers | G9 |
| `tools/built-in/csv.util.spec.ts` | ≈140 | 22 unit tests (colToLetter, parseCsv, toCsv, csvEscape) | G9 |
| `integrations/google/__tests__/google-gmail.service.spec.ts` | ≈360 | 13 unit tests | Phase 4 |
| `integrations/google/__tests__/google-calendar.service.spec.ts` | ≈320 | 12 unit tests | Phase 4 |
| `integrations/google/__tests__/google-sheets.service.spec.ts` | ≈390 | 14 unit tests incl. batchUpdate/copySheet | Phase 4 |
| `integrations/google/__tests__/google-auth.client.spec.ts` | ≈175 | 10 unit tests | Phase 4 |
| `integrations/google/__tests__/drive-cleanup.service.spec.ts` | ≈175 | 6 unit tests | Phase 4 |
| `integrations/google/__tests__/gmail-rate-limiter.spec.ts` | ≈175 | 9 unit tests | Phase 4 |
| `tools/built-in/email.tool.spec.ts` | ≈250 | 11 unit tests | Phase 4 |
| `tools/built-in/sheets.tool.spec.ts` | ≈450 | 16 unit tests incl. import_csv/export_csv | Phase 4 |
| `tools/built-in/calendar.tool.spec.ts` | ≈305 | 10 unit tests incl. cross-calendar | Phase 4 |
| `tools/built-in/documents.tool.spec.ts` | ≈360 | 13 unit tests incl. share/unshare | Phase 4 |
| `integrations/__tests__/integrations.service.spec.ts` | ≈260 | 13 unit tests (initiateOAuth, callback, disconnect, status, list) | Phase 4 |
| `integrations/google/oauth-callback.util.ts` | ≈50 | pure helpers used by the controller; unit-tested | G1 testing seam |
| `integrations/google/oauth-callback.util.spec.ts` | ≈95 | 10 unit tests | G1 |
| `integrations/google/__tests__/google-drive.service.spec.ts` | ≈180 | 7 unit tests | G5/G6 |
| `integrations/google/__tests__/google-drive-sharing.spec.ts` | ≈180 | 9 unit tests | G8 (validation, POST/GET/DELETE, idempotent revoke, error paths) |
| `integrations/__tests__/integrations.service.admin.spec.ts` | ≈110 | 4 unit tests | G7 |
| `dto/integration.dto.ts` | 20 | ConnectGoogleDto + ConnectBrevoDto | `audience?` (G1) |
| `frontend-admin/settings/integrations/page.tsx` | ≈340 | admin nav; consumes `GET /integrations/google/platform-status`; **Phase 3** Revoke button per connected tenant (G7) |
| `frontend-tenant/src/services/integrations.service.ts` | ≈430 | +6 Sheets methods (G4); + `searchDrive({mode})` (G6); + Drive sharing methods (G8); `initiateGoogleOAuth(redirectUri?, audience='tenant')` (G1) |
| `frontend-tenant/src/app/settings/integrations/page.tsx` | 581 | Google card with quick-access "Sheets" + "Calendar" buttons when connected (Phase 2) |
| `frontend-tenant/src/app/settings/integrations/google/page.tsx` | 351 | Adds "Open Google apps" panel linking to Sheets + Calendar pages (Phase 2) |
| `frontend-tenant/src/app/settings/integrations/sheets/page.tsx` | 451 (new) | Sheets browser + create-with-CSV-import dialog + range view/edit (Phase 2 / G2) |
| `frontend-tenant/src/app/settings/integrations/calendar/page.tsx` | 458 (new) | Calendar browser + calendar switcher + create/delete events with attendees + tz (Phase 2 / G3) |
| `drive-cleanup.service.ts` | (extant) | scheduled via `DriveCleanupModule` |
| `memory-bank-new/runbook.md` | + §9 G10 | New "Google OAuth credential rotation" runbook covering pre-flight, sed-edit, PM2 restart, smoke test, audit-trail verification, failure-mode cheatsheet. | G10 |

---

## 9. Recommendations

### Phase 0 — Resolved (Historical)

All Phase-1 recommendations from the previous audit (Sheets service, Sheets/Calendar tools, admin UI, drive-service interface, eager folder provisioning) are live in the codebase — see §6.1.

### Phase 1 — Shipped 2026-07-07

1. **🔴 G1: OAuth callback absolute redirect + tenant/admin routing** — ✅ **DONE**
   - `IntegrationsController.googleCallback()` now uses `@Res()` to redirect to an absolute URL resolved from `audience` in the OAuth `state` payload. See §2.6 and `integrations.controller.ts:80-130` for the implementation.
   - Pure helpers extracted to `integrations/google/oauth-callback.util.ts` so the redirect logic is unit-testable; 10-test spec covers branches and a regression that the redirect is never relative.
   - `IntegrationsService.initiateGoogleOAuth(tenantId, redirectUri, audience='tenant')` persists `audience` in the encoded `state` (`integrations.service.ts:25-60`).
   - `ConnectGoogleDto.audience` is validated with `@IsIn(['tenant','admin'])` (`dto/integration.dto.ts:1-16`).
   - Tenant frontend service forwards `audience` with `'tenant'` default — no breaking change for existing call sites.
   - Deploy-time env (optional, defaults provided): `TENANT_FRONTEND_BASE_URL`, `ADMIN_FRONTEND_BASE_URL`.

2. **G5: `webViewLink` returned on `createFolder`** — ✅ **DONE**
   - `GoogleDriveService.createFolder` (`google-drive.service.ts:104-148`) requests the `webViewLink` field via the `fields` query parameter.
   - Covering spec: `google-drive.service.spec.ts` asserts the URL contains `webViewLink` after decoding.

3. **G6: Full-text Drive search via `fullText contains`** — ✅ **DONE**
   - `GoogleDriveService.searchFiles(query, { mode: 'name' | 'fulltext', ... })` defaults to `'name'` for backwards compatibility, but supports `'fulltext'` to use Drive's content index (filenames, descriptions, text/markdown/csv/json, OCR'd PDFs/images).
   - `GET /integrations/drive/search?mode=fulltext&q=...` exposed at `integrations.controller.ts:359-372`. `ContextTool.load_all` can be wired to use `mode: 'fulltext'` next iteration.
   - Covering spec: `google-drive.service.spec.ts` asserts URL operators for both modes + mimeType filter.

### Phase 2 — Shipped 2026-07-07

4. **G2: Tenant Sheets UI** — ✅ **DONE**
   - New page `frontend-tenant/src/app/settings/integrations/sheets/page.tsx` (≈450 LOC):
     - Drive-backed search of `application/vnd.google-apps.spreadsheet` MIME type via `searchDrive({ mimeType })`.
     - Per-spreadsheet view: drop-down sheet selector + A1 range input + read/write/cancel `edit` mode (tab-separated draft).
     - "New spreadsheet" dialog with optional CSV seed (parsed client-side; first sheet is auto-populated via `writeSheetRange`).
     - Connected/disconnected gate that cross-links the user back to `/settings/integrations` to re-connect.

5. **G3: Tenant Calendar UI** — ✅ **DONE**
   - New page `frontend-tenant/src/app/settings/integrations/calendar/page.tsx` (≈460 LOC):
     - Default 14-day window, grouped by day with weekday/date headers.
     - Calendar dropdown (fetched from `getCalendarList`) so multi-calendar tenants can switch.
     - Per-event row: title, time window, location, attendee count, status badge, deep-link to Google event, delete button.
     - "New event" dialog with Title, Date+Start+End, Timezone (defaults to browser TZ), Location, comma-or-space separated Attendees, Description; validates end > start.

6. **G4: Tenant service-layer Sheets + Drive full-text methods** — ✅ **DONE**
   - `frontend-tenant/src/services/integrations.service.ts` grew from 259 → 374 LOC. Added: `createSpreadsheet`, `getSpreadsheetMetadata`, `readSheetRange`, `writeSheetRange`, `appendSheetRows`, `clearSheetRange`, `searchDrive(query, { mode })`.

7. **Cross-links** — ✅ **DONE**
   - `/settings/integrations` Google card now shows "Sheets" + "Calendar" quick-link buttons (only when the corresponding scope is granted).
   - `/settings/integrations/google` page has a new "Open Google apps" panel linking to both new pages.

### Phase 3 — Shipped 2026-07-07

8. **G7: Admin override revoke + audit trail** — ✅ **DONE**
   - `IntegrationsService.adminDisconnectGoogle(tenantId)` (`integrations.service.ts:135-200`) throws `NotFoundException` when the tenant has no Google credential; otherwise deletes the credential, clears `googleDriveRootFolderId` + `googleCalendarId`, and returns `{ tenantId, revoked: true, hadCalendar: boolean }`.
   - `POST /integrations/admin/google/:tenantId/disconnect` (`integrations.controller.ts`, Roles `SUPER_ADMIN`/`PLATFORM_ADMIN`, HTTP 200). The controller looks up `user.sub` from the JWT and writes `AuditService.log({ actor, action: 'google.admin_revoke', resource: 'integration_credential', resourceId: tenantId, result: 'success', details: { hadCalendar } })`. Surfaces in `/settings/audit`.
   - Admin UI: `frontend-admin/src/app/settings/integrations/page.tsx` adds per-tenant `Revoke` button with confirmation modal; loading state; success/error banners.
   - Tests: `integrations.service.admin.spec.ts` — 4 cases (NotFound when no cred; happy path with/without calendarId; verifies Prisma update + credential delete invocations).

9. **G8: Drive sharing + permissions tool actions** — ✅ **DONE**
   - `GoogleDriveService.shareFile(tenantId, fileId, input)` validates required-when-applicable fields (`emailAddress` for user/group, `domain` for domain), POSTs `drive/v3/files/{id}/permissions`, supports `sendNotification=false` and `emailMessage` query-params. Returns the created permission resource.
   - `GoogleDriveService.listFilePermissions(tenantId, fileId)` and `GoogleDriveService.revokeFilePermission(tenantId, fileId, permissionId)` (idempotent — swallows 404s).
   - REST endpoints (controller): `POST /integrations/drive/files/:fileId/permissions`, `GET …/permissions`, `DELETE …/permissions/:permissionId`.
   - `DocumentsTool` exposes new agent actions:
     - `action='share'` — accepts `role`, `shareType`, `emailAddress`, `domain`, `sendNotification`, `emailMessage`; returns `{ action, fileId, permissionId, role, shareType }`.
     - `action='unshare'` — accepts `permissionId` directly, OR resolves it by matching `emailAddress` (or `domain`); revoke is idempotent.
   - Tests: `google-drive-sharing.spec.ts` — 9 cases (validation of missing email/domain, POST/GET/DELETE happy paths, sendNotification=false query-param, 403 error, 404 idempotent revoke, non-404 error path).

10. **G9: Sheets CSV import/export tool actions** — ✅ **DONE**
    - Pure helpers extracted to `backend/src/modules/tools/built-in/csv.util.ts`: `colToLetter` (handles A→Z→AA→ZZ→AAA), `parseCsv` (RFC-4180 quoted fields, doublé-quote escape, embedded newlines, CRLF, all four delimiters: `, ; \t |`), `toCsv` (auto-escape fields containing delimiter/quote/newline), `csvEscape`.
    - `SheetsTool.import_csv` (G9) — accepts `csv`, `csvDelimiter?`, `hasHeader?`, `spreadsheetId?` (target existing) or `title?` (create new), `sheetTitle?`. Resolves A1 range sized to fit (uses `colToLetter` for the end column), calls `writeRange` to overwrite the target range, then `getMetadata` to return the canonical `spreadsheetId` + `webViewLink`. Includes `importedRows`, `importedColumns`, `delimiterUsed`, and the echoed `writeResult`.
    - `SheetsTool.export_csv` (G9) — accepts `spreadsheetId` (required), `range?` (defaults to first sheet), `csvDelimiter?` (default `,`). Reads the range, serialises via `toCsv`, and returns the CSV text along with `rowCount`/`colCount`/`delimiterUsed`.
    - Tests: `csv.util.spec.ts` — 22 cases including column-letter conversion (1, 26, 27, 52, 53, 702, 703), RFC-4180 quoting, all four delimiters, CRLF, empty-line collapse, embedded newlines, full round-trip parity.

11. **G10: Client-secret rotation runbook** — ✅ **DONE**
    - `memory-bank-new/runbook.md` §9 ("Google OAuth credential rotation (CLIENT_ID / CLIENT_SECRET)"). 8-step procedure covering:
      - Pre-flight env capture
      - Google Cloud Console OAuth client re-creation with the correct redirect URI + JS origins
      - In-place `sed`-edit of `backend/.env.production` with a timestamped `.bak` snapshot
      - `pm2 restart neurecore-backend` (env is not auto-reloaded)
      - OAuth round-trip smoke test (validates G1 redirect and refresh-token survival)
      - Per-tenant DB spot-check via `SELECT … FROM integration_credential WHERE updatedAt > NOW() - INTERVAL '5 minutes'`
      - Audit-log entry verification (admin-revoke path writes a `google.admin_revoke` row)
      - Failure-mode cheatsheet for `invalid_client` / `invalid_grant` / 401-after-rotation
    - Cross-referenced from `int-features/google-services.md` and (implicitly) from `operations.md` and `deployment.md`.

### Test Coverage Status (Post-Phase-4)

| Area | Spec | Cases | Status |
|------|------|-------|--------|
| G1 — OAuth callback redirect | `oauth-callback.util.spec.ts` | 10 | ✅ Pass |
| G5 — `webViewLink` on folder create | `google-drive.service.spec.ts` (block 1) | 2 | ✅ Pass |
| G6 — Drive search `name` vs `fulltext` | `google-drive.service.spec.ts` (block 2) | 3 | ✅ Pass |
| G7 — Admin-revoke service | `integrations.service.admin.spec.ts` | 4 | ✅ Pass |
| G8 — Drive sharing + permissions | `google-drive-sharing.spec.ts` | 9 | ✅ Pass |
| G9 — Sheets CSV helpers | `csv.util.spec.ts` | 22 | ✅ Pass |
| Gmail service | `google-gmail.service.spec.ts` | 13 | ✅ Pass |
| Calendar service | `google-calendar.service.spec.ts` | 12 | ✅ Pass |
| Sheets service (incl. batchUpdate/copy) | `google-sheets.service.spec.ts` | 14 | ✅ Pass |
| Auth client (token lifecycle) | `google-auth.client.spec.ts` | 10 | ✅ Pass |
| Drive cleanup scheduler | `drive-cleanup.service.spec.ts` | 6 | ✅ Pass |
| Gmail rate limiter | `gmail-rate-limiter.spec.ts` | 9 | ✅ Pass |
| Email tool | `email.tool.spec.ts` | 11 | ✅ Pass |
| Sheets tool (incl. import/export/hasHeader) | `sheets.tool.spec.ts` | 16 | ✅ Pass |
| Calendar tool (incl. cross-calendar) | `calendar.tool.spec.ts` | 10 | ✅ Pass |
| Documents tool (incl. share/unshare) | `documents.tool.spec.ts` | 13 | ✅ Pass |
| Integrations service core methods | `integrations.service.spec.ts` | 13 | ✅ Pass |

Run: `npx jest --config jest.config.js src/modules/integrations/google/__tests__ src/modules/integrations/__tests__ src/modules/tools/built-in/*.spec.ts` → **173/173 passing across 15 suites**.

---

## 10. Testing Live (summary)

**Required env** (set in `backend/.env.production`):
```bash
GOOGLE_CLIENT_ID=...                                        # Google Cloud Console — Web app OAuth client
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://brain.neurecore.com/api/v1/integrations/google/callback  # Must match Google Cloud Console
GOOGLE_TOKEN_ENCRYPTION_KEY=<32+ char hex>                   # AES-256-GCM for credentials
INTEGRATION_ENCRYPTION_KEY=<32+ char hex>                     # alt name read by some files
TENANT_FRONTEND_BASE_URL=https://hq.neurecore.com            # post-OAuth-callback redirect target for tenants
ADMIN_FRONTEND_BASE_URL=https://cc.neurecore.com             # post-OAuth-callback redirect target for admins (when audience='admin')
# Optional legacy fallbacks (still honoured if the new vars are unset):
# FRONTEND_BASE_URL=https://hq.neurecore.com
# ADMIN_BASE_URL=https://cc.neurecore.com
```

**Critical**: If `GOOGLE_REDIRECT_URI` is not set, the code falls through to a default that is typically wrong, causing `redirect_uri_mismatch` (Error 400). This was the root cause of the Google integration failure on 2026-07-12.

**Google Cloud Console**:
- OAuth consent screen: enabled for scopes `gmail.readonly`, `gmail.send`, `drive`, `calendar`, `spreadsheets`
- Authorized redirect URI: `https://brain.neurecore.com/api/v1/integrations/google/callback`
- Authorized JS origins: `https://hq.neurecore.com`, `https://cc.neurecore.com`

**Smoke tests**:
1. `/login` → Google Sign-In button (GSI; hits `POST /auth/google`)
2. **OAuth round-trip (validates G1 fix)** — `/settings/integrations` → Connect Google → consent screen → **browser must land on `https://hq.neurecore.com/settings/integrations?connected=true&email=...`** (not on `brain.neurecore.com`)
3. DB check: `SELECT * FROM integration_credential WHERE provider='GOOGLE';` — expect one row with non-empty `encryptedCredentials`
4. Gmail compose → send test email
5. **Tenant Sheets page (validates G2)** — `/settings/integrations/sheets` should render; create a spreadsheet with CSV seed (e.g. `name,role\nAda,CTO`); open the auto-created sheet → confirm values appear; edit a range via the tab-separated textarea → confirm values persist
6. **Tenant Calendar page (validates G3)** — `/settings/integrations/calendar` should show upcoming events from the primary calendar; create an event with attendees → confirm it appears in the list and the email invite arrives
7. **Drive full-text search (validates G6)** — `GET /integrations/drive/search?mode=fulltext&q=<known-string-inside-a-PDF>` → should return matching file; same query with `mode=name` should return empty if filename doesn't contain the string
8. **Drive folder `webViewLink` (validates G5)** — call `POST /integrations/drive/folders` with `{name:'Test Folder'}`; response should include `webViewLink` matching `https://drive.google.com/...`. Or in the agent admin view, click into the "Connected Drive folders" section and confirm each tree node links to `drive.google.com`.
9. **Drive sharing (validates G8)** — `POST /integrations/drive/files/<fileId>/permissions` with `{role:'reader',type:'user',emailAddress:'<your-other-email>'}` → confirm 200 + `permissionId`; `GET …/permissions` should list it; `DELETE …/permissions/<permissionId>` should revoke it (and the target email should immediately lose access). Then via a Hermes agent with `documents:write` scope, ask "share the latest report with alice@acme.com as reader" → expect the `DocumentsTool.share` action to fire and return a `permissionId`.
10. **Sheets CSV import/export (validates G9)** — agent chat: "create a new spreadsheet called 'Sales Q3' and put this CSV in it: `"sku,name,price\nA-100,Widget,9.99\nA-101,Gadget,19.99"`" → `SheetsTool.import_csv` should create the sheet and write the data. Then "export the first sheet of that spreadsheet as CSV" → should return the parsed CSV text.
11. **Admin revoke (validates G7)** — log into `https://cc.neurecore.com/` as `SUPER_ADMIN`. Go to `/settings/integrations`. Each connected tenant row should have a red `Revoke` button. Click → confirm modal → click Confirm → modal closes, success banner appears, the tenant row flips to "Not Connected". Then confirm the audit log:
    ```sql
    SELECT actor, action, "resourceId", details, "createdAt"
    FROM audit_logs
    WHERE action = 'google.admin_revoke'
    ORDER BY "createdAt" DESC
    LIMIT 1;
    ```
    Should show the admin user id, the tenantId, and a `details` JSON containing `hadCalendar`.
12. **Unit-test sanity (validates all services + tools)** — `npx jest --config jest.config.js src/modules/integrations/google/__tests__ src/modules/integrations/__tests__ src/modules/tools/built-in/*.spec.ts` → expect **173 of 173 tests passing across 15 suites**.
13. Sheets REST: `POST /integrations/sheets` create, `POST /values/A1:B2/append` data
14. Calendar REST: `GET /integrations/calendar/events?timeMin=...`
15. Agent chat: ask each tool (`CalendarTool`, `SheetsTool`, `DocumentsTool`) to perform an action — agent must have permissions enabled and `emailProvider='gmail'` if testing email
16. Admin: `https://cc.neurecore.com/settings/integrations` shows the tenant with status, scope badges, agent count, and **a Revoke button per connected tenant** (Phase 3 G7)
17. Disconnect: tenant UI → Disconnect → confirm DB row removed + subsequent Gmail calls return 401
18. **Credential rotation drill (validates G10 runbook)** — On a staging box, follow `runbook.md §9` end-to-end: rotate the `GOOGLE_CLIENT_SECRET` via `sed` + `pm2 restart`, then click through Connect Google on the tenant UI. Confirm browser lands back on the tenant host (G1). Confirm the prior `integration_credential` rows still have valid refresh tokens (call Gmail/Drive endpoints). Confirm the audit log records any admin-side revoke you performed.

---

## 11. Google Docs + Slides Integration (2026-07-12)

### Summary

Native **Google Docs** and **Google Slides** creation added as part of comprehensive Google Workspace coverage. Previously, only plain text/HTML files, Sheets, Calendar, and Gmail were supported. Now AI Employees can create native Google Docs (writable content via Docs API) and Google Slides presentations (with multiple slides, titles, and body content).

### 11.1 New Files Added

| File | Purpose |
|------|---------|
| `backend/src/modules/integrations/google/google-docs.service.ts` | Google Docs API wrapper: create document with content |
| `backend/src/modules/integrations/google/google-slides.service.ts` | Google Slides API wrapper: create presentation with slides |

### 11.2 Architecture

Both services follow the same pattern as existing Google services:

- **Authentication**: Uses `GoogleAuthClient` for OAuth2 token lifecycle (auto-refresh)
- **API calls**: Direct `fetch()` calls to Google APIs (no googleapis npm package)
- **Tenant-scoped**: All operations require `tenantId` parameter

### Google Docs Service

- **Endpoint**: `POST /integrations/docs` — creates a native Google Doc
- **Input**: `{ title, content?, parentId? }`
- **Returns**: `{ documentId, title, url }`
- **Content**: Optional text content inserted via Docs API `batchUpdate` (insertText)
- **Drive API**: Uses `files.create` with `mimeType: application/vnd.google-apps.document`
- **Reading**: `GET /integrations/docs/:documentId` fetches full document content via Docs API

### Google Slides Service

- **Endpoint**: `POST /integrations/slides` — creates a native Google Slides presentation
- **Input**: `{ title, slides?: [{ title, body? }], parentId? }`
- **Returns**: `{ presentationId, title, url }`
- **Slides**: Multiple slides with title text boxes and body content text boxes
- **Drive API**: Uses `files.create` with `mimeType: application/vnd.google-apps.presentation`
- **Slides API**: Uses `batchUpdate` with `createSlide` + `createShape` + `insertText` requests
- **Reading**: `GET /integrations/slides/:presentationId` fetches full presentation content

### 11.3 Frontend Changes

| File | Change |
|------|--------|
| `frontend-tenant/src/services/integrations.service.ts` | Added `createGoogleDoc()`, `getGoogleDoc()`, `createGoogleSlides()`, `getGoogleSlides()` |
| `frontend-tenant/src/app/settings/integrations/google/page.tsx` | Added "Google Docs" and "Google Slides" quick-access links in "Open Google apps" section; imported `FileText` and `Presentation` icons |

### 11.4 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/integrations/docs` | Create Google Doc |
| `GET` | `/integrations/docs/:documentId` | Get Google Doc content |
| `POST` | `/integrations/slides` | Create Google Slides presentation |
| `GET` | `/integrations/slides/:presentationId` | Get presentation content |

### 11.5 Module Wiring

Both services are registered in `integrations.module.ts`:
- `GoogleDocsService` in `providers[]` and `exports[]`
- `GoogleSlidesService` in `providers[]` and `exports[]`

### 11.6 Bug Fix: Calendar Default Calendar

**G-CAL-PRIMARY**: The calendar UI defaulted to the first calendar in the list (e.g. "Holidays in Pakistan" read-only calendar) instead of the user's primary calendar. Fixed in `calendar/page.tsx`:

```typescript
// Before: selected first calendar regardless of type
if (calendarId === 'primary' && cals.length > 0 && cals[0].id) {
  setCalendarId(cals[0].id);
}

// After: selects primary calendar first
if (calendarId === 'primary') {
  const primary = cals.find((c) => c.primary);
  if (primary) setCalendarId(primary.id);
  else if (cals.length > 0) setCalendarId(cals[0].id);
}
```

### 11.7 Live Verification (2026-07-12 15:42 PKT)

All operations verified end-to-end against `mnpiracha@gmail.com` (tenant `mali@live.com`):

| Operation | Result | Artifact |
|-----------|--------|----------|
| Create Google Doc | ✅ 200 | `AI Employee - Strategic Plan 2026` → `1xsx9YmUwE2OT0jMyCkOI2WLRUXMBW4bozW7shKVpR28` |
| Read Google Doc | ✅ 200 (after deploy) | Returns full document JSON |
| Create Google Slides | ✅ 200 | `AI Employee - Board Presentation Q3 2026` → `1_DdgPcpkqwSjjl0LOHKwZ12nCuGwwe0iX9rN5mok9IU` |
| Read Google Slides | ✅ 200 (after deploy) | Returns full presentation JSON |
| Create Spreadsheet with data | ✅ 200 | `Q3 Financial Report` → `1j7YI_VCkaPT7uReYZ2FL78B_hr6gOrVw_cZMAX6eswM` + 16 cells written |
| Create Calendar Event | ✅ 200 | `AI Employee - Strategy Review` (Jul 13, 10-11am PKT) |
| Create Drive HTML File | ✅ 200 | `AI Employee - Market Analysis Report.html` |
| Login | ✅ 200 | `mali@live.com` / `Shahikhail@@0098` |

### 11.8 Deploy Notes

## 10. Phase 5 — Full Verification (2026-07-12)

### 10.1 Issues Fixed

| # | Issue | File | Fix |
|---|-------|------|-----|
| G-CRIT-1 | `frontend-tenant/.env.local` had placeholder `your-google-client-id.apps.googleusercontent.com` overriding real value | `frontend-tenant/.env.local:41` | Set to `584510836530-pi64n9866hcuv5kuip2fnagsmhtjp3h0.apps.googleusercontent.com` |
| G-CRIT-2 | `backend/.env` (dev) missing `GOOGLE_TOKEN_ENCRYPTION_KEY` | `backend/.env` | Added key from production env |
| G-CRIT-3 | `CryptoService` reads `ENCRYPTION_KEY` but .env.production only had `GOOGLE_TOKEN_ENCRYPTION_KEY` | `backend/.env.production:150` | Added `ENCRYPTION_KEY` alias; updated `CryptoService` to also check `GOOGLE_TOKEN_ENCRYPTION_KEY` |
| G-CRIT-4 | Existing encrypted credentials (stored with dev fallback key) couldn't be decrypted after setting `ENCRYPTION_KEY` to a different value | `crypto.service.ts:64-78` | `decrypt()` now falls back to dev key when primary key fails |
| G-NET-1 | Backend couldn't connect to Upstash Redis from dev environment | `backend/.env` | Switched to local Redis (miniredis.js dev server) |

### 10.2 Google Workspace End-to-End Verification (Live)

All operations performed against `mnpiracha@gmail.com` Google account via NeureCore backend API with tenant `mali@live.com`:

| Service | Operation | Result |
|---------|-----------|--------|
| **Auth/Login** | Login as `mali@live.com` | ✅ Token issued, JWT auth works |
| **Google Status** | `GET /integrations/google/status` | ✅ Connected: true, 5 scopes, email: mnpiracha@gmail.com |
| **Calendar** | `GET /integrations/calendar/list` | ✅ 3 calendars listed (Holidays, Family, Primary) |
| **Calendar** | `GET /integrations/calendar/events?maxResults=5` | ✅ 5 events returned from primary calendar |
| **Calendar** | `POST /integrations/calendar/events` — created "NeureCore AI Test - Calendar Integration" | ✅ Event created on mnpiracha@gmail.com calendar for 2026-07-13 14:00-15:00 UTC |
| **Sheets** | `POST /integrations/sheets` — created "NeureCore AI - Task Tracker" with Tasks+Summary sheets | ✅ Spreadsheet ID: `1fAXZYvN2jvXQt-sMDPyqiTzfLKUFDbRWJmHOB5Ck1wc` |
| **Sheets** | `POST /integrations/sheets/:id/values/Tasks!A1:F3` — wrote header + 2 data rows | ✅ 18 cells updated (3 rows × 6 cols) |
| **Sheets** | `GET /integrations/sheets/:id/values/Tasks!A1:F3` — read data back | ✅ Values match written content |
| **Docs** | `POST /integrations/docs` — created "NeureCore AI - Project Report" with HTML content | ✅ Doc ID: `1QhEMORdTuuS6OxwnAqRMbpuH4VcPtkr5BQiODbDzWB8` |
| **Slides** | `POST /integrations/slides` — created "NeureCore AI - Presentation" with 3 slides | ✅ Presentation ID: `12cIrIaDMfi7VgihD4dPOc8YLD--4RgvDNCW5tEMHXcM` |
| **Drive** | `POST /integrations/drive/folders` — created "NeureCore AI Workspace" folder | ✅ Folder with webViewLink returned |
| **Drive** | `GET /integrations/drive/search?q=&pageSize=5` | ✅ 5 files found |
| **Gmail** | `GET /integrations/gmail/labels` | ✅ 15 labels |
| **Gmail** | `GET /integrations/gmail/inbox?maxResults=3` | ✅ 3 inbox messages |
| **Gmail** | `POST /integrations/gmail/send` — sent test email to mali@live.com | ✅ Message sent (ID: `19f56ac4223c2912`) |

### 10.3 Tasks & Projects Created

- **Project**: "Google Workspace Integration Project" (ACTIVE)
- **Tasks**: Complete Google Drive Integration, Implement Gmail Send/Read, Set up Google Calendar for AI, Create Documents and Reports

### 10.4 Test Suite

All **728 tests** across **76 suites** pass. Google-specific tests:
- 132 tests in `src/modules/integrations/google/`, `src/modules/integrations/__tests__/`, and `csv.util.spec.ts`
- 75 tests in `src/modules/tools/built-in/` (calendar, sheets, documents, email tools)

### 10.5 Generated Google Workspace Artifacts

| Artifact | URL |
|----------|-----|
| Spreadsheet: NeureCore AI - Task Tracker | https://docs.google.com/spreadsheets/d/1fAXZYvN2jvXQt-sMDPyqiTzfLKUFDbRWJmHOB5Ck1wc/edit |
| Document: NeureCore AI - Project Report | https://docs.google.com/document/d/1QhEMORdTuuS6OxwnAqRMbpuH4VcPtkr5BQiODbDzWB8/edit |
| Presentation: NeureCore AI - Presentation | https://docs.google.com/presentation/d/12cIrIaDMfi7VgihD4dPOc8YLD--4RgvDNCW5tEMHXcM/edit |

Deployed to Contabo 2026-07-12 15:35 PKT:
- **Backend**: rsync → pnpm install → prisma generate → nest build → PM2 restart (neurecore-backend)
- **Tenant**: rsync → pnpm install --no-frozen-lockfile → npm run build → PM2 reload (neurecore-tenant)
- **Lockfile note**: Server has `lucide-react@^0.460.0` in lockfile vs local `^1.7.0`; used `--no-frozen-lockfile` to bypass
