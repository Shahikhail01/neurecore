# Auth Architecture (FIX-020)

**Last updated:** 2026-07-07 19:55 PKT
**Owner:** Platform / Auth
**Status:** ✅ SHIPPED + DEPLOYED — single source of truth for auth across both frontends.

> **⚠️ DO NOT CORRUPT THIS.**
>
> This is the authoritative architectural reference for the IAuthService facade.
> Any change that bypasses the L2 facade (e.g. raw cookie writes outside `CookieTokenRepository`, direct `useAuthStore.getState().setUser/clearUser`, `window.location.href = '/login'`, localStorage token writes) reintroduces the "auth gets corrupted on new-page work" bug class.
>
> Before making ANY auth change in either frontend, read this doc end-to-end and verify your change goes through `IAuthService`. The CI lint (`bash scripts/auth-lint.sh`) blocks the banned patterns; a regression here would be a Critical bug.

## TL;DR

There is exactly **one way** to change auth state in NeureCore: `useAuth().login()` / `useAuth().logout()` / `useAuth().register()` / `useAuth().reportAuthFailure()`. The HTTP layer delegates to it via the `I**AuthService.reportAuthFailure` callback. There are no other paths. A new contributor who breaks this rule trips a CI grep.

## The 7 Interfaces (ISP)

| # | Interface | File | Responsibility |
|---|---|---|---|
| 1 | `IAuthService` | [`core/interfaces.ts`](../../frontend-tenant/src/auth/core/interfaces.ts) | The L2 facade. The only thing UI calls. |
| 2 | `IAuthSessionLifecycle` | `core/interfaces.ts` | The ONLY place that can atomically kill a session. |
| 3 | `ITokenRepository` | `core/interfaces.ts` | Cookie I/O only. **NEVER touches localStorage.** |
| 4 | `IUserRepository` | `core/interfaces.ts` | Single owner of the Zustand auth store. |
| 5 | `IAuthApi` | `core/interfaces.ts` | Pure HTTP `/auth/*` calls. No state, no cookies. |
| 6 | `IRefreshCoordinator` | `core/interfaces.ts` | Single-flight dedup of `/auth/refresh`. |
| 7 | `IAuthEventBus` | `core/interfaces.ts` | Pub/sub for non-React subscribers (sockets, analytics). |
| 8 | `IAuthRouteRegistry` | `core/interfaces.ts` | Knows which routes are public + the login/post-auth URLs. |

Plus the React `useAuth()` hook, the `<AuthProvider>` context, and the discriminated `AuthState`:
```ts
type AuthState =
  | { status: 'initializing' }
  | { status: 'unauthenticated'; reason?: 'session_expired'|'logged_out'|'never_logged_in'|'locked_out'; lockoutRemainingSeconds?: number }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'error'; errorMessage: string; recoverable: boolean };
```

## The Layered Design

```
L1 (UI):      useAuth() hook + AuthProvider Context      ← pages import ONLY useAuth()
L2 (Service): IAuthService singleton facade              ← orchestrates all L3 modules
L3 (Core):    7 focused interfaces                       ← one responsibility each
L4 (Transport): authHttpClient (single axios instance)   ← CSRF + 401 handling
```

Every layer depends on abstractions below, never concretions.

## The State Machine

```
                 ┌─────────────────────┐
                 │    INITIALIZING      │ ← AuthProvider mounts, hydrate + restore() in progress
                 │    (show spinner)    │    useAuth() returns this state until restore completes
                 └──────────┬───────────┘
                            │ restore() completes
                  ┌─────────┼─────────┐
                  ▼         ▼         ▼
            ┌──────────┐ ┌──────────────┐ ┌──────────────┐
            │ UNAUTHENT-│ │ AUTHENTICATED │ │    ERROR     │
            │  ICATED  │ │ (user ≠ null) │ │ (recoverable │
            │ (user=null)│ │              │ │  or fatal)   │
            └────┬─────┘ └──────┬────────┘ └──────────────┘
                 │              │
                 │     login() / register() / loginWithGoogle() success
                 │              │
                 └──────────────┘
                 From AUTHENTICATED:
                 ┌──────────────────────────────────────────────┐
                 │ logout()                       → UNAUTHENTICATED│
                 │ killSession('session_expired')  → UNAUTHENTICATED│
                 │ killSession('token_invalid')    → UNAUTHENTICATED│
                 │ killSession('refresh_reuse')    → ERROR (recoverable: false)│
                 │ reportAuthFailure('locked_out') → UNAUTHENTICATED (with timer) │
                 │ refetch() returns error         → keeps AUTHENTICATED with stale user│
                 └──────────────────────────────────────────────┘
```

**Invariants:**
1. `user !== null` **iff** `status === 'authenticated'`.
2. A `killSession()` call atomically: (a) clears cookies, (b) clears user, (c) emits `SESSION_KILLED`, (d) BroadcastChannel for cross-tab.
3. `INITIALIZING` is the only state where hydration may be pending.

## The HTTP Response Interceptor Contract

| Response | Action | State transition |
|---|---|---|
| `2xx` | Pass through | None |
| `4xx` non-401, non-429 | Pass through | None |
| `401` (not refresh URL) | `refreshOnce()` → retry; on fail → `session_expired` | `UNAUTHENTICATED` |
| `401` (refresh URL) | `token_invalid` → kill | `UNAUTHENTICATED` |
| `401` (refresh reuse detected) | `refresh_reuse_detected` → kill + ERROR | `ERROR (recoverable: false)` |
| `429` on `/auth/login` | `locked_out` | `UNAUTHENTICATED` (with timer) |
| `5xx` / network | Pass through — NEVER clear session | None |

**Critical invariant:** **The interceptor NEVER calls `window.location.href = '/login'`.** The state transition triggers a React re-render via `useAuth()`, and the page renders `<SessionExpiredScreen />` with a "Sign in again" button. Only user action navigates.

## File Map

```
frontend-tenant/src/auth/
├── core/interfaces.ts               ← ALL 7 interfaces + AuthState/AuthFailure/AuthEvent types
├── impl/                            ← 7 implementations + BaseAuthService (L2)
├── hooks/{useAuth,useTenantAuth,useRequireAuth}.ts
├── components/{AuthProvider,SessionExpiredScreen,AuthErrorScreen,LockoutScreen,AuthLoadingScreen}.tsx
├── transport/{authHttpClient,authResponseInterceptor}.ts
├── di/authContainer.ts              ← Composition root
├── __tests__/{cookie-token-repository, auth-service, auth-event-bus,
│               auth-route-registry, auth-session-lifecycle}.spec.ts
└── index.ts                         ← { AuthProvider, useAuth, useRequireAuth }
```

## Backwards Compatibility

`useTenantAuth` and `useAdminAuth` are now thin shims over `useAuth()` that preserve the existing `AuthUser | null` return signature. **Every page that already worked keeps working unchanged.** New code should use `useAuth()` directly to access the discriminated state.

## Solid Compliance

| Principle | How we satisfy it |
|---|---|
| **S — Single Resp.** | Each class does exactly one thing (cookie I/O, store I/O, HTTP, refresh dedup, state machine). |
| **O — Open/Closed** | New auth flows (SSO, magic link, TOTP) are new `IAuthApi` impls. No changes to `AuthService`. |
| **L — Liskov Sub.** | Any `ITokenRepository` impl can replace `CookieTokenRepository`. |
| **I — Interface Seg.** | 7 small interfaces (2-4 methods each) instead of 1 monolithic one. |
| **D — Dependency Inv.** | `BaseAuthService` depends on 7 `I*` interfaces, not on `axios`, `document`, `localStorage`, `useAuthStore`. |

## Banned Patterns (CI-enforced via `scripts/auth-lint.sh`)

| Pattern | Why banned |
|---|---|
| `localStorage.setItem/getItem/removeItem` with auth key | Tokens must be HttpOnly cookies. |
| `sessionStorage.setItem/getItem/removeItem` with auth key | Same. |
| `document.cookie = ...` outside `CookieTokenRepository` | Single owner of cookie I/O. |
| `window.location.href = '/login'` outside `useRequireAuth` | Use `useAuth().logout()` / `killSession()` instead. |
| `SecureStorageKey` / `setSecureToken` / `getSecureToken` | Dead legacy helpers — they wrote to keys that don't match the actual cookies. |

The lint script: `bash scripts/auth-lint.sh` → exits non-zero if any banned pattern is present.

## How To Add a New Page (without corrupting auth)

1. Import `useAuth` from `@/auth`.
2. Render reactively based on `state.status`:
   ```tsx
   const { state } = useAuth();
   if (state.status === 'initializing') return <Spinner />;
   if (state.status === 'unauthenticated') return <SignInPrompt />;
   return state.status === 'authenticated' ? <Content user={state.user} /> : null;
   ```
3. Use `restClient.get(...)` / `restClient.post(...)` (which goes through `authHttpClient` and the response interceptor that delegates to `authService.reportAuthFailure`). NO `localStorage`. NO direct cookie reads.
4. Logout button: `const { logout } = useAuth(); onClick={logout}`.
5. Optional: wrap with `useRequireAuth()` to auto-redirect on unauthenticated.

## Related Docs

- [`plans/auth-hardening-refactor.md`](../plans/auth-hardening-refactor.md) — original 10-phase plan
- [`auth.md`](../auth.md) — current state (historical)
- [`fixes.md`](../fixes.md) — FIX-020 entry (now ✅ SHIPPED)
- [`runbook.md`](../runbook.md) — diagnostic section ("Auth crash" / "stale user loop")
