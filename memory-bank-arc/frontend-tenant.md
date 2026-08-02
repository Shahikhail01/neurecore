# Frontend-Tenant (NeureCore tenant app)

**Last verified:** 2026-07-31 — **FULL SYSTEM AUDIT COMPLETED**

**⚠️ DEPLOYMENT STATUS:** Local is `fe335abb`; Contabo deployed is `ad73f3e6` — **deployment required to get latest Phase 9 G9 + NC-AWL-IMP-2**

**Production routes (30 dirs):** accounting, customers, departments, execution, finance, help, home, intelligence, marketplace, onboarding, portal, projects, reviews, service-desk, settings, strategy, users, workspace + auth pages (forgot-password, login, register, reset-password)

**Live URL:** `https://hq.neurecore.com`
**Internal port:** 3001
**PM2:** `neurecore-tenant` (pid 580402, online)
**Source:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant/`
**Sibling docs:** [system-state.md](system-state.md) · [operations.md](operations.md) · [backend.md](backend.md) · [contabo-ops.md](contabo-ops.md) · [frontend-admin.md](frontend-admin.md)

---

## TL;DR

The end-user tenant app: command center, service desk (inbox + approvals), department hub, marketplace, finance, intelligence, analytics, settings, agent execution UI. Built with Next.js 15 App Router + React 19 + 15 Radix UI packages + Tailwind + Zustand + Socket.IO + Framer Motion. Reverse-proxied by OLS at `hq.neurecore.com` → `127.0.0.1:3005`. Started via PM2 `neurecore-tenant`.

Distinct from admin UI: **per-tenant context, user-facing workflows, AI chat, approvals, agent execution.**

---

## 1. Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.12 |
| Runtime | React | 19 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3.4 |
| Components | Radix UI (15 packages) | latest |
| State | Zustand | 5 |
| Charts | Recharts | 3.7 |
| Animations | Framer Motion | 12 |
| Forms / Validation | react-hook-form + zod | latest |
| HTTP | axios | 1.7 |
| Realtime | socket.io-client | 4.8 |
| Auth client | jose | 5.9 |
| Date | date-fns | 4.1 |
| Tests (unit) | Vitest + Testing Library | 4.1 / 6.9 |
| Tests (e2e) | Playwright | 1.61 |

---

## 2. Process / deploy

| Item | Value |
|---|---|
| PM2 process | `neurecore-tenant` (id 40) |
| Startup | `/opt/neurecore/frontend-tenant/start.sh` → `node node_modules/.bin/next start --hostname 127.0.0.1 --port 3005` |
| Build output | `/opt/neurecore/frontend-tenant/.next/` |
| Env file | `/opt/neurecore/frontend-tenant/.env.production` |
| Local dev port | `3001` |

Rebuild: `bash /opt/neurecore/rebuild.sh tenant`.

---

## 3. Routing (App Router)

OLS `hq.neurecore.com` uses a **catch-all rewrite**: every URL (including `/api/v1/*`) proxies to port 3001. Inside Next.js, `NEXT_PUBLIC_API_URL=/api/v1` is **relative** — so requests hit Next.js itself, which then forwards to backend via the Next.js API routes (or directly via internal fetch).

Top-level app routes:

```
src/app/
├── page.tsx                       # → /home (authed) or marketing landing
├── login/page.tsx
├── register/page.tsx
├── onboarding/
│   └── setup/
│       ├── page.tsx               # WS-2.1 thin orchestrator (200 lines)
│       └── steps/                 # 6 step components: CompanyStep, LogoStep, LocalizationStep, PlanStep, TemplateStep, CompleteStep
├── privacy/page.tsx
├── error.tsx, loading.tsx, not-found.tsx, layout.tsx, globals.css
│
├── home/                           # Creatio-style landing (hero + KPIs + right-rail widgets)
├── departments/                    # Workspace hub (with tab= tasks|workflows|routines|goals|projects|org-chart)
├── marketplace/                    # Marketplace hub (tab= agents|connectors|templates)
├── service-desk/                   # Service Desk hub (tab= inbox|approvals|activity)
├── finance/                        # Financial hub (tab= overview|billing|costs)
├── intelligence/                   # Intelligence hub (tab= analytics|observability|health|reliability|security|settings)
├── settings/
│   ├── page.tsx                    # Smart redirect → /intelligence?tab=settings
│   ├── integrations/
│   └── wizard/                     # WS-2.1: 11 progressive sub-wizards
│       ├── page.tsx                # index — list all wizards with status
│       └── [slug]/page.tsx         # generic per-wizard route (PR-3 fills body)
├── help/                           # Help resources (support docs, contact)
│
├── strategy/page.tsx               # Placeholder (redirect to /home)
├── users/[id]/page.tsx             # User profile (future)
│
├── apps/                           # App-router API proxies
├── api/                            # Client-side API proxies

Deleted in FIX-021 (no page.tsx; next.config.js rewrites still serve):
  command-center, dashboard, agents, tasks, tasks/delegate, workflows,
  routines, goals, projects, costs, inbox, activity, approvals, analytics,
  connectors, billing, org-chart

All legacy URLs → canonical hub with ?tab= via next.config.js.
See left-rail-icon.md §3.3 for the full rewrite table.
```

---

## 4. Architecture

```
src/
├── app/                    # App Router pages (see §3)
├── components/             # Reusable UI (see §5)
├── features/               # Domain-grouped components (e.g. features/approvals)
├── core/                   # Domain primitives (entities, value objects)
├── services/               # API client wrappers, auth, websocket
├── stores/                 # Zustand stores (see §6)
├── hooks/                  # Data-fetching hooks (see §7)
├── shared/                 # Cross-cutting UI helpers (LoadingState, ErrorState)
├── utils/                  # Pure functions (formatters, validators)
├── types/                  # TypeScript types per domain
├── lib/                    # 3rd-party integration shims
└── config/                 # Build/runtime config
```

Tenant uses **features + components + core** layered architecture (vs admin's flatter layout). Core is the SOLID-compliant domain layer; features compose core + components for a specific page or workflow.

---

## 5. Components (high-level)

```
src/components/
├── layout/              # AppShell, Header, Sidebar (IconRail), Footer
├── sidebar/             # Collapsible vertical nav (Phase 1-5 deliverable)
├── command-palette/     # Cmd+K modal (cmdk)
├── ui/                  # Primitives (Button, Card, Modal, Tabs, etc.)
├── data-table/          # Generic table with filters/sort/pagination
├── charts/              # Recharts wrappers
├── kpi/                 # KPI tile, sparkline
├── agent-card/          # Agent status + actions
├── chat/                # AI chat panel
├── inspector/           # Right-side detail drawer
├── timeline/            # Phase 2 deliverable: ImpactTimeline
├── approvals/           # Phase 1+5: ApprovalCard, ApprovalHub, BatchApprovalView, LearningFeedbackModal
├── context/             # Phase 3: ContextCard, DependencyGraph, ContextThread
├── agents/              # Agent orchestration board
├── forms/               # FormField wrappers
├── workflow/            # Workflow steps visualization
├── delegation/          # Delegation/approval routing
├── checklist/           # WS-2.1: ThingsToDoPanel (mounted in TenantShell)
├── uploads/             # WS-2.1: LogoUploader (reusable)
├── wizard/              # WS-2.1: WizardShell placeholder (PR-3 fills body)
├── threads/             # EC-2026: ThreadInboxPanel + ThreadView (comms-gated behind COMM_THREADS_ENABLED)
├── creatio/             # Creatio-inspired layout helpers (legacy reference)
└── [domain]             # feature-specific small components
```

---

## 6. State (Zustand stores)

```
src/stores/
├── authStore.ts              # JWT, current user + tenant, login/logout
├── agentStore.ts             # Active agents + status cache
├── approvalStore.ts          # Stratified approvals (Phase 1)
├── activityStore.ts          # Activity feed
├── chatStore.ts              # AI chat sessions + streaming tokens
├── chatStore.test.ts         # ★ has a unit test (only one)
├── commandStore.ts           # Cmd+K command palette
├── departmentStore.ts        # Department roster + org chart
├── inspectorStore.ts         # Selected entity inspector
├── onboardingChecklist.store.ts  # WS-2.1: progressive onboarding wizard checklist (single source of truth, optimistic mutations, rollback)
├── taskStore.ts              # Task list state
├── workflowStore.ts          # Multi-step workflow progress
└── threadStore.ts            # EC-2026: Thread list state (persisted, merge, WS-driven)
```

`authStore` persists to `localStorage` (`neurecore_tenant_auth`).

---

## 7. Hooks

```
src/hooks/
├── useTenantAuth.ts              # Back-compat shim over useAuth() (FIX-020) — exports AuthUser|null
├── useFeatureFlag.ts             # Reads from /api/v1/features
├── useDashboardKpis.ts           # /command-center (deprecated — data now flows via commandCenterService.getSummary)
├── useAgents.ts                  # Agent list + status
├── useAgentMetrics.ts            # Per-agent metrics
├── useApprovals.ts               # Stratified approvals
├── useActivityStream.ts          # WebSocket activity feed
├── useTimeline.ts                # Phase 2: impact timeline
├── useContext.ts                 # Phase 3: cross-department context
├── useChartData.ts               # /analytics charts
├── useChat.ts                    # AI chat streaming
├── useDelegation.ts              # Delegation routing
├── useTimeRange.ts               # Shared 24h/7d/30d/90d range
├── useOnboardingChecklist.ts     # WS-2.1: subscribe to onboardingChecklist.store + auto-hydrate
├── useServerFeatureFlag.ts       # Backend-managed feature flags (added comms flags 2026-07-11)
└── useThreads.ts                 # EC-2026: Thread data fetching + WS subscription lifecycle (DIP on IThreadService)
```

> **New auth hook** — `useAuth()` in `src/auth/hooks/useAuth.ts`. **All new code should import this, NOT `useTenantAuth`.** See [`int-features/auth-architecture.md`](../int-features/auth-architecture.md).

---

## 8. Configuration

### `next.config.js`
- `output: 'standalone'`
- Image domains: `avatars.githubusercontent.com`, `lh3.googleusercontent.com`
- Transpile: `@/core/**`, `@/features/**`

### `.env.production` (Contabo, /opt/neurecore/frontend-tenant/.env.production)
```ini
NODE_ENV=production
NEXT_PUBLIC_API_URL=/api/v1                            # relative — uses hq OLS proxy
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_TENANT_URL=https://hq.neurecore.com
NEXT_PUBLIC_ADMIN_URL=https://cc.neurecore.com
NEXT_PUBLIC_APP_NAME=NeureCore
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_MAINTENANCE=false
NEXT_PUBLIC_ENABLE_VOICE_COMMANDS=false
NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION=false
NEXT_PUBLIC_DEFAULT_THEME=system
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
NEXT_PUBLIC_ENABLE_SOUND=false
NEXT_PUBLIC_DEFAULT_LANGUAGE=en
NEXT_PUBLIC_SUPPORTED_LANGUAGES=en,es,fr,de,zh
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_GOOGLE_CLIENT_ID=584510836530-pi64n9866hcuv5kuip2fnagsmhtjp3h0.apps.googleusercontent.com
NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com
NEXT_PUBLIC_STORAGE_PROVIDER=local
NEXT_PUBLIC_S3_BUCKET=
NEXT_PUBLIC_ALLOW_SIGNUP=true
NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true
NEXT_PUBLIC_DEFAULT_TIER=free
```

---

## 9. Auth flow

1. User hits `https://hq.neurecore.com/`
2. If not logged in, page/guard redirects to `/login`
3. Login form posts to `/api/v1/auth/login` (relative, same-origin). OLS proxies `/api/*` → NestJS; Next.js `rewrites()` is a belt-and-suspenders fallback.
4. Backend sets `__Host-nc_at` (HttpOnly, 15min), `__Host-nc_rt` (HttpOnly, 7d), `__Host-nc_csrf` (JS-readable) cookies on `hq.neurecore.com`.
5. `TokenManager.ts` reads tokens from cookies — no localStorage token storage.
6. `authStore` persists only `user` + `isAuthenticated` to localStorage (Zustand persist).
7. `api.ts` / `RestClient.ts` inject `X-CSRF-Token` on state-changing requests (POST/PUT/PATCH/DELETE), exempting `/auth/login|register|google`.
8. On 401 from a non-auth endpoint, calls `/auth/refresh` (cookie-carried; `RefreshCoordinator` serializes parallel attempts). If refresh fails, clears cookies via `tokenManager.clearTokens()` and redirects to `/login`.
9. Auth endpoints (`/auth/login`, `/auth/register`, `/auth/google`, `/auth/refresh`) never trigger refresh — a 401 on these means bad credentials.
10. Google OAuth: `/auth/google` → backend; "account exists but unlinked" flow uses custom DOM events.
11. **Post-login redirect (`login/page.tsx` `routeAfterAuth`)**: `GET /tenants/me/current` → if `onboardingCompletedAt` is null → `/onboarding/setup`; else `/home`.
12. **Post-onboarding redirect**: `POST /onboarding/complete` seeds the checklist then `router.push('/home')`.
13. **AppInitializer guard (FIX-018):** On `/login`, `/register`, and `/forgot-password`, `AppInitializer` skips both the `/me` session-restoration call and the socket lifecycle (connect/disconnect subscription). This prevents unnecessary API calls and WebSocket connection spam on public routes.

---

## 10. WebSocket / realtime

- Connected on mount via `socket.io-client` (`autoConnect: false` — connection is explicitly triggered by `AppInitializer`)
- **Route guard (FIX-018):** Socket lifecycle (connect/disconnect) and session restoration are **skipped** on unauthenticated routes (`/login`, `/register`, `/forgot-password`). `AppInitializer` checks `usePathname()` against `UNAUTHENTICATED_ROUTES` before attempting `/me` token validation or socket connect.
- Subscribed events: `agent.execution.started/progress/completed`, `routine.triggered`, `notification.created`, `inbox.message`, `approvals.updated`
- Used to live-update: command-center timeline, inbox badge, agent execution panel

---

## 11. Tests

| Item | Status |
|---|---|
| Unit tests (`*.test.ts`) | ~5 files (one per domain store, partial coverage) |
| Component tests | @testing-library/react configured; sparse coverage |
| E2E (`tests/e2e/`) | Playwright `smoke.spec.ts`; verifies login → dashboard round-trip |
| Coverage | `vitest run --coverage`; no threshold enforced |
| Runner | `npm run test` (vitest), `npx playwright test` (e2e) |

Commands:
```bash
npm run test              # unit
npm run test:watch        # interactive
npm run test:coverage     # with coverage
npx playwright test       # e2e
```

---

## 12. Local dev

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant
nvm use 20
npm install
npm run dev               # http://localhost:3001
npm run build
npm run type-check
npm run lint
npm run test
npx playwright test
```

Browser → backend: relative `/api/v1` in `.env.local` (not committed) routes through CORS proxy on `127.0.0.1:3004`.

---

## 13. Phase history (delivered features)

Phases 1-5 of the original refactoring plan are delivered (see [future-plans.md §1](future-plans.md) for what comes next):

| Phase | Feature | Key files |
|---|---|---|
| 1 | Risk-stratified approvals | `src/components/approvals/`, `src/stores/approvalStore.ts` |
| 2 | Impact timeline dashboard | `src/components/timeline/`, `src/hooks/useTimeline.ts` |
| 3 | Cross-department context | `src/components/context/`, `src/hooks/useContext.ts` |
| 4 | Agent orchestration | `src/components/agents/`, `src/hooks/useAgents.ts` |
| 5 | Batch approvals + learning loop | `src/components/approvals/BatchApprovalView.tsx`, `LearningFeedbackModal.tsx` |
| **5.5 (WS-2.1 PR-1+2)** | **Progressive onboarding wizard system** — Tier-1 wizard reduced to 6 steps (Company → Logo → Localization → Plan → Template → Complete); 11 sub-wizards scaffolded under `/settings/wizard/[slug]`; Things-to-do panel mounted in TenantShell; logo uploads via `POST /uploads/logo` + `GET /cdn/*`; `PATCH /tenants/me` owner-scoped endpoint; `OnboardingChecklistEntry` Prisma model + Zustand `onboardingChecklist.store.ts`. | `src/app/onboarding/setup/{page.tsx,steps/*.tsx}`, `src/app/settings/wizard/`, `src/components/{checklist,uploads,wizard}/`, `src/services/{checklist,tenants,uploads}.service.ts`, `src/stores/onboardingChecklist.store.ts`, `src/hooks/useOnboardingChecklist.ts`, `src/lib/wizard/types.ts` |
| **6 (Phase 6 – 3-column home)** | **Glassmorphic 3-column home page** — Center: hero section (date/time/greeting + AI prompt), KPI strip, network status, departments + quick actions, tasks; Right panel: collapsible live feed, stats chart, quick actions, tasks, approvals widgets. Background style selector (4 gradients) in preferences modal. Real-time ready widget structure. Zustand `uiPreferencesStore` persists UI state. **FIX-021 (2026-07-07):** the page's own decorative `LeftPanel` was deleted; the IconRail (rendered by `TenantShell`) is now the single source of truth for left navigation across the portal. | `src/app/home/page.tsx`, `src/stores/uiPreferencesStore.ts`, `src/components/home/{RightPanel,GlassPanel,*Widget}.tsx`, `src/components/layout/{IconRail,RailCustomizeModal}.tsx`, `src/stores/railPreferencesStore.ts`, `src/components/TenantShell.tsx`, `src/app/globals.css` (.glass-panel, .glass-icon) |
| **6.5 (Left-panel audit 2026-07-06)** | **Left-panel route audit + fixes (FIX-020)** — Pinned `lucide-react@0.460.0` (lockfile drift to `1.22.0` was crashing every page on `next dev` with `Cannot read properties of undefined (reading 'call')`). Fixed `IconRail` "AI Skills" dead link (`?tab=spawn` → `?tab=templates`). Extended `RosterTab` on `/departments` with `tasks|workflows|routines|goals|projects` plus a new `WorkItemsTab` placeholder component so the 5 work-item links from the rail actually resolve. All 23 left-panel routes now return `200`; production build clean (43 routes); type-check and lint clean. | `frontend-tenant/package.json:37` (lucide-react pin), `src/components/layout/IconRail.tsx:66`, `src/app/departments/page.tsx:49-57` + new `WorkItemsTab` |

The original phase plans are archived in `../memory-bank-ARCHIVED/legacy-2026-07-04/` for diff. The Phase 5.5 plan is in [`plans/onboarding-progressive-wizard.md`](plans/onboarding-progressive-wizard.md).

---

## 13A. Phase 6 – 3-Column Home Page Architecture

### Overview
Post-onboarding landing page with Creatio-inspired 2-column layout: center content (hero + dashboard sections), right panel (real-time widgets). The left navigation is provided globally by `TenantShell` → `IconRail` (see [left-rail-icon.md](left-rail-icon.md)); the `/home` page no longer renders its own `LeftPanel`.

### Left Navigation (IconRail — canonical)
See [left-rail-icon.md](left-rail-icon.md) for the full reference. Brief summary:

- **Visibility**: Always visible (desktop) or behind a hamburger (mobile). Same nav on every authenticated page.
- **Sections**: Home, Workspace (Departments + work-item tabs), Marketplace (Agents/Connectors/AI Skills), Service Desk (Inbox/Approvals/Activity), Finance, Intelligence (+ Settings).
- **Customisation**: Per-user toggles for whole sections and individual items via the in-rail **⚙ Customize** modal. Persisted in `railPreferencesStore` (localStorage `neurecore-rail-preferences`).
- **State Store**: `src/stores/railPreferencesStore.ts` (Zustand persist v1).

### Center Column
1. **Hero Section** (`HomeHero` enhanced):
   - Live date/time pill (updates every 60s)
   - Greeting with user's first name + time-of-day context
   - AI prompt input with send button
   - 4 quick-suggestion chips
   - Glassmorphic styling (backdrop blur + semi-transparent white)

2. **KPI Strip** (`HomeKpiStrip` unchanged):
   - 4 metric tiles (agents count, tasks count, approvals pending, monthly cost)

3. **Network Status** (`HomeNetworkStatus` unchanged):
   - Error banner if any fetch fails; retry button

4. **Departments + Quick Actions** (2-column grid):
   - Left: Department cards (count + status)
   - Right: Quick action buttons (New Task, Request Approval, Run Workflow, Generate Report)

5. **Tasks Panel** (`HomeTasksPanel` unchanged):
   - Recent tasks list with priority badges

### Right Panel (Collapsible Widgets)
5 real-time-ready widgets, each collapsible and hideable:

| Widget | Component | Features |
|---|---|---|
| **Live Feed** | `LiveFeedWidget.tsx` | Activity timeline (tasks, approvals, workflows, agents); timestamps; actor names |
| **Stats** | `StatsWidget.tsx` | Line chart (7-day performance trend) via Recharts |
| **Quick Actions** | `QuickActionsWidget.tsx` | 2×2 grid of gradient action buttons |
| **Tasks** | `TasksWidget.tsx` | Active tasks list; completion progress badge; priority indicators |
| **Approvals** | `ApprovalsWidget.tsx` | Pending approvals; inline approve/reject buttons; requested amounts |

Each widget:
- Collapsible section header (ChevronDown icon)
- Header menu (show/hide toggle)
- Staggered entrance animation (Framer Motion)
- Scrollable content area

### UI Preferences Store (`uiPreferencesStore.ts`)
Zustand store managing:
```typescript
interface UIPreferencesState {
  backgroundStyle: 'gradient-blue' | 'gradient-purple' | 'gradient-dark' | 'solid-dark'
  visibleWidgets: string[]     // ['live-feed', 'stats', ...]
  widgetOrder: string[]
}
```
- Persists to localStorage via `zustand/middleware` (key `ui-preferences-store`, version 2)
- Accessed via `useUIPreferencesStore(state => state.field)`
- `visibleIcons` was removed in FIX-021 (legacy `LeftPanel` deleted). Existing payloads with `visibleIcons` are silently dropped by the store's `migrate` function. See [left-rail-icon.md §7.1](left-rail-icon.md#71-uipreferencesstore-migration).

### Rail Preferences Store (`railPreferencesStore.ts`)
Holds `hiddenSections`, `hiddenItems`, `collapsedSections`. See [left-rail-icon.md §4](left-rail-icon.md#4-railcustomizemodal) for the user-facing UI.

**2026-07-23 (FIX-COMPREHENSIVE-R2):** Stale per-industry hidden item IDs (e.g. `loans`/`audits` for F&C, `patients`/`appointments` for Healthcare) would silently leak across `industryGroup` re-assignments if a SUPER_ADMIN moved the tenant between groups. New hook `useRailInvalidationOnIndustryChange()` in `stores/tenantStore.ts` watches the cached `industryGroup` and calls `useRailPreferencesStore.getState().reset()` when it differs from a `localStorage['neurecore-tenant-store.industryGroup.watermark']` value. Wired from `IconRail.tsx`. Per-browser watermark prevents silent re-bust on SUPER_ADMIN tenant hopping.

### Rail Customize Modal
Accessible from the IconRail footer (`⚙ Customize` button):
- **Section toggles**: Show/hide entire sections (Workspace, Marketplace, etc.)
- **Item toggles**: Show/hide individual links
- **Reset to defaults**: restores the canonical 19-link rail
- Settings persist immediately to store (and localStorage)

### Glassmorphic Styling (`globals.css`)
```css
.glass-panel {
  @apply backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl;
  @apply hover:bg-white/10 hover:border-white/20 shadow-2xl transition-all duration-300;
}

.glass-icon {
  @apply rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-lg;
}
```

### Background Gradient Options
1. **Gradient Dark** (default): `from-slate-900 via-slate-950 to-slate-950`
2. **Gradient Blue**: `from-blue-950 via-slate-900 to-slate-950`
3. **Gradient Purple**: `from-purple-950 via-slate-900 to-slate-950`
4. **Solid Dark**: `bg-slate-950`

### Real-time Integration Points
Widgets structured for WebSocket / API integration:
- **LiveFeedWidget**: Replace mock data with `/command-center/activity` stream or Socket.IO `activity.updated`
- **StatsWidget**: Fetch from `/analytics/performance` or store in `useChartData` hook
- **TasksWidget**: Connect to `useTaskStore` (already integrated with `/api/v1/tasks`)
- **ApprovalsWidget**: Connect to `useApprovalStore` (already integrated)

### Layout Dimensions
- **Left navigation**: IconRail, 56px (collapsed) / 240px (expanded), persistent on desktop, drawer on mobile. See [left-rail-icon.md](left-rail-icon.md).
- **Center column**: Flex-1, max-width 1200px
- **Right panel**: Fixed 320px width, scrollable
- **Total viewport**: 1800px+ recommended (desktop-first design)

### Mobile Behavior
- Hamburger icon (TopBar left) opens the IconRail drawer (slide-in from left).
- IconRail uses the same nav data as desktop; both subscribe to `railPreferencesStore` so they stay in sync.



## 14. Known issues & gaps

1. **Sparse test coverage** — only one store has a test (`chatStore.test.ts`). Phases 1-5 shipped without tests. See [future-plans.md §3.4](future-plans.md).
2. **No Sentry** — `NEXT_PUBLIC_SENTRY_DSN` empty. Errors rely on browser console + ad-hoc `console.error`.
3. **No internationalization framework** — `NEXT_PUBLIC_SUPPORTED_LANGUAGES` is set but only English strings exist in source. See [future-plans.md §3.6](future-plans.md).
4. **Feature flags hard-coded** — `useFeatureFlag` reads from a backend endpoint that doesn't fully exist yet; many flags return default. See [future-plans.md §3.7](future-plans.md).
5. **No offline / PWA** — entirely online.
6. **OLS catch-all rewrite means `/api/v1/*` goes through Next.js** — extra hop compared to admin's direct-to-brain pattern. Considered acceptable for tenant's deeper proxy needs (token refresh, server-side fetches).
7. **`/login` form hydration warning on `autoComplete`** — React 19 reports `autocomplete` attribute mismatch between SSR and client (dev-only). Cosmetic, does not affect production.
8. **Recharts "width(-1) and height(-1)" warning on `/intelligence`** — fires when a chart container has no measured dimensions during initial mount. Non-blocking; recharts self-corrects after first layout. Tracked for refactor in [ui-audit-refactor-guide.md §7](ui-audit-refactor-guide.md).
9. **Empty work-item tabs on `/departments`** — Tasks / Workflows / Routines / Goals / Projects are now routable (FIX-020) but show a placeholder pointing back to `?tab=departments`. Full implementations are pending (Phase 7+ scope).
10. **Settings cards redirect loop (FIXED 2026-07-07)** — Profile, AI Providers, API Keys, Security & Access cards previously linked to `/settings?tab=...` which redirected back to the Settings tab, causing a silent loop. Fixed in FIX-017: all sub-sections now render inline within the Intelligence page's SettingsTab with URL-backed state. See §17.
11. **Home page `.length` crash + WebSocket failure + `/help` 404 (FIXED 2026-07-07)** — Corrupted Zustand persist state caused `TypeError: can't access property "length", n is undefined`. TopBar linked to non-existent `/help`. WebSocket fell back to `localhost:3000`. All fixed in FIX-019 with merge functions, guards, a real /help page, and same-origin socket URL. See §19.
12. **3 pre-existing chat tests broken by copy rename** — `KeywordFallbackReply.test.ts:17` expects "Agents page" but production copy says "Employees page"; 2 cases in `ChatService.test.ts` reference the same old copy. Tests never updated when copy was renamed. Not in scope of FIX-COMPREHENSIVE-R2; tracked in [pending-tasks.md §D.4](pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
13. **`pnpm install` requires `--no-frozen-lockfile` workaround on Contabo** — `package.json` includes `compression` / `lru-cache` added 2026-07-21 that the lockfile doesn't capture. The deploy sequence currently requires manually running `pnpm install --no-frozen-lockfile` on Contabo before `rebuild.sh`. `scripts/deploy.sh` should detect drift and pass the flag automatically. Tracked in [pending-tasks.md §B.2](pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
14. **`p2.Source/JS drift` between `backend/dist/` and `backend/src/` was the root cause of the original 500** — `backend/dist/` exists in production but is not a CI artefact. Add `git diff --check` from `dist/` to `src/` as part of the deploy checklist. Tracked in [pending-tasks.md §B.4](pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).
15. **DRY timezone/currency lists in 2 other wizards** — `frontend-tenant/src/app/settings/wizard/[slug]/wizards/ProfileWizard.tsx:14` and `LocalizationWizard.tsx:16` still carry local duplicates. Tracked in [pending-tasks.md §B.3](pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).

---

## 16. Tenant consumption audit + fixes (2026-07-07)

Full audit of how SuperAdmin-deployed entities (AI Employees, Departments, Features, Packages) are picked up by the tenant. Nine issues fixed:

### ISSUE 1 — Home right-panel widgets used 100% mock data (HIGH)
**Files:** `LiveFeedWidget.tsx`, `StatsWidget.tsx`, `TasksWidget.tsx`, `ApprovalsWidget.tsx`
- `LiveFeedWidget` → wired to `useActivityStore` (populated by WebSocket `useActivityStream` in TenantShell)
- `StatsWidget` → wired to `useAgentStore` / `useTaskStore` / `useDepartmentStore` (hydrated by command-center summary)
- `TasksWidget` → wired to `useTaskStore` with fetch fallback
- `ApprovalsWidget` → wired to `useApprovals()` hook (live `GET /approvals/stratified?status=PENDING`)

### ISSUE 2 — Department templates hardcoded (HIGH)
**File:** `departments/page.tsx` — replaced static `TEMPLATE_PACKS` array with live fetch from `departmentTemplatesService.list()` → `GET /department-templates`

### ISSUE 3 — No package/feature visibility for tenants (HIGH)
**Backend:** `packages.controller.ts` class-level `@Roles` expanded to `OWNER, ADMIN` (write methods kept admin-only). `features.controller.ts` same treatment.
**Frontend:** New `src/services/packages.service.ts` + new `PackagesTab` in marketplace with deploy modal (capacity preview, configurable options).

### ISSUE 4 — Success rate hardcoded to 0 (MEDIUM)
**File:** `marketplace/page.tsx` — `successRate` now derived from task count ratio.

### ISSUE 5 — Redundant KPI fetching (MEDIUM)
**File:** `HomeKpiStrip.tsx` — removed `useDashboardKpis` hook; KPI strip now reads from stores hydrated by the single command-center summary call.

### ISSUE 6 — Spawn modal extra API call for tenant ID (LOW)
**File:** `marketplace/page.tsx` — reads `authUser.tenantId` from `useAuthStore` instead of `GET /tenants/me`.

### New service
**File:** `src/services/packages.service.ts` — `list()`, `getById()`, `deployPreview()`, `deploy()`, `listFeatures()`.

---

## 17. Settings sub-tab architecture fix (FIX-017, 2026-07-07)

**Problem:** Settings cards (Profile, AI Providers, API Keys, Security & Access) linked to `/settings?tab=...` which redirected back to `/intelligence?tab=settings` — a silent redirect loop. No detail content ever opened.

**Fix:** Settings sub-sections now render as inline detail views within the Intelligence page's SettingsTab:
- **State:** `settingsSubTab` managed in `IntelligencePage`, synced to URL via `?tab=settings&settingsSub=<name>`
- **Navigation:** Cards use `onClick → onSetSubTab(sub)` instead of `<Link href=...>`. Back button resets to card grid.
- **Detail views** (all in `src/app/intelligence/page.tsx`):
  - `ProfileDetail` — first/last name edit, password change, Zustand auth store sync
  - `AIProvidersDetail` — full CRUD via `/settings/ai/providers` endpoints
  - `APIKeysDetail` — API endpoint reference with copy buttons
  - `SecuritySettingsDetail` — CSRF/Helmet/Rate-limit status cards
- **New cards:** Integration card (links to `/settings/integrations` full page)
- **Redirect fix:** `src/app/settings/page.tsx` now forwards `tab` params to `?settingsSub=` instead of dropping them

**Files changed:**
- `src/app/settings/page.tsx` — preserve + forward sub-tab params
- `src/app/intelligence/page.tsx` — ~600 lines added (sub-tab state, 5 detail components, Integration card)

---

## 18. Home page performance fix (FIX-018, 2026-07-07)

**Problem:** After login, `/home` showed a blank screen for seconds, then loaded slowly with duplicate API calls.

**Architecture:**
- **Single source of truth:** `command-center/summary` populates `agentStore`, `taskStore`, `departmentStore`. Widgets read from stores — never fire their own fetches.
- **Shared approvals:** New `stores/approvalsStore.ts` + module-level `fetchInFlight` in `useApprovals` hook. Multiple components share one API call.
- **No tenant fetch:** HomeHero uses authStore user data + browser timezone fallback. `tenants.getCurrent()` removed from page.tsx.
- **Loading skeleton:** Page shows spinner during `_hasHydrated` window instead of `return null`.
- **Loading states:** StatsWidget shows "Waiting for workspace data...", LiveFeedWidget shows "Watching for activity..." while awaiting data.

**API calls (before → after):** 5 → 2 on initial load.

**Files changed:**
- `src/stores/approvalsStore.ts` — new shared Zustand store
- `src/hooks/useApprovals.ts` — refactored to use shared store
- `src/app/home/page.tsx` — removed tenant fetch, added loading skeleton, summaryLoading state
- `src/components/home/HomeKpiStrip.tsx` — removed useApprovals, accepts pendingApprovals/loading props
- `src/components/home/TasksWidget.tsx` — removed independent fetchTask
- `src/components/home/ApprovalsWidget.tsx` — removed autoRefresh (handled at page level)
- `src/components/home/StatsWidget.tsx` — added loading-empty state
- `src/components/home/LiveFeedWidget.tsx` — contextual loading message

---

## 19. Defensive patterns: Zustand merge + UI guards (FIX-019, 2026-07-07)

**Problem:** Five issues from the browser console after the FIX-018 deploy:
1. `TypeError: can't access property "length", n is undefined` — kept recurring despite per-component guards
2. `GET /help?_rsc=5vnyd 404` — TopBar links to `/help` but no page exists
3. `wss://brain.neurecore.com/socket.io/` — WebSocket failed because the URL fallback was `localhost:3000` (a dev-only value)
4. `Content-Security-Policy warnings 4` — pre-existing, not blocking
5. Pre-existing build error in `command-center/page.tsx`: `setWorkflows` called but `useWorkflowStore` not destructured. Lint passed; build caught it.

**Architecture decision: defensive everywhere, not just at consumers.**

### 19.1 Zustand `merge` functions (defense-in-depth at the source)

Every store that uses `persist` middleware now has a `merge` function that sanitizes persisted fields. Corrupted localStorage now falls back to initial state instead of `undefined`.

**Pattern (mandatory for any new persisted store):**
```ts
persist(
  (set) => ({ ... }),
  {
    name: 'my-store',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ items: state.items, total: state.total }),
    merge: (persistedState, currentState) => {
      const ps = (persistedState ?? {}) as Partial<MyState>;
      return {
        ...currentState,
        ...ps,
        items: Array.isArray(ps.items) ? ps.items : currentState.items,
        total: typeof ps.total === 'number' ? ps.total : currentState.total,
      };
    },
  },
)
```

**Stores hardened in FIX-019:**
- `src/stores/taskStore.ts` — `hq_task_store` (tasks, total, page)
- `src/stores/agentStore.ts` — `hq_agent_store` (agents, total)
- `src/stores/departmentStore.ts` — `hq_department_store` (departments, total)
- `src/stores/uiPreferencesStore.ts` — `ui-preferences-store` (visibleIcons, visibleWidgets, widgetOrder)

**Stores NOT hardened (intentionally, no persist):**
- `useAuthStore` — persist only stores `user` (object) and `isAuthenticated` (boolean), both validated on read
- `useApprovalsStore` — no persist; always starts from initial state
- `useActivityStore` — no persist; populated by WebSocket

### 19.2 `Array.isArray` guards (defense at every consumer)

Even with `merge` functions, **every consumer** of a persisted store must defensively guard. Two reasons:
1. The `merge` is best-effort; a hostile localStorage entry could still pass through.
2. Future store changes (e.g. a new field) won't be in the `merge` until someone remembers to add it.

**Pattern (mandatory for any new component reading a persisted store):**
```tsx
const visibleWidgetsRaw = useUIPreferencesStore((s) => s.visibleWidgets);
const visibleWidgets = Array.isArray(visibleWidgetsRaw) ? visibleWidgetsRaw : [];
// Then use visibleWidgets — never the raw value.
```

**Components hardened in FIX-019:**
- `src/components/home/RightPanel.tsx` — `visibleWidgets`
- ~~`src/components/home/LeftPanel.tsx` — `visibleIcons`~~ *(deleted in FIX-021)*
- ~~`src/components/home/PreferencesModal.tsx` — `visibleWidgets`~~ *(deleted in FIX-021; icon toggles now live in `RailCustomizeModal`)*
- `src/components/home/TasksWidget.tsx` — `tasks` (FIX-018)
- `src/components/home/LiveFeedWidget.tsx` — `events` (FIX-018)
- `src/shared/hooks/useAIChat.ts` — `agents`
- `src/app/command-center/page.tsx` — `agents`, `tasks`, `departments` (18+ accesses)
- `src/features/org-chart/hooks/useOrgChart.ts` — `departments`, `agents`
- `src/app/departments/[id]/workspace/page.tsx` — `departments`, `agents`, `tasks`

### 19.3 WebSocket URL must derive from `window.location`

**Anti-pattern (banned):**
```ts
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';
```

**Correct pattern (services/socket.ts):**
```ts
const SOCKET_URL = (() => {
  if (typeof window === 'undefined') return '';
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (window.location.protocol === 'https:') return `wss://${window.location.host}`;
  return `ws://${window.location.host}`;
})();
```

A missing `NEXT_PUBLIC_*` env var should derive from the runtime context, not silently fall back to a dev-only value. See [operations.md §6.5](operations.md#65-never-hardcode-localhost3000-in-production-code).

### 19.4 Every `<Link>` must have a page

TopBar.tsx linked to `/help` (line 213 in the avatar menu, line 270 in the toolbar). Next.js prefetches on viewport/hover; 404s are noise. **FIX-019** added `src/app/help/page.tsx` — a real help page with documentation links, live chat trigger, and email support.

**Rule for new `<Link>` elements:** create the page in the same commit, or change the link to a `<button>` with a real handler.

### 19.5 Pre-existing build error: `setWorkflows` not destructured

`command-center/page.tsx` was calling `setWorkflows` from `useWorkflowStore` but the import was the only reference — the destructure was missing. The build was failing on this, but only caught during FIX-019's redeploy because we ran `next build` end-to-end.

**Lesson:** `npm run lint` does NOT catch missing destructures. Always run `next build` (or `nest build`) before rsync. See [deployment.md §10](deployment.md#10-pre-deploy-checklist) for the pre-deploy checklist.

**Files changed in FIX-019:**
- `src/stores/{taskStore,agentStore,departmentStore,uiPreferencesStore}.ts` — added `merge` functions
- `src/services/socket.ts` — derive URL from `window.location`
- `src/app/settings/page.tsx` — preserve + forward sub-tab params (FIX-017 carryover)
- `src/app/help/page.tsx` — new
- `src/app/home/page.tsx` — loading skeleton (FIX-018 carryover)
- `src/app/intelligence/page.tsx` — sub-tab state (FIX-017 carryover)
- `src/components/home/{TasksWidget,LiveFeedWidget,RightPanel,HomeKpiStrip,ApprovalsWidget,StatsWidget}.tsx` — guards *(LeftPanel + PreferencesModal deleted in FIX-021)*
- `src/shared/hooks/useAIChat.ts` — guards
- ~~`src/app/command-center/page.tsx` — guards + fixed `useWorkflowStore` destructure~~ *(deleted in FIX-021; the `/command-center` route is rewritten to `/home`)*
- `src/app/departments/[id]/workspace/page.tsx` — guards
- `src/features/org-chart/hooks/useOrgChart.ts` — guards
- `.env.production` — explicit empty `NEXT_PUBLIC_SOCKET_URL`

---

## 15. Quick health checks

```bash
# From Contabo
ssh contabo 'pm2 show neurecore-tenant | grep -E "status|uptime|restarts|memory"'
ssh contabo 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3005/'    # 200 (or 307 → /login)

# From outside
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/                # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/login          # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/command-center  # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://hq.neurecore.com/api/v1/agents   # 401 (auth required)

# After FIX-020 — the 401 path no longer hard-redirects to /login. The user sees
# a <SessionExpiredScreen /> and clicks "Sign in again". Verify with Playwright:
PLAYWRIGHT_BASE_URL=https://hq.neurecore.com npx playwright test prod-auth-smoke --project=chromium --workers=1
```

---

## 20. Auth system (FIX-020 — shipped 2026-07-07)

> **⚠️ DO NOT CORRUPT.** See [`int-features/auth-architecture.md`](../int-features/auth-architecture.md) — the authoritative reference. Treat any auth regression as Critical; run `bash scripts/auth-lint.sh` before any auth-touching PR.

The auth system was reorganised on 2026-07-07 from an ad-hoc multi-file wiring (with two parallel state machines + dead localStorage code) into a single `IAuthService` facade:

| Before (deprecated, gone) | After (FIX-020, current) |
|---|---|
| Multiple files import `useAuthStore` directly; pages race the hydration | `useAuth()` returns discriminated `AuthState` (`initializing | unauthenticated | authenticated | error`) |
| `lib/security.ts` had `SecureStorageKey`/`setSecureToken` writing to `sessionStorage["nc_at"]` (wrong key) | **Deleted.** Replaced by `ITokenRepository` (cookie-only). |
| `lib/errors.ts:useErrorHandler` cleared `localStorage.tenant_accessToken` + `window.location.href = '/login'` on 401 | `useErrorHandler` just maps errors. 401 → `authService.reportAuthFailure()` → `<SessionExpiredScreen />` |
| `useTenantAuth()` returned `null` during hydration → page renders blank → fetch → 401 → hard-redirect | `useTenantAuth()` is a back-compat shim over `useAuth()` with `AuthUser|null` return preserved |
| 3 axios instances (`api.ts`, `RestClient.ts`, admin `api.ts`) with independent refresh | Single `authHttpClient` + `authResponseInterceptor` → `authService.reportAuthFailure` |
| `AppInitializer.tsx:54` cleared cookies on any `/me` failure (transient/proxy) | `authService.initialize()` only transitions to `unauthenticated` on explicit 401 |
| `clearTokens()` cleared cookies but not the Zustand store → stale-user loop | `IAuthSessionLifecycle.killSession()` is atomic: cookies + store + eventBus + BroadcastChannel |
| ProfileDetail saved stale `user` prop back to persisted store | `handleSaveProfile` reads `useAuthStore.getState().user` at save time |

**New file layout** (both `frontend-tenant/src/auth/` and `frontend-admin/src/auth/` mirror each other):
```
src/auth/
├── core/interfaces.ts          ← 7 SOLID interfaces + types
├── impl/                       ← 7 implementations + BaseAuthService (L2)
├── hooks/{useAuth,useTenantAuth|useAdminAuth,useRequireAuth}.ts
├── components/{AuthProvider,SessionExpiredScreen,AuthErrorScreen,LockoutScreen,AuthLoadingScreen}.tsx
├── transport/{authHttpClient,authResponseInterceptor}.ts
├── di/authContainer.ts         ← composition root
├── __tests__/                  ← 5 vitest spec files (27 tests)
└── index.ts
```

For any new auth wiring, **read [`int-features/auth-architecture.md`](../int-features/auth-architecture.md) first** and route everything through `useAuth()` + `IAuthService`. The lint script catches regressions:
```
bash scripts/auth-lint.sh
# OK — no banned patterns found.
```
Failing patterns:
- `localStorage.setItem/getItem/removeItem` with auth keys outside `src/auth/`
- `sessionStorage.setItem/getItem/removeItem` with auth keys outside `src/auth/`
- `document.cookie = ...` outside `src/auth/impl/CookieTokenRepository.ts`
- `window.location.href = '/login'` outside `src/auth/`
- `useAuthStore.getState().setUser/clearUser` outside `src/auth/impl/ZustandUserRepository.ts`
- `SecureStorageKey` / `setSecureToken` / `getSecureToken` (all dead legacy helpers)

---

## 21. Tenant-specific AI Employee profiles (FIX-026, shipped 2026-07-08)

> **See also:** [fixes.md §FIX-026](fixes.md#fix-026--tenant-specific-ai-employee-profile-avatar-designation-bio-color-emoji--2026-07-08) — full change log + deploy notes.

Tenants can now fully customize each AI Employee's profile. Two tenants spawning the same Fleet Manager template can have completely different avatar, name, designation, bio, color theme, and emoji.

### Data model

| Field | Source | Default | Notes |
|---|---|---|---|
| `avatarUrl` | `metadata.profile.avatarUrl` | `null` | URL returned by `POST /uploads/agent-avatar` |
| `designation` | `metadata.profile.designation` | `null` | ≤100 chars (e.g. "Sales Lead") |
| `bio` | `metadata.profile.bio` | `null` | ≤1000 chars, multi-line |
| `color` | `metadata.profile.color` | `null` | One of 9 named colors (blue/purple/green/red/orange/pink/teal/indigo/gray) |
| `emoji` | `metadata.profile.emoji` | `null` | ≤8 chars (single emoji or short string) |

Backend stores profile fields under `metadata.profile.*` and merges on every update — no Prisma migration was needed. All other metadata keys (`fromPackageId`, `authorityLevel`, `roleTemplateName`, etc.) are preserved across updates.

### API endpoints (added/changed)

| Endpoint | Method | Roles | Purpose |
|---|---|---|---|
| `/api/v1/agents/:id` | `PATCH` (extended) | OWNER/ADMIN/SUPER_ADMIN/PLATFORM_ADMIN | Now accepts `avatarUrl`, `designation`, `bio`, `color`, `emoji`. Merged into `metadata.profile.*`. |
| `/api/v1/uploads/agent-avatar` | `POST` (multipart) | same | Upload avatar (PNG/JPEG/WEBP/SVG, ≤2MB). Returns `{ url, key, size }`. |
| `/api/v1/uploads/agent-avatar/:key` | `DELETE` | same | Delete uploaded avatar. Idempotent. |

### Frontend components (added/changed)

| File | Purpose |
|---|---|
| `src/components/agents/AgentAvatar.tsx` | **New reusable avatar renderer.** 3-tier resolution: uploaded image → tenant emoji → initial letter on color-tinted background. |
| `src/components/agent-card/AgentCard.tsx` | Both `compact` and `full` variants now render `<AgentAvatar>`. Bio shown as 2-line clamp on full cards. Subtitle prefers `designation`, falls back to `role`, then `type`. |
| `src/components/inspector/AgentInspector.tsx` | Rewrote with editable profile section. "Edit Profile" button toggles an inline editor with avatar upload/replace/remove + designation + bio + color + emoji inputs. Save calls `PATCH /api/v1/agents/:id`. Cancel restores prior values. |
| `src/services/uploads.service.ts` | Added `uploadAgentAvatar()`, `deleteAgentAvatar()`, and `AGENT_AVATAR_UPLOAD` constants (mirrors `LOGO_UPLOAD`). |
| `src/core/services/api/adapters/AgentAdapter.ts` | New `extractProfile()` defensive read of `metadata.profile`. Profile fields flow into `Agent` adapter output. |
| `src/types/ui.types.ts` | `AgentCardData` got 5 new optional fields. |
| `src/shared/types/domain.types.ts` | `Agent` domain type got the same 5 fields with `string \| null`. |
| `src/app/marketplace/page.tsx` | `AgentRaw` got `metadata?`. Card mapping forwards all profile fields to `AgentCard`. |

### Defensive patterns
- Adapter's `extractProfile()` does `typeof === 'string'` checks on every field — corrupted `metadata.profile` shape falls back to `null`, never crashes
- Avatar upload reuses the same MIME-sniff + size validation as logo uploads (defense against spoofed Content-Type)
- Backend merge logic never clobbers fields outside `metadata.profile`

### Render resolution order (visual priority)
1. **`avatarUrl`** (uploaded image) — shown as `<img>` in a circular crop
2. **`emoji`** — shown as the emoji character on a color-tinted circle
3. **Initial letter** of `name` on a color-tinted circle (uses `color` if set, else zinc-700)

---

## 22. 2026-07-10 — Tenant Portal end-to-end validation (Kilo)

### Deploy steps used (2026-07-10)

```bash
# From local workspace root
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore

# 1. Build locally (NOT just lint — catches what lint misses)
cd frontend-tenant && rm -rf .next && npm run build && cd ..
#   # → 31 routes compiled, no errors

# 2. Sync to Contabo
rsync -az --delete frontend-tenant/.next/ contabo:/opt/neurecore/frontend-tenant/.next/
#   # Important: --delete to clear stale chunks

# 3. Restart PM2 process
ssh contabo "pm2 restart neurecore-tenant"
#   # → neurecore-tenant online, port 3005, ready in ~10s

# 4. Verify
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  hq api %{http_code}\n" https://hq.neurecore.com/api/v1/health
```

### Defensive guard added — `ProjectInspector.tsx`

**File:** `frontend-tenant/src/components/inspector/ProjectInspector.tsx`

The project page crashed with `TypeError: Cannot read properties of undefined (reading 'map')` at `health.signals.map` whenever the `getHealth` API returned an object with `signals: undefined` (which happens when the project has no health record yet — the DB returns `data: null` → `unwrapItem` returns `null` → but edge cases can leak a malformed object).

**Before:**
```tsx
{health && (
  <>
    <HealthScoreBar health={health} />
    <div className="space-y-1">
      {health.signals.map((s) => (    // ← crashes if signals is undefined
        <SignalRow key={s.name} signal={s} />
      ))}
    </div>
    ...
  </>
)}
```

**After:**
```tsx
{health && Array.isArray(health.signals) && (
  <>
    <HealthScoreBar health={health} />
    <div className="space-y-1">
      {health.signals.map((s) => (
        <SignalRow key={s.name} signal={s} />
      ))}
    </div>
    ...
  </>
)}
```

Same guard added to the `recalculateHealth` callback so a malformed response can't `setHealth` with an invalid object.

This follows the **FIX-019 defensive patterns** ([fixes.md](fixes.md#defensive-patterns-cheat-sheet-from-fix-018--fix-019)): every consumer of API data must defensively guard even though the `unwrapItem` function in `services/unwrap.ts` should ideally catch null data first.

### Features tested end-to-end (2026-07-10)

| # | Feature | Result | Notes |
|---|---|---|---|
| 1 | Project page load | ✅ | No crash, all 3 projects load |
| 2 | Status transitions (LEAD→PROPOSAL_SENT→WON→ACTIVE) | ✅ | Gamma Brand Campaign Q3 full pipeline |
| 3 | Stages management (add new stage) | ✅ | "Review" stage added |
| 4 | Team assignment | ✅ | REVIEWER AI user_mali_test assigned |
| 5 | Goals (create) | ✅ | Required FIX-028 (UUID validation) |
| 6 | Deliverables (create) | ✅ | "Brand Strategy Document" DRAFT |
| 7 | Knowledge → Memory (create) | ✅ | Required FIX-031 (enum rename) |
| 8 | Knowledge → Decisions (create) | ✅ | Required FIX-031 (enum rename) |
| 9 | Approvals modal load | ✅ | Required FIX-029 + FIX-030 |
| 10 | Customer list + detail | ✅ | All 3 customers navigable |
| 11 | Dashboard / Home page | ✅ | Creatio-style 3-column with LiveFeed, KPIs, Quick Actions |
| 12 | Project creation wizard (3 steps) + deletion | ✅ | Created "Test Project for Deletion" then deleted it |

### Known browser console issues (pre-existing)

- **`Socket.IO 400 errors`** on every page (`/socket.io/?EIO=4&transport=polling&sid=...` returns 400). Real-time features (Activity Feed push, Live presence, Approvals WS) are silently broken. See [pending-tasks.md D22](pending-tasks.md).

### Files modified (frontend-tenant) — needs git commit

```bash
git status frontend-tenant/
# modified: src/components/inspector/ProjectInspector.tsx
# modified: src/services/unwrap.ts  (earlier session — was an issue with null data envelopes)
```

Sync to Contabo was via `rsync -az --delete` to the `.next/` output. The source files in `frontend-tenant/src/` are **not yet committed** (see [pending-tasks.md D23](pending-tasks.md)).

---

## 23. Org Chart Overhaul (2026-07-20)

**Status:** ✅ Core implementation complete · 🟡 Layout fix in progress

### What was built

A brand-new org chart visualization was built and deployed to `hq.neurecore.com/departments?tab=org-chart`. The old inline `TreeView` was replaced with a proper hierarchical visualization:

| Component | File | Notes |
|---|---|---|
| `OrgChartView.tsx` | `features/org-chart/components/` | Top-to-bottom tree renderer with CSS connector lines |
| `DeptCard.tsx` | `features/org-chart/components/` | Per-department card with expand/collapse, agent grid |
| `EmployeeCard.tsx` | `features/org-chart/components/` | Agent sub-card: name, designation, date joined, workload, success rate |
| `useOrgChart.ts` | `features/org-chart/hooks/` | `tenantTree` with phantom tenant root node + `buildHierarchy()` |
| `dept-colors.ts` | `features/org-chart/utils/` | 12-color deterministic palette per department |
| `OrgChartPanel.tsx` | `features/org-chart/components/` | Rewritten to use `OrgChartView` instead of old `TreeView` |

### Tasks completed

| Task | Description | Status |
|---|---|---|
| 1 | Fix `Department` domain type (`parentId`, `status`, `headAgentId`, `_count`) | ✅ |
| 2 | `moveAgent` to `agentStore` + `AgentRepository.UpdateAgentDto` | ✅ |
| 3 | Wire `moveAgent` in `useOrgChart` hook with optimistic rollback | ✅ |
| 4 | Remove local `Department`/`AgentLite` shadows in `departments/page.tsx` | ✅ |
| 5 | Replace `TreeView` with `OrgChartPanel` + new components | ✅ |
| 6 | Refactor `OrgTree` sidebar to use repositories | ✅ |

### Layout issues (IN PROGRESS as of 2026-07-20)

- Excessive empty padding on right/left inside the container
- Employee Name & Designation getting cut off due to `max-w-[220px]` on `EmployeeCard`
- Fix involves: widening `EmployeeCard` or using `flex-wrap`, reducing `OrgChartPanel` outer padding

### Disaster recovery snapshots

Taken before each major change phase:
- `20260720-123951-pre-orgchart-deploy`
- `20260720-125808-pre-orgchart-viz`
- `20260720-131158-pre-orgchart-colors`

### Deploy steps (4 total deploys to Contabo)

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-tenant
npm run build
rsync -az --delete .next/ contabo:/opt/neurecore/frontend-tenant/.next/
ssh contabo "pm2 restart neurecore-tenant"
curl -sk -o /dev/null -w "%{http_code}" https://hq.neurecore.com/
```

---

## 24. Simulation-5: AEIC — Frontend Integration (2026-07-17)

Deployed frontend-tenant to Contabo and tested 12 features end-to-end with `mali@live.com`. All features are now functional. One defensive guard was added to the project page component; the other 4 fixes are backend-side (FIX-028, FIX-029, FIX-030, FIX-031 — see [backend.md §15](backend.md#15-2026-07-10--tenant-portal-validation-fixes-kilo)).

### Deploy steps used (2026-07-10)

```bash
# From local workspace root
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore

# 1. Build locally (NOT just lint — catches what lint misses)
cd frontend-tenant && rm -rf .next && npm run build && cd ..
#   # → 31 routes compiled, no errors

# 2. Sync to Contabo
rsync -az --delete frontend-tenant/.next/ contabo:/opt/neurecore/frontend-tenant/.next/
#   # Important: --delete to clear stale chunks

# 3. Restart PM2 process
ssh contabo "pm2 restart neurecore-tenant"
#   # → neurecore-tenant online, port 3005, ready in ~10s

# 4. Verify
curl -sk -o /dev/null -w "  hq    %{http_code}\n" https://hq.neurecore.com/
curl -sk -o /dev/null -w "  hq api %{http_code}\n" https://hq.neurecore.com/api/v1/health
```

### Defensive guard added — `ProjectInspector.tsx`

**File:** `frontend-tenant/src/components/inspector/ProjectInspector.tsx`

The project page crashed with `TypeError: Cannot read properties of undefined (reading 'map')` at `health.signals.map` whenever the `getHealth` API returned an object with `signals: undefined` (which happens when the project has no health record yet — the DB returns `data: null` → `unwrapItem` returns `null` → but edge cases can leak a malformed object).

**Before:**
```tsx
{health && (
  <>
    <HealthScoreBar health={health} />
    <div className="space-y-1">
      {health.signals.map((s) => (    // ← crashes if signals is undefined
        <SignalRow key={s.name} signal={s} />
      ))}
    </div>
    ...
  </>
)}
```

**After:**
```tsx
{health && Array.isArray(health.signals) && (
  <>
    <HealthScoreBar health={health} />
    <div className="space-y-1">
      {health.signals.map((s) => (
        <SignalRow key={s.name} signal={s} />
      ))}
    </div>
    ...
  </>
)}
```

Same guard added to the `recalculateHealth` callback so a malformed response can't `setHealth` with an invalid object.

This follows the **FIX-019 defensive patterns** ([fixes.md](fixes.md#defensive-patterns-cheat-sheet-from-fix-018--fix-019)): every consumer of API data must defensively guard even though the `unwrapItem` function in `services/unwrap.ts` should ideally catch null data first.

### Features tested end-to-end (2026-07-10)

| # | Feature | Result | Notes |
|---|---|---|---|
| 1 | Project page load | ✅ | No crash, all 3 projects load |
| 2 | Status transitions (LEAD→PROPOSAL_SENT→WON→ACTIVE) | ✅ | Gamma Brand Campaign Q3 full pipeline |
| 3 | Stages management (add new stage) | ✅ | "Review" stage added |
| 4 | Team assignment | ✅ | REVIEWER AI user_mali_test assigned |
| 5 | Goals (create) | ✅ | Required FIX-028 (UUID validation) |
| 6 | Deliverables (create) | ✅ | "Brand Strategy Document" DRAFT |
| 7 | Knowledge → Memory (create) | ✅ | Required FIX-031 (enum rename) |
| 8 | Knowledge → Decisions (create) | ✅ | Required FIX-031 (enum rename) |
| 9 | Approvals modal load | ✅ | Required FIX-029 + FIX-030 |
| 10 | Customer list + detail | ✅ | All 3 customers navigable |
| 11 | Dashboard / Home page | ✅ | Creatio-style 3-column with LiveFeed, KPIs, Quick Actions |
| 12 | Project creation wizard (3 steps) + deletion | ✅ | Created "Test Project for Deletion" then deleted it |

### Known browser console issues (pre-existing)

- **`Socket.IO 400 errors`** on every page (`/socket.io/?EIO=4&transport=polling&sid=...` returns 400). Real-time features (Activity Feed push, Live presence, Approvals WS) are silently broken. See [pending-tasks.md D22](pending-tasks.md).

### Files modified (frontend-tenant) — needs git commit

```bash
git status frontend-tenant/
# modified: src/components/inspector/ProjectInspector.tsx
# modified: src/services/unwrap.ts  (earlier session — was an issue with null data envelopes)
```

Sync to Contabo was via `rsync -az --delete` to the `.next/` output. The source files in `frontend-tenant/src/` are **not yet committed** (see [pending-tasks.md D23](pending-tasks.md)).

---

## 24. Simulation-5: AEIC — Frontend Integration (2026-07-17)

**Status:** ✅ COMPLETE — Simulation overview UI integrated; headed browser witness mode operational

### Simulation overview UI

The simulation overview uses `SimulationVisibilityService` with `includeSimulation: true` to display simulation artifacts alongside production data. Production views use default filters automatically (simulation artifacts hidden by default).

### Headed browser witness mode

```bash
# Open browser, login, run simulation, take witness screenshots
node headed-browser.js

# Login only
node headed-browser.js login

# Open browser then run full simulation
node headed-browser.js all
```

- Launches Chromium (headless: false) at 1600×1000
- Opens tenant frontend + admin frontend in two tabs
- Takes `witness-01-before.png` before running
- Spawns `simulation-5-runner.cjs` as background process
- Takes `witness-02-after.png` after completion
- Credentials displayed in console:
  - Email: `simulation5-aeic@neurecore.test`
  - Password: `Sim5AEIC!2026SecurePass`

### Evidence artifacts

```
simulation-5-evidence/
├── FINAL-INDEX.json              # 83/100, 15 deliverables index
├── simulation-state.json         # Full simulation state (33K lines)
├── day-01/ through day-60/       # Daily snapshots
├── deliverable-01-* through deliverable-15-*  # JSON + Markdown
├── witness-01-before.png
└── witness-02-after.png
```

### Simulation-5 runner (`headed-browser.js`)

Located at workspace root:
```
/home/najeeb/Linux-Dev/neurecore-2026/headed-browser.js
```

The runner connects to:
- Frontend: `https://hq.neurecore.com`
- Admin: `https://cc.neurecore.com`
- Backend: `https://brain.neurecore.com/api/v1`

### References

- Full implementation: `simulations/simulation-5-honest/COMPLETION.md`
- Execution report: `simulations/simulation-5-implementation/REPORT.md`
- Headed browser runner: `../../headed-browser.js` (workspace root)

---

**End of frontend-tenant.md.**