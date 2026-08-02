# Frontend — Tenant Portal

> `frontend-tenant/` — Next.js 15 tenant-facing portal. Last refreshed: 2026-07-31.

---

## 1. Stack

- Next.js `15.5.12` — `frontend-tenant/package.json:40`
- React 19, TypeScript 5.7
- Tailwind CSS 3.4, `tailwindcss-animate` (via `tailwind.config.js`)
- `@neurecore/ui-visual` (workspace package — shared visual components)
- Many Radix primitives: `avatar`, `checkbox`, `collapsible`, `dialog`,
  `dropdown-menu`, `label`, `popover`, `progress`, `scroll-area`, `select`,
  `separator`, `slot`, `tabs`, `toast`, `tooltip`
- `axios` 1.7, `socket.io-client` 4.8
- `zustand` 5.0
- `reactflow` 11.11 (workflow graph UIs)
- `recharts` 3.8
- `lucide-react` 0.460 (icons)
- `date-fns` 4.1
- `cmdk` 1.1 (command palette)
- `framer-motion` 12.34
- Tests: Vitest 4.1 + Playwright 1.61 (E2E in `simulations/`)

## 2. Ports

| Env | Port |
|---|---|
| Local dev | 3001 (`next dev -p 3001`) |
| Production | 3001 (PM2 `neurecore-tenant` → `./start.sh`) |
| Production URL | `https://hq.neurecore.com` |

The CORS proxy (`scripts/contabo/cors-proxy.js`) terminates TLS at LiteSpeed
and forwards to NestJS on `127.0.0.1:3003`.

## 3. Routing surface (`src/app/`)

Top-level routes:

- `/` — tenant landing.
- `/login`, `/register`, `/forgot-password`, `/reset-password` — auth flows.
- `/home` — main dashboard.
- `/onboarding/setup` — multi-step wizard (Phase 2 onboarding).
- `/projects` — list; `/projects/new`; `/projects/[id]` — detail.
- `/workspace` — workspace overview.
- `/strategy` — goals, OKRs.
- `/execution` — execution log.
- `/reviews` — pending reviews.
- `/tasks` — task list.
- `/goals` — goals module.
- `/customers` — CRM customers.
- `/departments` — tenant department view.
- `/accounting` — chart of accounts, ledger, reports.
- `/finance` — finance module.
- `/intelligence` — knowledge / context plane.
- `/service-desk` — service desk.
- `/inbox` — unified inbox.
- `/help` — help centre.
- `/marketplace` — solution packs marketplace.
- `/portal` — client portal (read-only customer view).
- `/users` — tenant user management.
- `/settings` — tenant settings.
- `/privacy`, `/terms` — legal.
- `error.tsx`, `not-found.tsx`, `loading.tsx`, `layout.tsx` — framework files.

## 4. Auth

### 4.1 Auth module structure
`src/auth/` mirrors `frontend-admin/src/auth/`:

```
src/auth/
├── components/     # UI bits: LoginForm, SessionExpireModal, etc.
├── core/           # IAuthService contract (interfaces.ts)
├── di/             # container wiring
├── hooks/          # useAuth(), useSession(), useRequireAuth()
├── impl/           # AuthService impl backed by /auth endpoints
├── transport/      # authHttpClient, authResponseInterceptor
├── __tests__/      # vitest
└── index.ts        # barrel
```

`IAuthService` (in `core/interfaces.ts`) exposes:
- `login({ email, password })`
- `register(input)`
- `logout()`
- `refresh()` (via httpOnly refresh cookie)
- `reportAuthFailure({ type })` — non-redirecting failure handler
- `state` observable: `idle | loading | authenticated | unauthenticated`

### 4.2 Cookie + CSRF contract
- Backend sets `__Host-nc_at` (httpOnly, 15min) and `__Host-nc_rt` (httpOnly,
  7d). Browser auto-attaches.
- Backend sets `__Host-nc_csrf` (NOT httpOnly, readable by JS).
- `authHttpClient` reads `__Host-nc_csrf` and echoes as `X-CSRF-Token` for
  every mutating request (see `services/api.ts:14-65`).
- On 401, both legacy `api.ts` and `authHttpClient` attempt a single refresh
  via `/auth/refresh` then retry. If refresh fails, `authService.reportAuthFailure`
  is called — **never a hard redirect** (FIX-020).

### 4.3 AuthProvider
`src/app/layout.tsx` wraps the app in `AuthProvider` so all children can use
`useAuth()`.

### 4.4 Pre-paint theme script
`src/app/layout.tsx` includes an inline `<script>` that runs before React
hydrates to reconcile `theme-light` users out of the default `dark` class,
preventing FOUC.

## 5. AppInitializer
`src/shared/components/AppInitializer` runs once on mount to:
- Hydrate the auth state.
- Register the service worker (`ServiceWorkerRegistrar`).
- Reconcile theme.

## 6. Services layer

`src/services/` mirrors backend modules 1:1. Highlights:

- `api.ts` — legacy axios client with CSRF + refresh interceptor.
- `auth.service.ts` — thin wrapper around `@/auth`.
- `me.service.ts` — `GET /me` for the current user.
- `projects.service.ts`, `tasks.service.ts`, `goals.service.ts`,
  `customers.service.ts`, `reviews.service.ts`, `assignments.service.ts`,
  `approvals.service.ts`, `compliance.service.ts`, `finance.service.ts`,
  `deliverables.service.ts`, `execution.service.ts`,
  `execution-log.service.ts`, `timeline.service.ts`,
  `project-memory.service.ts`, `project-decisions.service.ts`,
  `project-health.service.ts`, `projectTypes.service.ts`,
  `tenant-templates.service.ts`, `department-templates.service.ts`,
  `tiers.service.ts`, `industries.service.ts`, `featureFlags.service.ts`,
  `industry-groups.service.ts`, `onboarding.service.ts`, `packages.service.ts`,
  `integrations.service.ts`, `connectors.service.ts`, `analytics.service.ts`,
  `command-center.service.ts`, `approval-chains.service.ts`,
  `approval-enrichment.service.ts`, `delegation.service.ts`,
  `accounting/index.ts` (subdir), `auth-redirect.service.ts`,
  `agent-streaming.service.ts`, `activity-feed.service.ts`,
  `register-commands.ts`, `command-registry.ts`, `unwrap.ts`,
  `uploads.service.ts`, `threads.service.ts`, `socket.ts`,
  `tenants.service.ts`, `checklist.service.ts`, `__tests__/`.

`command-registry.ts` + `register-commands.ts` wire chat-issued commands to
the right service method (e.g. `createProject` → `projects.service.create`).

## 7. Components & shared

- `src/components/` — feature-level UI.
- `src/shared/` — cross-feature primitives (e.g. `AppInitializer`,
  `ThemeProvider`, `ServiceWorkerRegistrar`).
- `src/lib/` — utility libraries:
  - `errors.ts` + `errors.test.ts` — typed error taxonomy
  - `utils.ts`, `url.ts`, `locale-options.ts`
  - `dashboards/` — dashboard composition helpers
  - `industries.ts`, `industryGroups.ts`, `industryNavigation.ts` — industry
    taxonomy data
  - `wizard/` — onboarding wizard helpers
- `src/types/` — TypeScript types (notably `api.types` for the response envelope).
- `src/hooks/` — reusable React hooks.
- `src/stores/` — Zustand stores.
- `src/config/` — runtime config.

## 8. Simulations (E2E)

- `src/simulations/` — FE-level simulations (Chromium-driven).
- `../simulations/SIM-04-Accounting-Project-Full-Flow/` — the FE-first SIM-04
  runner. The runner drives the browser, never falls back to API.
- `playwright.config.ts` — Playwright runner config.

## 9. Tests

- `src/**/__tests__/**.test.ts(x)` — Vitest unit.
- `tests/` — top-level integration tests.
- `pnpm verify`: `tsc --noEmit && next lint --max-warnings=0 &&
  vitest run --coverage && next build`.

## 10. Conventions

- `@/` for absolute imports.
- React Server Components by default; `'use client'` only when needed (e.g.
  login form, command palette).
- Forms: local state + `useAuth().login` / direct service call.
- Errors: `errorHandler.handle(...)`, never raw `throw` to user.
- Toasts: `useToast()` (Radix-based).

## 11. Known issues (tenant-specific)

- **NC-SIM04-002** — Modal backdrop overlay intercepts the customer "Create"
  button pointer events. Visible/enabled but blocked.
- **NC-SIM04-005** — Chat agent's tool graph doesn't bind to natural-language
  triggers like "create a project"; the LLM only runs diagnostics.
- **Missing FE controls:** S6 (Execute), S11 (Complete), S10 REVIEW state pill.

See `pending-tasks.md` for full detail and the `fixes.md` entry for
`NC-SIM04-001` (closed).

## 12. Source pointers

- `frontend-tenant/src/app/layout.tsx`
- `frontend-tenant/src/auth/index.ts`
- `frontend-tenant/src/services/api.ts`
- `frontend-tenant/src/services/command-registry.ts`
- `frontend-tenant/start.sh`
- PM2 entry: `scripts/contabo/ecosystem.config.js:25-37`
- CORS proxy: `scripts/contabo/cors-proxy.js`