# Auth

> Cookie-only JWT auth + CSRF double-submit + RBAC + lockout. Last refreshed: 2026-07-31.

Phase 9 (Auth Hardening) made **httpOnly cookies** the sole auth path for
both frontends. There is no `Authorization: Bearer` fallback for the SPA in
production.

---

## 1. Cookies

Names (per D-020, `backend/src/common/auth/cookie-auth.service.ts:29-31`):

| Cookie | Type | Max-Age | Purpose |
|---|---|---|---|
| `__Host-nc_at` | httpOnly + Secure + SameSite=Lax | 15 min | Access JWT |
| `__Host-nc_rt` | httpOnly + Secure + SameSite=Lax | 7 days | Refresh JWT |
| `__Host-nc_csrf` | **not** httpOnly, Secure, SameSite=Lax | 7 days | CSRF token (JS-readable) |

`__Host-` prefix requires `Secure`, `Path=/`, and forbids `Domain=`. This
prevents subdomain cookie theft (which was a vuln for plain `nc_at`).

### 1.1 SameSite
- Default is `Lax`. `clearAuthCookies` uses `SameSite=None` so the
  clear-cookie request itself isn't blocked (logout).
- `setAuthCookies` uses `SameSite=Lax` which is sufficient because all
  mutations come from the same origin (the frontend portal).

### 1.2 Domain
- Default: no `Domain=` attribute (correct for `__Host-`).
- Override: `COOKIE_DOMAIN` env var if you need cross-subdomain sharing.

---

## 2. CookieAuthService

`backend/src/common/auth/cookie-auth.service.ts`:

- `isEnabled()` — returns true in production; dev default OFF so local
  `http://localhost` works (`__Host-` requires `Secure`).
  Override with `USE_HTTPONLY_AUTH=true|false`.
- `setAuthCookies(res, { accessToken, refreshToken, csrfToken? })` — attaches
  all three cookies. Generates a CSRF token if not provided.
- `clearAuthCookies(res)` — clears all three (logout).
- `parseCookies(req)` — reads `req.cookies` (cookie-parser mounted in
  `main.ts:87`) and falls back to manual `Cookie` header parsing for raw HTTP
  / SSE / Socket.IO.
- `generateCsrfToken()` — `crypto.randomBytes(24).toString('base64url')`.
- `safeEquals(a, b)` — `crypto.timingSafeEqual`.

---

## 3. CSRF (double-submit cookie)

`backend/src/common/auth/csrf.middleware.ts`:

Flow:
1. Backend issues `__Host-nc_csrf` (JS-readable).
2. SPA reads it via `cookieManager.getCsrfToken()` and echoes as
   `X-CSRF-Token` header on every mutating request.
3. Middleware compares cookie value vs header value (`safeEquals`).

### 3.1 Exemptions
**Safe methods** (no CSRF check): `GET`, `HEAD`, `OPTIONS`.

**Pre-auth paths** (no CSRF cookie yet): `/api/v1/auth/login`,
`/api/v1/auth/register`, `/api/v1/auth/google`, `/api/v1/auth/refresh`,
`/api/v1/chat/messages`, `/api/v1/chat/stream`, `/api/v1/chat/history`,
`/api/v1/chat/suggestions`.

**HMAC-signed service paths:** `/api/v1/hermes-adapter/executions/:id/events`
and `…/tools/:toolId` (these authenticate by HMAC, not cookie).

### 3.2 Errors
- `CSRF_TOKEN_MISSING` (403) — cookie or header absent.
- `CSRF_TOKEN_INVALID` (403) — cookie/header mismatch.

### 3.3 Mount
Mounted in `AppModule.configure()` as middleware on `*path`
(`app.module.ts:386-388`) so it runs **before** the JWT guard.

---

## 4. JWT strategy

`backend/src/modules/auth/strategies/` (Passport). Access JWT carries:
`sub` (userId), `tenantId`, `roles`, `iat`, `exp`. Refresh JWT carries a
`refreshId` so a refresh can be revoked server-side.

### 4.1 Token service
`backend/src/modules/auth/services/token.service.ts` issues + verifies JWTs.
Verification: HMAC-SHA256 with `JWT_SECRET` env. Refresh tokens are tracked
in DB so rotation is auditable.

### 4.2 Refresh flow
1. Access JWT expires (15 min).
2. Client axios interceptor catches 401 → `POST /auth/refresh` (with the
   httpOnly refresh cookie — auto-attached, no CSRF check needed).
3. Server verifies refresh, issues new access + new refresh, sets new
   cookies.
4. Client retries the original request once.

If refresh fails → `authService.reportAuthFailure({ type: 'session_expired' })`
on the SPA, which surfaces a "session expired" modal — **never a hard
redirect** (FIX-020, see `fixes.md`).

---

## 5. RBAC

`backend/src/modules/auth/guards/roles.guard.ts` enforces `roles` array on
JWT against `@Roles(...)` decorator on controllers/methods. Common roles
(from `UserRole` enum in `@prisma/client`):

- `SUPER_ADMIN` — full platform access (admin portal).
- `TENANT_ADMIN` — tenant-scoped admin.
- `USER` — standard tenant user.
- `AGENT` — service identity used by agents/services.

Frontend admin middleware enforces SUPER_ADMIN by reading the cookie JWT
on the server (`frontend-admin/src/middleware.ts`) and rejecting with
`?reason=insufficient` redirect.

---

## 6. Lockout

`backend/src/modules/security/services/account-lockout.service.ts` (F8):
- Constant-time `validateUser()` (`auth.service.ts:59-98`) — always runs a
  bcrypt compare so timing doesn't leak whether a user exists.
- Per-email + per-IP failure window lives in **Redis** (5 failures per
  10 minutes per `(email, ip)` triggers a 15-minute lockout). The
  persistent lock state is mirrored to `User.lockedUntil` in Postgres.
- On lockout, all outstanding refresh tokens for that user are revoked.
- `auth.service.ts` rejects with `AuthError.code === 'account_locked'`
  and surfaces `retryAfterSeconds` to the SPA.

---

## 7. Registration flow

`POST /api/v1/auth/register` (csrf-exempt):
- Requires email uniqueness.
- Optional `tenantId`. If absent, assigns default tier's default tenant.
- Returns `AuthResult` + sets cookies.

## 8. Password handling

`backend/src/modules/auth/services/password.service.ts`:
- bcryptjs, configurable cost (default 10).
- All hashes verified via `timingSafeEqual`-equivalent (`bcrypt.compare`).

## 9. Google OAuth

`POST /api/v1/auth/google` (csrf-exempt):
- Backend verifies Google ID token.
- If user exists with matching email → link Google sub.
- If user exists Google-only → reject password login (F8).

## 10. Forgot / reset password

- `POST /api/v1/auth/forgot-password` — generates single-use token, emails
  via `platform-email.service.ts` (Brevo integration).
- `POST /api/v1/auth/reset-password` — consumes token, sets new password.

## 11. CORS

`backend/src/main.ts:142-161`:
- Allow-list of origins (default: localhost:3001/3002, hq/cc/brain domains).
- `credentials: true` — requires echoing `Origin` in
  `Access-Control-Allow-Origin` (not `*`).
- Allowed headers include `X-CSRF-Token`, `X-Tenant-ID`, `Idempotency-Key`.

The Contabo CORS proxy (`scripts/contabo/cors-proxy.js`) handles the same
job at the LiteSpeed → NestJS boundary.

---

## 12. Service identities

`backend/src/modules/service-identities/` — `ServiceIdentity` rows back
agent/service JWTs. `ServiceIdentityTokenService` issues scoped tokens
with constrained permissions (used by the Hermes adapter).

## 13. Frontend behaviour (both portals)

- On every state-changing request, attach `X-CSRF-Token` from
  `__Host-nc_csrf`.
- On 401 → silent refresh; on refresh failure → `authService.reportAuthFailure`.
- Cookies auto-attached because both portals and backend share
  `hq.neurecore.com` / `cc.neurecore.com` parent (via the CORS proxy) and
  dev uses `localhost` on both sides.
- Login form posts to `/auth/login` → backend sets cookies + returns body.
  Subsequent requests ride the cookies.

## 14. Disabling for local dev

If you want to test on `http://localhost` (where `__Host-` cookies require
`Secure` and thus fail):

- Option A: `USE_HTTPONLY_AUTH=false` env on backend → middleware allows
  the legacy `Authorization: Bearer` path.
- Option B: Use `mkcert` and serve over HTTPS locally.

In dev mode the default is OFF so devs aren't locked out.

## 15. Source pointers

- `backend/src/common/auth/cookie-auth.service.ts`
- `backend/src/common/auth/cookie-auth.module.ts`
- `backend/src/common/auth/csrf.middleware.ts`
- `backend/src/modules/auth/auth.module.ts`
- `backend/src/modules/auth/services/auth.service.ts`
- `backend/src/modules/auth/services/token.service.ts`
- `backend/src/modules/auth/services/password.service.ts`
- `backend/src/modules/auth/guards/jwt-auth.guard.ts`
- `backend/src/modules/auth/guards/roles.guard.ts`
- `backend/src/modules/security/services/account-lockout.service.ts`
- `frontend-tenant/src/auth/core/interfaces.ts`
- `frontend-tenant/src/auth/transport/authHttpClient.ts`
- `frontend-tenant/src/services/api.ts`
- `frontend-admin/src/middleware.ts`