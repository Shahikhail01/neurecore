# Frontend — Admin Portal

> `frontend-admin/` — Next.js 15 admin portal for SUPER_ADMIN users. Last refreshed: 2026-07-31.

---

## 1. Stack

- Next.js `15.0.0` (App Router) — `frontend-admin/package.json:30`
- React 19, TypeScript 5.7
- Tailwind CSS 3.4 (`tailwind.config.js`)
- `@neurecore/ui-visual` (workspace package — shared visual components)
- `@radix-ui/react-dialog`, `react-dropdown-menu`, `react-tooltip`
- `axios` 1.7 (legacy + new `authHttpClient`)
- `zustand` 5.0 (state stores)
- `socket.io-client` 4.8 (realtime)
- `framer-motion` 12.34
- `d3` 7 + `@visx/network` 3.12 (admin graphs)
- `recharts` 3.7 (dashboards)
- `cmdk` 1.1 (command palette)
- `sonner` 2.0 (toasts)
- `lucide-react` (icons) — note: tenant FE uses this; admin uses less
- Tests: Vitest 4.1 + `@testing-library/react` 16 + `jsdom` 28
- ESLint 9, typescript-eslint 8

## 2. Ports

| Env | Port |
|---|---|
| Local dev | 3002 (`next dev -p 3002`) |
| Production | 3020 (PM2 `neurecore-admin` → `./start.sh`) |
| Production URL | `https://cc.neurecore.com` |

## 3. Bootstrap

- `next.config.js`, `postcss.config.js`, `tailwind.config.js`
- `start.sh` — runs `next start --hostname 127.0.0.1 --port 3020`
  (validated by `scripts/deploy.sh` pre-flight).
- `vercel.json` — present for Vercel preview deploys (admin can ship to Vercel
  for quick reviews, but production runs on Contabo).

## 4. Routing surface (`src/app/`)

| Route | Purpose |
|---|---|
| `/` | Root redirect / overview entry |
| `/login` | Admin login (cookie auth, role-gated) |
| `/overview` | SUPER_ADMIN dashboard |
| `/tenants` | Tenant list / search |
| `/users` | Platform user list |
| `/agents` | Agent library |
| `/agents-pool` | Pool #1 admin |
| `/agent-templates` | Template library |
| `/departments` | Department CRUD |
| `/departments-pool` | Pool #2 admin |
| `/dept-templates` | Department templates |
| `/industries` | Pool #3 admin |
| `/tiers` | Pool #4 admin |
| `/tier-templates` | Tier templates |
| `/features` | Pool #5 admin |
| `/packages` | Pool #6 admin (composite root) |
| `/project-types` | Project type library |
| `/question-packs` | Onboarding question packs |
| `/feature-flags` | Global feature flag overrides |
| `/billing` | Tenant billing overview |
| `/brain` | AI gateway admin (AI providers, models, prompt templates) |
| `/models` | LLM model registry |
| `/connectors` | CRM / external connector health |
| `/integrations` | Google Workspace + Brevo OAuth state |
| `/customers-pool` | Cross-tenant customer search |
| `/audit` | Audit log viewer |
| `/monitoring` | Prometheus + health snapshot |
| `/security` | Sessions, lockouts, suspicious activity |
| `/infrastructure` | Sidecar health + restart controls |
| `/settings` | Platform settings |

`_layout.tsx` wraps everything; `globals.css` sets Tailwind base.

---

## 5. Auth

### 5.1 Middleware (server-side, authoritative)
`src/middleware.ts` enforces SUPER_ADMIN-only access:

- **Public paths:** `/login`, `/api/health`, `/_next`, `/favicon`
- For all other paths, reads `__Host-nc_at` cookie (set by the backend after login).
- No cookie → redirect to `/login`.
- Cookie present but role ≠ SUPER_ADMIN → redirect to `/login?reason=insufficient`
  (handled by the login page error UI).

This is the **authoritative** gate; the client-side `useAdminAuth()` hook is
defense-in-depth.

### 5.2 Login
`src/app/login/page.tsx`:
- Calls `useAuth().login({ email, password })` from `@/auth`.
- `state.status === 'authenticated'` → `router.replace('/overview')`.
- Lockout surfaced via `state.reason === 'locked_out'`
  (`state.lockoutRemainingSeconds`) or `AuthError.code === 'account_locked'`.
- Middleware redirect reason surfaced via URL `?reason=insufficient`.

### 5.3 Auth package — `@/auth`
Re-exports the auth subsystem (`src/auth/index.ts`) which is shared with the
tenant portal but mounts admin-only adapters. See `auth.md` for the full
`IAuthService` contract and the cookie/CSRF mechanics.

### 5.4 HTTP client
- `services/api.ts` — legacy axios instance with CSRF + 401 refresh.
- `auth/transport/authHttpClient.ts` — newer client (preferred).
- Both attach `X-CSRF-Token` from the `__Host-nc_csrf` cookie for state-changing
  requests.

---

## 6. State & data layer

- Zustand stores under `src/stores/` for cross-page UI state.
- Service modules under `src/services/` mirroring backend modules
  (`tenants.service.ts`, `agents.service.ts`, etc.).
- `core/infrastructure/ErrorHandler` (admin + tenant share).
- `core/services/api/clients/RestClient` re-exported from `services/api.ts`.

---

## 7. Components / shared

- `src/components/` — feature-level admin widgets.
- `src/shared/` — cross-feature primitives (likely toast wrapper, etc.).
- `src/hooks/` — admin-specific hooks.
- `@neurecore/ui-visual` — workspace package, not in this folder but imported.

## 8. Tests

- `src/**/__tests__/**.test.ts(x)` — Vitest.
- `tests/` — top-level integration / e2e tests if any.
- `pnpm verify` runs: `tsc --noEmit && next lint --max-warnings=0 &&
  vitest run --coverage && next build`.

## 9. Conventions

- Use `@/` for absolute imports (`tsconfig.json` baseUrl).
- Tailwind utility-first; theme tokens live in `tailwind.config.js`.
- Forms go through React-Hook-Form-equivalent local state; see `login/page.tsx`
  for the reference pattern.
- Errors surface through `errorHandler.handle(...)` not raw `throw`.
- Toasts via `sonner`.

## 10. What's NOT in this portal

- Tenant onboarding (lives in `frontend-tenant/onboarding`).
- Project execution UI (tenant portal).
- Customer portal (tenant portal under `portal/`).
- Chart of accounts / journal entry UIs (tenant portal `accounting/`).
- Chat UI (tenant portal).

## 11. Open issues (admin-specific)

See `pending-tasks.md` for cross-cutting open issues. Admin-specific items:
- **G-01** — admin password reset UI is not wired (token issuance exists;
  UX flow TBD).
- **G-08** — admin "impersonate tenant" mode is gated behind a feature flag
  and has no audit surfacing yet.
- **Monitoring page** — currently shows a snapshot; live WS push planned.

## 12. Source pointers

- `frontend-admin/middleware.ts`
- `frontend-admin/src/app/login/page.tsx`
- `frontend-admin/src/auth/index.ts` (re-export barrel)
- `frontend-admin/src/services/api.ts`
- `frontend-admin/package.json`
- `frontend-admin/start.sh`
- PM2 entry: `scripts/contabo/ecosystem.config.js:39-52`