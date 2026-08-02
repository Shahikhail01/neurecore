# Frontend-Admin (NeureCore admin console)

**Last verified:** 2026-07-31 — **FULL SYSTEM AUDIT COMPLETED**

**⚠️ DEPLOYMENT STATUS:** Local is `fe335abb`; Contabo deployed is `ad73f3e6` — **deployment required to get latest**

**Live URL:** `https://cc.neurecore.com` (under `/admin/` basePath)
**Internal port:** 3020
**PM2:** `neurecore-admin` (pid 583314, online)
**Source:** `/home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin/`
**RBAC:** SUPER_ADMIN only (per [user-roles.md](user-roles.md))
**Sibling docs:** [system-state.md](system-state.md) · [operations.md](operations.md) · [backend.md](backend.md) · [contabo-ops.md](contabo-ops.md) · [user-roles.md](user-roles.md)

---

## TL;DR

The platform-admin console: login, command palette, brain-map visualization, agents/tenants/audit/billing/connectors CRUD, AI settings, tier management. Built with Next.js 15 App Router + React 19 + Radix UI + Tailwind + Zustand + Recharts + D3/visx. Reverse-proxied by OLS at `cc.neurecore.com` → `127.0.0.1:3020`. Started via PM2 `neurecore-admin`.

Distinct from tenant UI: **no per-tenant org chart, focuses on platform-wide data and configuration.** **Admin access is SUPER_ADMIN only** per [user-roles.md](user-roles.md) RBAC policy.

---

## 1. Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.12 |
| Runtime | React | 19 |
| Language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 3.4 |
| Components | Radix UI (3 packages: dialog, dropdown, tooltip), cmdk, sonner | latest |
| State | Zustand | 5 |
| Charts | Recharts + visx/network + d3 | 3.7 / 3.12 / 7.9 |
| Animations | Framer Motion | 12 |
| Forms / Validation | zod | 3.24 |
| HTTP | axios | 1.7 |
| Realtime | socket.io-client | 4.8 |
| Auth client | jose | 5.9 |
| Date | date-fns | 4.1 |
| Tests | (none configured) | — |

---

## 2. Process / deploy

| Item | Value |
|---|---|
| PM2 process | `neurecore-admin` (id 42) |
| Startup | `/opt/neurecore/frontend-admin/start.sh` → `./node_modules/.bin/next start --hostname 127.0.0.1 --port 3020` |
| Build output | `/opt/neurecore/frontend-admin/.next/` |
| Env file | `/opt/neurecore/frontend-admin/.env.production` |
| Local dev port | `3002` |

Rebuild: `bash /opt/neurecore/rebuild.sh admin`.

---

## 3. Routing (App Router)

OLS `cc.neurecore.com` rewrites 22 root paths (`/admin`, `/agents`, `/agents-pool`, `/audit`, `/billing`, `/brain`, `/connectors`, `/departments-pool`, `/dept-templates`, `/features`, `/industries`, `/infrastructure`, `/login`, `/logout`, `/models` (redirects to `/admin/models`), `/monitoring`, `/overview`, `/packages`, `/security`, `/settings`, `/strategy`, `/tenants`, `/tier-templates`, `/tiers`, `/users`) to `/admin/...` inside Next.js. Catch-all proxies everything else.

Top-level app routes:

```
src/app/
├── page.tsx                            # / → /admin/overview (rewrite)
├── login/page.tsx                      # /login → /admin/login
├── admin/
│   ├── layout.tsx                      # admin shell (sidebar + topbar)
│   ├── overview/page.tsx               # /admin/overview
│   ├── agents/...                      # /admin/agents
│   ├── agents-pool/...                 # /admin/agents-pool        [Phase 10]
│   ├── agent-templates/page.tsx        # /admin/agent-templates (302 → /agents-pool) [Phase 10]
│   ├── audit/...                       # /admin/audit
│   ├── billing/...                     # /admin/billing
│   ├── brain/...                       # /admin/brain
│   ├── connectors/...                  # /admin/connectors
│   ├── departments-pool/...            # /admin/departments-pool   [Phase 10]
│   ├── dept-templates/page.tsx         # 302 → /departments-pool   [Phase 10]
│   ├── features/...                    # /admin/features           [Phase 10]
│   ├── industries/...                  # /admin/industries         [Phase 10]
│   ├── infrastructure/...
│   ├── models/...
│   ├── monitoring/...
│   ├── packages/...                    # /admin/packages           [Phase 10]
│   │   ├── page.tsx                    # list
│   │   ├── new/page.tsx                # 4-step composer
│   │   └── [id]/page.tsx + edit/page.tsx
│   ├── security/...
│   ├── settings/
│   │   ├── general/page.tsx
│   │   ├── ai/page.tsx
│   │   ├── tiers/page.tsx
│   │   ├── email/page.tsx
│   │   └── audit/page.tsx
│   ├── strategy/...
│   ├── tenants/...
│   ├── tier-templates/page.tsx         # 302 → /tiers              [Phase 10]
│   ├── tiers/...                       # /admin/tiers              [Phase 10]
│   └── users/...
└── api/v1/                             # ★ Next.js API routes that PROXY to backend
    ├── auth/{login,register,refresh,me}/route.ts
    ├── agents/...                      # /api/v1/agents → backend
    ├── audit/...
    ├── connectors/...
    ├── departments/...
    ├── finance/...
    ├── governance/...
    ├── health/route.ts                 # /api/v1/health → backend
    ├── memory/...
    ├── models/...
    ├── notifications/...
    ├── observability/...
    ├── orchestration/...
    ├── reliability/...
    ├── tenants/...
    ├── tools/...
    ├── users/...
    ├── dept-templates/...
    ├── agent-templates/...
    └── analytics/...
```

**Important**: The frontend runs its own Next.js API routes that proxy to the backend. So `cc.neurecore.com/api/v1/health` would normally hit Next.js route → backend. But the OLS vhost doesn't proxy `/api/v1/*` paths to the Next.js — only `/` (with rewrites). Instead, the admin client uses `NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1` (absolute) so the browser calls backend directly, bypassing Next.js API routes entirely.

The Next.js API routes are a fallback / future-proofing for when admin needs to do server-side transformations.

---

## 3a. Six Pools — business-composition architecture (Phase 10)

The Admin composes commercial offerings from **six orthogonal pools**. Each pool has one Prisma model (backend) and one page (frontend). Concept ref: [plans/admin-business-composition.md](plans/admin-business-composition.md).

| # | Pool | Admin route | Backend route | Prisma model |
|---|---|---|---|---|
| 1 | AI Employees | `/agents-pool` | `/api/v1/agents-pool` | `AgentTemplate` (+`enabled`) |
| 2 | Departments | `/departments-pool` | `/api/v1/departments-pool` | `DepartmentTemplate` (hides `category='legacy-tier'`) |
| 3 | Industries | `/industries` | `/api/v1/industries` | `Industry` (NEW) |
| 4 | Tiers | `/tiers` | `/api/v1/tier-templates` | `TierTemplate` (NEW; distinct from billing `Tier`) |
| 5 | Features | `/features` | `/api/v1/features` | `Feature` (NEW; grouped by 8 categories) |
| 6 | Packages | `/packages` | `/api/v1/packages` | `Package` (NEW; composite root) |

Hierarchy:

```
Industry ── (1) ─┐
                 ├── Package ── (N) ── (1) TierTemplate
TierTemplate ────┘                │
                                  ├── (N) DepartmentTemplate
                                  ├── (N) AgentTemplate
                                  └── (N) Feature
```

### Frontend SOLID surface

```
src/lib/pool/IPoolAdminService.ts            # interface — DIP contract
src/services/industriesPool.service.ts      # implements IPoolAdminService
src/services/tiersPool.service.ts
src/services/featuresPool.service.ts
src/services/departmentsPool.service.ts
src/services/agentsPool.service.ts          # + setEnabled + duplicate
src/services/packages.service.ts            # + updateComposition + preview

src/hooks/usePoolList.ts                     # generic CRUD hook (DIP-bound)
src/components/pool/PoolToolbar.tsx         # shared UI (OCP — props-driven)
src/components/pool/PoolStatusBadge.tsx
src/components/pool/PoolEmptyState.tsx
src/components/pool/PoolConfirmDeleteDialog.tsx
src/components/pool/PoolPagination.tsx      # shared pagination shell (limit=20/page)
src/components/package/PackagePreview.tsx   # the composer's side-rail

src/components/sidebar/navigation.config.ts # SINGLE SOURCE OF TRUTH for nav
                                             # (consumed by AdminShell AND command palette)
```

Adding a 7th pool (per OCP): one service implementing `IPoolAdminService`, one page importing `PoolToolbar`/`PoolPagination`/`PoolStatusBadge`/etc., one entry in `navigation.config.ts`. No other changes.

**Pagination pattern (important):** All pool pages use `usePoolList` hook. Search/filter changes must call `setOpts({ search, status, page: 1, limit: 20 })` in `useEffect` — NOT a direct `service.list()` call followed by `refresh()`. The hook's internal `useEffect` on `opts` handles fetching. `PoolPagination` wires `onPageChange` to `setOpts((o) => ({ ...o, page: p }))`.

### Back-compat

- `/agent-templates` → 302 `/agents-pool`
- `/dept-templates` → 302 `/departments-pool`
- `/tier-templates` → 302 `/tiers`
- Old `DepartmentTemplate` rows with `slug LIKE 'tier-%'` → `category='legacy-tier'` (kept but hidden by `departments-pool`)

---

## 4. State (Zustand stores)

```
src/stores/
├── authStore.ts            # JWT, current user, login/logout
├── activityStore.ts        # Recent activity feed
├── chatStore.ts            # AI chat sessions
├── commandStore.ts         # Cmd+K command palette
└── inspectorStore.ts       # Selected entity inspector panel
```

All stores are persisted to `localStorage` where it makes sense (`authStore`, `commandStore`).

---

## 5. Hooks

```
src/hooks/
├── useAdminAuth.ts                # Back-compat shim over useAuth() (FIX-020) — wraps authStore + role checks
├── useAISettings.ts               # /admin/settings/ai
├── useAuditLogs.ts                # /admin/audit + filters
├── useBrainMapAnimations.ts       # visx + d3 animation loop for brain graph
├── useChat.ts                     # AI chat streaming
├── useEmailSettings.ts            # /admin/settings/email
├── useHealthMonitor.ts            # polls /health every 30s
├── usePlatformChartData.ts        # /admin/analytics charts
├── usePlatformKpis.ts             # /admin/overview KPI tiles
├── useStrategy.ts                 # /admin/strategy
├── useTierSettings.ts             # /admin/settings/tiers
└── useTimeRange.ts                # shared 24h/7d/30d/90d range selector
```

---

## 6. Components (high-level)

```
src/components/
├── layout/              # AdminShell, Sidebar, TopBar, UserMenu
├── sidebar/             # IconRail (collapsible vertical nav)
├── command-palette/     # Cmd+K modal (cmdk)
├── data-table/          # Generic paginated table with filters/sort
├── charts/              # Recharts wrappers (LineChart, BarChart, PieChart)
├── kpi/                 # KPI tile, delta, sparkline
├── agent-card/          # Agent status card with online/offline dot
├── inspector/           # Right-side detail drawer
├── chat/                # AI chat panel
├── brain-map/           # visx/network graph + d3 force layout
└── strategy/            # Goal-tree visualization
```

---

## 7. Configuration

### `next.config.js` (key settings)
- `output: 'standalone'` (for deployment packaging)
- `experimental.instrumentationHook: true`
- Image domains: `avatars.githubusercontent.com`, `lh3.googleusercontent.com`

### `.env.production` (Contabo, /opt/neurecore/frontend-admin/.env.production)
```ini
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://brain.neurecore.com/api/v1
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_TENANT_URL=https://hq.neurecore.com
NEXT_PUBLIC_ADMIN_URL=https://cc.neurecore.com
NEXT_PUBLIC_APP_NAME=NeureCore Admin
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_MAINTENANCE=false
NEXT_PUBLIC_DEFAULT_THEME=system
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
NEXT_PUBLIC_ENABLE_SOUND=false
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_WS_URL=wss://brain.neurecore.com
NEXT_PUBLIC_STORAGE_PROVIDER=local
NEXT_PUBLIC_S3_BUCKET=
```

---

## 8. Auth flow (post-FIX-020)

> **⚠️ DO NOT CORRUPT.** See [`int-features/auth-architecture.md`](../int-features/auth-architecture.md). All auth state changes go through `useAuth()` / `IAuthService`. The `bash scripts/auth-lint.sh` CI check enforces the banned patterns.

1. User hits `https://cc.neurecore.com/admin/login`
2. Form posts to `https://brain.neurecore.com/api/v1/auth/login` (admin uses absolute URL; `NEXT_PUBLIC_API_URL`). Tenant uses `/api/v1` relative — handled by OLS rewrite.
3. Backend sets `__Host-nc_at` (HttpOnly, 15min), `__Host-nc_rt` (HttpOnly, 7d), `__Host-nc_csrf` (JS-readable) cookies on `cc.neurecore.com`.
4. **Token reads** go through `src/auth/impl/CookieTokenRepository.ts` — the **only** file that touches `document.cookie`. The legacy `services/cookieAuth.ts` is now a thin shim that delegates to it.
5. **User store** is owned by `src/auth/impl/ZustandUserRepository.ts` — the only file that may call `useAuthStore.getState().setUser/clearUser`.
6. `src/auth/transport/authHttpClient.ts` (and the legacy `services/api.ts`, kept for back-compat) injects `X-CSRF-Token` on state-changing requests.
7. **The 401 path no longer hard-redirects.** The response interceptor (`src/auth/transport/authResponseInterceptor.ts`) calls `authService.reportAuthFailure(...)` instead. This transitions React state to `unauthenticated`; the page either renders a `<SessionExpiredScreen />` (with a "Sign in again" button) or the page-level guard handles the transition.
8. Auth endpoints (`/auth/login`, `/auth/register`, `/auth/google`, `/auth/refresh`) are exempt from the refresh-retry logic. A 401 on these means invalid credentials or expired refresh token and surfaces inline to the login form (`<LockoutScreen />` for 429).
9. `IAuthSessionLifecycle.killSession()` is **atomic** — clears cookies + clears user store + emits `SESSION_KILLED` + broadcasts on `BroadcastChannel` for cross-tab sync.
10. Admin role enforcement: `authService.login()` (admin subclass) enforces `ADMIN_ROLES = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT']` after the server call. Non-admins are logged out with an `AuthError('Insufficient permissions for admin portal.')`.
11. **OAuth (Google) is not available on the admin portal** — the admin's `AuthService.loginWithGoogle()` throws `AuthError('unknown', 'Google sign-in is not available in the admin portal.')`. Only tenant-portal users sign in with Google.
12. Admin `useAdminAuth` is a thin shim over `useAuth()` — see `src/hooks/useAdminAuth.ts` → `src/auth/hooks/useAdminAuth.ts`. Existing 24 admin pages keep working.

### Pre-FIX-020 behaviour (deprecated; do not reinstate)

The old §8 flow had:
- `useAdminAuth` returned `null` during hydration → page rendered blank → first API call → 401 → hard-redirect to `/login`
- `api.ts` interceptor cleared cookies via `cookieAuth.clear()` + `window.location.href = origin + '/login'` on 401/refresh fail (2 places)
- `lib/errors.ts:useErrorHandler` did the same hard-redirect on `TOKEN_EXPIRED|TOKEN_INVALID|REFRESH_TOKEN_EXPIRED` error codes
- `lib/security.ts` (with `SecureStorageKey` writing to wrong key) — deleted

The post-FIX-020 flow above replaces all of those. If you find yourself reimplementing any of them — stop and read [`int-features/auth-architecture.md`](../int-features/auth-architecture.md).

---

## 9. WebSocket / realtime

- Connected on mount via `socket.io-client`
- Subscribed events: `agent.execution.started/progress/completed`, `notification.created`, `inbox.message`
- Used to live-update: brain-map (agent status), inspector (live agent logs), chat streaming tokens

---

## 10. Tests

**No test files.** See [future-plans.md §3.4](future-plans.md). Verification is currently manual + smoke test (visit each route after deploy).

---

## 11. Local dev

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/frontend-admin
nvm use 20
npm install
npm run dev          # http://localhost:3002
npm run build        # production build
npm run type-check   # tsc --noEmit
npm run lint
```

Browser → backend: `NEXT_PUBLIC_API_URL` defaults to `http://localhost:3000` (set via `.env.local`, not committed). CORS proxy at `http://127.0.0.1:3004` accepts `http://localhost:3002` and forwards to backend.

---

## 12. Tenant detail page — profile & actions

The tenant detail view at `/tenants/[id]` has 4 tabs: Overview, Departments, Agents, Deploy.

### Overview tab — full tenant profile (7 sections)

| Section | Fields displayed |
|---|---|
| **Identity** | ID (truncated), Status (colored badge), Created, Updated |
| **Branding & Contact** | Website (link), Industry, Phone, Support Email (mailto), Logo (image if set) |
| **Company Profile** | Size bucket, Founded year, Business type, Address card (street/city/region/postal/country), Billing profile (dynamic key-value) |
| **Localization** | Locale, Timezone, Currency, Date format, Time format, Fiscal year start |
| **Onboarding** | Step, Completed date, Checklist dismissed date |
| **Tier Details** | Indigo-themed card with tier name, description, monthly/yearly pricing, all limits grid (agents, depts, users, storage, API calls, messages, file size), feature flags (SSO, API access, branding, audit export) |
| **System** | Retention days, Settings key count, Metadata key count |

Google Workspace section shown conditionally when Drive/Calendar IDs exist.

### Actions bar

Between the header card and tabs — always visible:

| Button | Color | Action |
|---|---|---|
| **Suspend** / **Activate** | Amber | Toggles tenant between `ACTIVE` and `SUSPENDED`. Confirmation dialog explains no data loss. |
| **Delete** | Red | Permanently deletes tenant + all cascaded data. Confirmation dialog warns of irreversible data loss, confirm label: "Delete Everything". |

Both require `SUPER_ADMIN` role. Confirmation uses `ConfirmDialog` component (`src/components/ConfirmDialog.tsx`) with framer-motion animations and `danger`/`warning` variants.

### Key files

| File | Purpose |
|---|---|
| `src/app/tenants/[id]/page.tsx` | Tenant detail page (4 tabs, full Overview, actions bar) |
| `src/components/ConfirmDialog.tsx` | Reusable confirmation dialog (danger/warning variants) |
| `src/types/api.types.ts` | Full `Tenant` (33 fields) + `TenantTier` (22 fields) + `TenantAddress` interfaces |

### Backend API consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/tenants/:id` | GET | Fetch tenant detail |
| `/api/v1/tenants/:id/suspend` | PATCH | Suspend tenant |
| `/api/v1/tenants/:id/activate` | PATCH | Reactivate tenant |
| `/api/v1/tenants/:id` | DELETE | Delete tenant + all data |

---

## 13. Known issues & gaps

1. **No tests** — manual verification only. (Phase 10 shipped 6 backend service specs — see [backend.md](backend.md). Frontend still has no React tests.) See [future-plans.md §3.4](future-plans.md).
2. **Next.js API routes duplicate backend endpoints** — currently unused (admin uses absolute brain URL). Either delete or document as intended for server-side enrichment.
3. **OLS vhost rewrites only 21 paths** (Phase 10 added 3: `/agents-pool`, `/departments-pool`, `/industries`, `/tiers`, `/features`, `/packages`) — new admin routes must be added to `/usr/local/lsws/conf/vhosts/cc.neurecore.com/vhost.conf` or the catch-all rewrite handles it (which it does).
4. **No Sentry** — `NEXT_PUBLIC_SENTRY_DSN` is empty. Errors rely on browser console.
5. **`next.config.js` standalone output** — fine for direct Node.js deploy on Contabo.
6. **Phase 10 — `agents-pool` page editor** — currently has a minimal edit modal (identity + system prompt). Full editor mirroring the legacy `/agent-templates` modal (permissions, config, version) is a follow-up; legacy service remains callable for now.

---

## 14. Quick health checks

```bash
# From Contabo
ssh contabo 'pm2 show neurecore-admin | grep -E "status|uptime|restarts|memory"'
ssh contabo 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3020/'    # 404 expected (no / route)

# From outside
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/                  # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/login     # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/agents     # 200

# Phase 10 — six pool routes (all require SUPER_ADMIN/PLATFORM_ADMIN role for backend)
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/agents-pool       # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/departments-pool  # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/industries         # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/tiers               # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/features            # 200
curl -sk -o /dev/null -w "%{http_code}\n" https://cc.neurecore.com/admin/packages            # 200
```

---

---

## 13. AI Gateway UI routes (deployed 2026-07-11)

Two new admin pages added for the AI Gateway:

### `/admin/models` (Models management)

Four tabs:
1. **Providers** — List with toggle/create; shows live reachability from `/admin/models/health`
2. **Models** — List per-provider; mark default per capability; create/edit
3. **Per-tenant Overrides** — Search tenant → view/edit overrides; capability × model select
4. **Health & Cost** — Circuit snapshot + cost summary (7/14/30/60/90 day window)

Source: `src/app/admin/models/page.tsx`

### `/admin/cost-summary` (Cost analytics)

Cost totals sorted by `costCents` descending. Shows provider, model, call count, tokens in/out, and a totals row. Day-range window selector (7/14/30/60/90 days).

Source: `src/app/admin/cost-summary/page.tsx`

### Sidebar

"Models" appears under the "Intelligence" section. Link: `/models` (Next.js basePath `/admin` auto-prepends to `/admin/models`).

### OLS vhost

`cc.neurecore.com` vhost already has `RewriteRule ^/?models(/.*)?$ /admin/models$1 [L]` (line 49). No additional rule needed for `/cost-summary` — the catch-all `RewriteRule .* - [L]` passes it through to Next.js.

### Known issue

Sidebar `href="/models"` renders as `/admin/models` (basePath prepended). Clicking navigates to `/admin/admin/models` due to client-side router adding basePath twice. This is a pre-existing routing bug, not AI-Gateway-specific. Workaround: navigate to `https://cc.neurecore.com/models` directly (OLS rewrites to `/admin/models` internally).

### Reference

- Full feature list: [ai-gateway-imp-plan.md](ai-gateway/ai-gateway-imp-plan.md)
- Backend module: [backend.md §16](backend.md)
- Deploy fixes: [fixes.md FIX-037 + FIX-038](fixes.md)

---

## 14. Settings / AI Providers page (extended 2026-07-11, Phase 2.8 2026-07-28)

The `Settings > AI Providers` page (`/admin/settings/ai`) calls a compatibility API layer (`AiProvidersController` at path `settings/ai`) that maps the frontend's expected response shape onto the gateway DB catalog.

### Route mapping

| Frontend calls | Backend route | Source |
|---|---|---|
| `GET /api/v1/settings/ai/providers` | `AiProvidersController.listProviders()` | `controllers/ai-providers.controller.ts` |
| `POST /api/v1/settings/ai/providers` | `AiProvidersController.createProvider()` — Phase 2.8 persists `apiKey` AES-256-GCM encrypted in `model_providers.encryptedKey` | same |
| `PATCH /api/v1/settings/ai/providers/:id` | `AiProvidersController.updateProvider()` — Phase 2.8: `apiKey === ''` clears the stored key; non-ASCII `apiKey` throws `BadRequestException` with codepoint + position; omitting leaves existing | same |
| `DELETE /api/v1/settings/ai/providers/:id` | `AiProvidersController.deleteProvider()` | same |
| `PATCH /api/v1/settings/ai/providers/:id/toggle` | `AiProvidersController.toggleProvider()` | same |
| `POST /api/v1/settings/ai/providers/:id/test` | `AiProvidersController.testProvider()` → gateway `ping()` | same |
| `POST /api/v1/settings/ai/providers/:id/set-default` | `AiProvidersController.setDefaultProvider()` — Phase 2.8: takes highest-priority active `conversation`-capable model and routes every capability it advertises to it | same |
| `POST /api/v1/settings/ai/providers/:id/discover-models` | `AiProvidersController.discoverModels()` — Phase 2.8: calls provider's `GET /models` (OpenAI-compatible), inserts rows as `isAvailable=false`, returns `{inserted, existing, message}` | same |
| `POST /api/v1/settings/ai/providers/:providerId/models/:modelId/set-default` | `AiProvidersController.setDefaultModel()` — Phase 2.8: single-model toggle, clears `isDefault` on all siblings that share any of the model's capabilities | same |
| `GET/POST/PATCH/DELETE .../providers/:id/models/*` | CRUD on `ai_models` table | same |
| `GET /api/v1/settings/ai/routing` | `AiProvidersController.getRouting()` | same |
| `PATCH /api/v1/settings/ai/routing` | `AiProvidersController.updateRouting()` | same |

### Phase 2.8 UI additions

- **Clickable model badges.** Each provider card's `Available Models` chips are now `<button>` elements, not passive `<span>`. Click any model to promote it to default for every capability it advertises; default state shows a ★ + accent ring; click during in-flight request shows an ellipsis and disables the badge.
- **Discover Models modal** appears automatically after a successful Create/Edit when an API key was provided. Calls `POST .../discover-models`, lists the discovered models with checkboxes + per-row "Default" radio. Apply button calls `toggleModel(true)` + `setDefaultModel` per selected row.
- **Masked key preview.** Each provider's API Key input shows `placeholder={current.keyPreview ?? "••••••••••••"}`. On Edit, a one-line hint under the input shows `Current: sk-d…test · stored encrypted in DB`.
- **Routing dropdowns** are now built from the live provider catalog (enabled models across all providers) instead of a hard-coded 7-row list.
- **`hasKey: boolean`** flag in provider responses (front-end shows a badge or hides actions based on this).

### Response format

The `AISettingsService` (18 methods including `discoverProviderModels`) uses `unwrapList()`/`unwrapItem()` from `@/services/unwrap.ts` to parse the NestJS `{ status, data }` wrapper. This matches the pattern used by all other admin services (agentsPool, tier settings, etc.).

`AIProviderConfig` extends with `hasKey?: boolean` and `keyPreview?: string` (first-4 + ellipsis + last-4 chars of the decrypted plaintext).

### PROVIDER_INFO registry

The page component maps provider slugs to display info. Seven providers are registered:

| Slug | Display name | Icon |
|---|---|---|
| `deepseek` | DeepSeek | 🔮 |
| `gemini` | Google Gemini | 🌟 |
| `openrouter` | OpenRouter | 🔗 |
| `minimax` | MiniMax | 🤖 |
| `openai` | OpenAI | 🧠 |
| `anthropic` | Anthropic | 🎭 |
| `mimo` | Xiaomi MiMo | 📡 |

A fallback `{ name: provider.name, icon: '🔌' }` handles any future unknown slugs.

### Admin chat CSRF fix

The admin overview chat calls `POST /chat/messages` which was blocked by CSRF middleware (missing `__Host-nc_csrf` cookie on admin requests). Added to exemption lists in both `common/auth/csrf.middleware.ts` and `modules/security/middleware/csrf.middleware.ts`. Admin chat now returns real MiniMax responses.

### Reference

- Controller: `backend/src/modules/ai-gateway/controllers/ai-providers.controller.ts`
- Service: `frontend-admin/src/services/settings/aiSettings.service.ts`
- Hook: `frontend-admin/src/hooks/useAISettings.ts`
- Page: `frontend-admin/src/app/settings/ai/page.tsx`
- Phase 2.8 doc: [pending-tasks.md §0g](pending-tasks.md#0g-2026-07-28-ai-gateway-phase-28-db-stored-keys--discover-models--chat-streaming-fix-kilo)
- Page: `frontend-admin/src/app/settings/ai/page.tsx`
- CSRF fixes: `backend/src/common/auth/csrf.middleware.ts`, `backend/src/modules/security/middleware/csrf.middleware.ts`
- Fix log: [fixes.md FIX-038](fixes.md)

**End of frontend-admin.md.**