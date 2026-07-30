# NeureCore — Auth & Login System (Authoritative Reference)

**Last updated:** 2026-07-17 (RBAC update — Frontend Admin restricted to SUPER_ADMIN only; see [user-roles.md](user-roles.md))
**Audience:** Anyone (human or AI) modifying or debugging login, sessions, or cookies in the NeureCore platform.
**TL;DR:** Both frontends (admin + tenant) and the NestJS backend use **cookie-only authentication** (HttpOnly `__Host-nc_at` + `__Host-nc_rt` + `__Host-nc_csrf`). API calls are **same-origin** (Next.js `rewrites()` proxy `/api/v1/*` → backend on `127.0.0.1:3003`). Refresh tokens are tracked in **families** with reuse detection. Per-account **lockout** after 5 failures in 10 minutes. CSRF double-submit on all state-changing requests. Password changes invalidate all outstanding tokens. **Frontend Admin (cc.neurecore.com) is SUPER_ADMIN only** — all other roles are redirected.

> ## ⚠️ DO NOT CORRUPT THE AUTH SYSTEM
>
> **The single source of truth for auth state is `useAuth()` in `@/auth`.** All auth-related changes (login, logout, session refresh, 401 handling, lockout, role guards) **must go through `IAuthService`**. Don't reintroduce `localStorage`/sessionStorage token writes, raw `document.cookie` access outside `CookieTokenRepository`, direct `useAuthStore.getState().setUser/clearUser`, or `window.location.href = '/login'` hard-redirects. There is **one** entrypoint per concern; using anything else re-creates the "auth gets corrupted on new-page work" class of bugs.
>
> See [int-features/auth-architecture.md](int-features/auth-architecture.md) for the SOLID layered design (7 interfaces, 7 implementations, DI container) and the banned-pattern list. The lint script `bash scripts/auth-lint.sh` fails CI on any banned pattern. See [§16.2](#162-corrupting-the-auth-system-is-structurally-hard) for details.

**Sibling docs:** [`int-features/auth-architecture.md`](int-features/auth-architecture.md) · [`backend.md`](backend.md) · [`frontend-admin.md`](frontend-admin.md) · [`frontend-tenant.md`](frontend-tenant.md) · [`contabo-ops.md`](contabo-ops.md) · [`fixes.md`](fixes.md#fix-020--auth-system-corrupted-on-new-page-work-shipped) · [`disaster-recovery.md`](disaster-recovery.md)

---

## 1. Architecture overview

```
   Browser (user)
       │
       │  https://{cc,hq}.neurecore.com  (same-origin: cookies automatic)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  CyberPanel + OpenLiteSpeed (OLS)                            │
│  • TLS termination (Let's Encrypt)                           │
│  • Static + reverse-proxy to Next.js on :3005/:3020         │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js (admin on :3020, tenant on :3005)                   │
│  • Serves React app                                           │
│  • rewrites() proxies browser requests for /api/v1/*        │
│    to http://127.0.0.1:3003 via the same TCP socket         │
│    (server-to-server; no CORS)                               │
│  • Reads __Host-nc_at / __Host-nc_rt / __Host-nc_csrf via    │
│    document.cookie in client components                      │
└──────────────────────────────────────────────────────────────┘
       │
       │ (Next.js server → NestJS, server-to-server, no cookies
       │  required for token validation)
       ▼
┌──────────────────────────────────────────────────────────────┐
│  NestJS (backend, :3003)                                     │
│  • JwtStrategy (passport-jwt) — cookie-first extractor,     │
│    Authorization-Bearer fallback for server-to-server        │
│  • TokenService — issues / rotates / revokes tokens; family-  │
│    tracked reuse detection with compromise revocation        │
│  • AccountLockoutService — sliding-window per email + per IP  │
│    in Redis + per-account lockedUntil column in Postgres    │
│  • PasswordService — bcryptjs, cost factor 12                 │
│  • AuthController — /auth/{login,register,refresh,logout,    │
│    google,me,profile}; throttled per-route                    │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Postgres (Contabo)          Redis (host-installed)            │
│  • User                      • login:fail:{email} sliding      │
│  • RefreshToken (familyId)     window counter (10 min TTL)    │
│  • Session                   • login:fail:ip:{ip} sliding      │
│  • LoginAttempt (audit)        window counter                  │
│  • AuditLog (security)        • bl:{jti} access-token blacklist│
│                                  (15-min TTL on logout)         │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Token model

| Token | Format | Lifetime | Storage | Transmitted |
|---|---|---|---|---|
| Access (`__Host-nc_at`) | HS256 JWT | **15 min** (env `JWT_ACCESS_EXPIRES`, default `15m`) | HttpOnly Secure SameSite=None cookie | Cookie on every request |
| Refresh (`__Host-nc_rt`) | HS256 JWT with `type: 'refresh'` claim | **7 days** (env `JWT_REFRESH_EXPIRES`, default `7d`) | HttpOnly Secure SameSite=None cookie; **SHA-256 hash** stored in `RefreshToken` row | Cookie on `/auth/refresh` only |
| CSRF (`__Host-nc_csrf`) | base64url(24 random bytes) | 7 days | NOT HttpOnly (JS-readable), Secure, SameSite=Lax | Echoed in `X-CSRF-Token` header on state-changing requests |

### JWT payload (`AuthResult` after `POST /auth/login`)

```jsonc
{
  "sub": "usr_admin_1783018339",        // user id
  "email": "admin@neurecore.ai",
  "role": "SUPER_ADMIN",                // UserRole enum from Prisma
  "tenantId": null,
  "jti": "32e60eed-...",                  // unique per token (used for blacklist)
  "pwd": 1783251332,                      // UNIX seconds of user's last password change
  "iat": 1783251332,
  "exp": 1783252232                       // = iat + 15min
}
```

The refresh JWT carries the same `jti`, `sub`, `pwd` plus an extra `type: 'refresh'` discriminator.

---

## 3. Refresh token families & reuse detection

Each rotation issues a new refresh token and marks the previous one `isRevoked = true`. The chain is bound by a `familyId` UUID generated at login:

```
Login    → row {tokenHash, familyId=fam_A, isRevoked=false}
Rotate   → row {tokenHash, familyId=fam_A, isRevoked=true }  ← old
            row {tokenHash, familyId=fam_A, isRevoked=false }  ← new
Rotate   → row {tokenHash, familyId=fam_A, isRevoked=true }
            row {tokenHash, familyId=fam_A, isRevoked=false }
...      (each rotation prunes unused old rows)
Logout   → revoke all `isRevoked=false` rows for userId
Compromise → DELETE on familyId column + revokeAllRefreshTokens + CRITICAL audit log
```

**Reuse detection (`F2`):** if a request presents a refresh token whose row already has `isRevoked = true`, the entire family is treated as compromised:

1. `prisma.refreshToken.updateMany({ where: { familyId, isRevoked: false }, data: { isRevoked: true } })`
2. Belt-and-braces: `revokeAllRefreshTokens(userId)` — every outstanding refresh token for the user is revoked.
3. CRITICAL `AuditLog` row written: `auth.refresh_reuse_detected` with `{ userId, familyId, severity: 'CRITICAL' }`.
4. `UnauthorizedException('Refresh token reuse detected. Please log in again.')` returned to caller.

**Transactional rotation (`F4`):** all writes happen inside `prisma.$transaction(...)` so a network failure between "revoke old" and "insert new" cannot leave two valid tokens.

---

## 4. Same-origin rewrites (F1 + browser cookie scoping)

`frontend-admin/next.config.js` and `frontend-tenant/next.config.js` both declare:

```js
async rewrites() {
  const backend = process.env.NEXT_INTERNAL_API_URL || 'http://127.0.0.1:3003';
  return [
    { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
  ];
}
```

`NEXT_INTERNAL_API_URL` is set in `.env.production`; default falls back to the same-host loopback. The browser sees all requests as same-origin (`https://cc.neurecore.com/api/v1/...`), so:

- Cookies travel automatically without `withCredentials: true` and without a CORS preflight.
- The `__Host-` prefix requirements (`Secure`, `Path=/`, no `Domain`) are satisfied by HTTPS + same-host default.

Both frontends also disable `NEXT_PUBLIC_API_URL` (commented out in `.env.production`) so axios defaults to the relative `/api/v1`.

---

## 5. Account lockout & rate limiting (F3)

Two layers, both default-on for the password endpoints:

| Layer | Where | Scope |
|---|---|---|
| `@nestjs/throttler` `@Throttle` decorator | `auth.controller.ts` | In-memory per-remote-IP window |
| `AccountLockoutService` (Redis + DB) | `account-lockout.service.ts` called from `AuthService.login` | Sliding window per email + per IP; sets `User.lockedUntil` and revokes refresh tokens |

**Throttle policy**

| Route | Limit |
|---|---|
| `POST /auth/register` | 5 / 60 s |
| `POST /auth/login` | 10 / 60 s |
| `POST /auth/refresh` | 30 / 60 s |
| `POST /auth/google` | 10 / 60 s |
| All other routes | 100 / 60 s (global default) |

**Lockout policy (`LockoutPolicy` in `account-lockout.service.ts`)**

```ts
{
  windowSeconds: 10 * 60,   // 10 minutes
  failureThreshold: 5,      // 5 failures in window
  lockoutSeconds: 15 * 60,  // 15 minute lockout
}
```

`User.lockedUntil` and Redis keys `login:fail:<email>` / `login:fail:ip:<ip>` survive restarts. On lockout:
- All outstanding refresh tokens for the user are revoked.
- 429 `TOO_MANY_REQUESTS` returned with `retryAfterSeconds`.
- A `LoginAttempt` row is written (`success: false, reason: 'too_many_failures'`).

`LoginAttempt` table:

```
id, email, ipAddress, userAgent, success, reason, createdAt
```

Indexes: `email`, `ipAddress`, `createdAt`.

---

## 6. Password storage (F8 + hygiene)

`PasswordService` uses `bcryptjs` (pure-JS) with cost factor 12:

```ts
hash(plain):       bcrypt.hash(plain, 12)
compare(plain, h): bcrypt.compare(plain, h)
```

DUMMY_BCRYPT_HASH constant in `auth.service.ts` is the real `$2a$12$...` string used to equalize response timing when the user does not exist or has no password hash set (`PasswordService.compare` is still called). This prevents timing-based user enumeration.

`User.passwordHash` is optional (Google-only users have no password). `User.passwordChangedAt` (DateTime?) is now set at register and bumped on password change via `TokenService.invalidateOnPasswordChange(userId)`.

---

## 7. CSRF double-submit (F6)

`common/auth/csrf.middleware.ts` is wired into `AppModule.configure()` and runs on every state-changing request:

1. Cookie `__Host-nc_csrf` is generated on login and set as **`httpOnly: false`**, Secure, SameSite=Lax (JS-readable).
2. Frontend interceptors in `frontend-admin/src/services/api.ts`, `frontend-admin/src/services/cookieAuth.ts`, `frontend-tenant/src/services/api.ts`, and `frontend-tenant/src/core/services/api/clients/RestClient.ts` read the cookie via `document.cookie` and attach the value as `X-CSRF-Token` on every POST/PUT/PATCH/DELETE.
3. Middleware exempts `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/google` (browser has no token yet).
4. Token comparison is constant-time via `crypto.timingSafeEqual`.

Since both frontends now use same-origin (Section 4) and same-origin requests can't include CSRF attacks from foreign origins, the CSRF middleware is **defense-in-depth** rather than load-bearing. It will still catch any future cross-origin integration that bypasses the rewrite.

---

## 8. Password-change invalidation (F15)

- JWT payload includes claim `pwd = Math.floor(passwordChangedAt.getTime() / 1000)`.
- `JwtStrategy.validate()` rejects any access token issued before the user's `passwordChangedAt`.
- `AuthService.refresh()` rejects refresh tokens whose `pwd` predates `passwordChangedAt`.
- Schema migration `20260705_auth_hardening_batch1` adds `passwordChangedAt` and `lockedUntil` columns; idempotent, safe on existing data.
- `TokenService.invalidateOnPasswordChange(userId)` is called from any password-reset endpoint (currently wired up but the reset UI lives in a future batch).

---

## 9. JwtStrategy: cookie-first token extraction

`backend/src/modules/auth/strategies/jwt.strategy.ts` uses a custom extractor:

1. If the `CookieAuthService` feature flag is enabled (production: yes), read `__Host-nc_at` from `req.cookies` (cookie-parser middleware mounted in `main.ts`).
2. Otherwise, fall back to `Authorization: Bearer <jwt>` header. Used by internal Next.js → NestJS calls and by Socket.IO handshakes that still send a Bearer.

`ignoreExpiration: false`. Algorithm pinned to `HS256` via `JwtModule.registerAsync({ signOptions: { algorithm: 'HS256' }, verifyOptions: { algorithms: ['HS256'] } })` in `auth.module.ts`.

---

## 10. Environment variables

`backend/.env` (Contabo) keys relevant to auth:

| Key | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | 50-char dev value in dev, real in prod | HS256 signing secret. **Must be ≥32 chars**; AGENTS.md warns. |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh token lifetime |
| `JWT_ALGORITHM` | `HS256` | HS256 only (no alg=none) |
| `JWT_ISSUER` | unset | Optional iss claim |
| `JWT_AUDIENCE` | unset | Optional aud claim |
| `CSRF_ENABLED` | `true` | Toggle `CsrfMiddleware` |
| `USE_HTTPONLY_AUTH` | `true` in prod / `false` in dev | Toggle the cookie-based auth feature flag in `CookieAuthService` |
| `COOKIE_DOMAIN` | unset (no `Domain` attr) | Cookie `Domain=` attr for cross-subdomain cookies |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60_000` / `100` | Global throttler window |
| `THROTTLE_AUTH_LIMIT` | `10` | Documented; overridden per-route via `@Throttle()` |
| `NODE_ENV` | `production` (Contabo) | Drives NestJS `enableCors` and `CookieAuthService` defaults |

---

## 11. Schemas

### `RefreshToken` (after migration `20260705_auth_hardening_batch1`)

```prisma
model RefreshToken {
  id          String   @id @default(uuid())
  tokenHash   String   @unique
  userId      String
  familyId    String                                // ← NEW: family UUID
  replacedById String?                              // ← NEW: rotation link
  isRevoked   Boolean  @default(false)
  expiresAt   DateTime
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([tokenHash])
  @@index([familyId])                              // ← NEW
  @@map("refresh_tokens")
}
```

### `LoginAttempt` (new table)

```prisma
model LoginAttempt {
  id        String   @id @default(uuid())
  email     String
  ipAddress String?
  userAgent String?
  success   Boolean
  reason    String?
  createdAt DateTime @default(now())

  @@index([email])
  @@index([ipAddress])
  @@index([createdAt])
  @@map("login_attempts")
}
```

### `User` (relevant columns)

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String?                       // bcrypt, cost 12
  role              UserRole
  isActive          Boolean
  passwordChangedAt DateTime?                    // NEW (F15)
  lockedUntil       DateTime?                    // NEW (F3)
  // ... googleId, tenantId, etc.
}
```

---

## 12. Operational runbook

### Health

```bash
ssh contabo 'pm2 list | grep neurecore'
# 4 processes online: tenant, admin, backend, cors-proxy
curl -sk https://brain.neurecore.com/api/v1/health    # → 200
```

### Reset a stuck lockout

```bash
# Per-account
ssh contabo 'cd /opt/neurecore/backend/backend && \
  node -e "const p=new (require(\"@prisma/client\").PrismaClient)(); \
  p.user.update({where:{email:\"$EMAIL\"}, data:{lockedUntil:null}}).then(()=>p.\$disconnect())"'

# Clear Redis sliding windows
PASS=$(grep ^REDIS_URL /opt/neurecore/backend/backend/.env | sed -E 's|redis://:(.+)@.*|\1|')
ssh contabo "redis-cli -a '$PASS' --no-auth-warning DEL \
  login:fail:$EMAIL login:fail:ip:182.187.153.92"
```

### Reset an admin password

Use the `scripts/make-superadmin.cjs` seeder (creates new admin; non-destructive) or `scripts/get_admin_password.sh` to read `/root/.admin_password`. To rotate a password in-place:

```js
const bcrypt = require('bcryptjs');
const p = new (require('@prisma/client').PrismaClient)();
p.user.update({
  where: { email: 'admin@neurecore.ai' },
  data: {
    passwordHash: await bcrypt.hash('NEW_PASSWORD', 12),
    passwordChangedAt: new Date(),     // invalidates all outstanding JWTs
    lockedUntil: null,
  },
}).then(() => p.$disconnect());
```

### Rotate the JWT signing secret

1. Generate new secret (`openssl rand -base64 64`).
2. Update `/opt/neurecore/backend/backend/.env`'s `JWT_SECRET=...`.
3. `pm2 restart neurecore-backend`. Note: all access/refresh tokens issued before the rotation are immediately invalid; users must re-login. Consider doing this in a maintenance window.

### Detect refresh-reuse compromises

```bash
ssh contabo "psql $DATABASE_URL -c \"SELECT createdat, actor, action, details FROM \\\"audit_logs\\\" WHERE action='auth.refresh_reuse_detected' ORDER BY createdat DESC LIMIT 20\""
```

Each row has `details.severity = 'CRITICAL'`. The `familyId` and `userId` are in `details`. Notify the user immediately; force re-login on all devices.

### Rollback auth hardening Batch 1

1. Restore the prior migration state: `bash /opt/neurecore/rollback.sh auth_hardening_batch1` (or use `migration rollback` via Prisma).
2. Re-deploy the previous backend from git.
3. Frontends: revert `next.config.js` rewrite and the `services/api.ts` defaults.

---

## 13. Test coverage

### Backend — FIX-020 leaves these untouched; still 8/8

`backend/src/modules/auth/services/auth-hardening.spec.ts`:

| Test | Verifies |
|---|---|
| F4 transactional rotation | rotate uses `prisma.$transaction` |
| F2 reuse triggers compromise | revoked token → `updateMany` + CRITICAL audit |
| F2 fresh rotation succeeds | issues new pair when not revoked |
| F8 constant-time | `bcrypt.compare` runs even for missing user |
| F3 lockout rejection | 429 + `lockout.record` called |
| F15 password-change | refresh rejected when `payload.pwd < user.passwordChangedAt` |
| AccountLockoutService: persist lock | `User.lockedUntil` set + `revokeAllRefreshTokens` called |
| AccountLockoutService: allows when 0 failures | returns `allowed: true` |

Run: `cd backend && ./node_modules/.bin/jest --config jest.config.js src/modules/auth/services/auth-hardening.spec.ts`

### Frontend — NEW 27 tests added by FIX-020

`frontend-tenant/src/auth/__tests__/` (vitest, run via `cd frontend-tenant && npx vitest run`):

| File | Test cases |
|---|---|
| `cookie-token-repository.spec.ts` (6) | reads/writes all 3 cookies; `clearTokens()` works; **never touches localStorage/sessionStorage**; `setAccessToken` is no-op (server owns persistence) |
| `auth-event-bus.spec.ts` (3) | deliver to all subscribers; unsubscribe works; one bad listener doesn't break others |
| `auth-route-registry.spec.ts` (3) | `/login`/`/register`/`/onboarding/*` etc. unauthenticated; `/home`/`/command-center` not |
| `auth-session-lifecycle.spec.ts` (4) | `killSession` clears cookies+user+emits+broadcasts; correct reason propagation; unsubscribe works; survives missing `BroadcastChannel` |
| `auth-service.spec.ts` (11) | state starts `initializing`; login success/failure/lockout; `reportAuthFailure` for all 4 types; logout fires `killSession`; refetch updates user on 200 / unauthenticates on 401 |

### Playwright (browser-level, run against prod)

`frontend-tenant/tests/e2e/` (chromium):

| File | Tests |
|---|---|
| `auth-smoke.spec.ts` (3) | home renders; login renders without errors; protected route doesn't loop — works against both local dev and prod |
| `prod-auth-smoke.spec.ts` (4) | tenant/login; admin/login; tenant/protected-no-loop; admin/protected-no-loop — against `https://hq.neurecore.com` and `https://cc.neurecore.com` |
| `prod-login-flow.spec.ts` (1) | Real `admin@neurecore.ai` login → `/admin/overview` (browser-level E2E) |
| `prod-walkthrough.spec.ts` (1) | Login → overview → agents → security pages, no console errors |

### CI prevention

- `bash scripts/auth-lint.sh` — runs 4 grep checks. **Run this before pushing auth-related changes.**
- TypeScript: `npx tsc --noEmit` on both `frontend-tenant/` and `frontend-admin/`.

---

## 14. Files of interest

### Backend (unchanged — FIX-020 was frontend-only)

| File | Role |
|---|---|
| `backend/src/main.ts` | Validation pipe, CORS, body parsers, cookie-parser, helmet |
| `backend/src/app.module.ts` | ThrottlerModule + global ThrottlerGuard, JwtAuthGuard, RolesGuard, TenantContextGuard, GlobalExceptionFilter, AuditInterceptor, TransformResponseInterceptor; AppModule.configure wires `RequestLoggerMiddleware` and `CsrfMiddleware` |
| `backend/src/modules/auth/auth.module.ts` | Pins `algorithm: 'HS256'`; providers AuthService, TokenService, PasswordService, JwtStrategy, LocalStrategy, JwtAuthGuard, RolesGuard, **AccountLockoutService** |
| `backend/src/modules/auth/services/auth.service.ts` | DUMMY_BCRYPT_HASH constant; constant-time validateUser; calls AccountLockoutService.check/record |
| `backend/src/modules/auth/services/token.service.ts` | `issueTokenPair`, `rotateRefreshToken` (transactional), `handleFamilyCompromise`, `verifyRefreshToken`, `revokeAllRefreshTokens`, `invalidateOnPasswordChange` |
| `backend/src/modules/auth/services/password.service.ts` | bcryptjs hash/compare, SALT_ROUNDS=12 |
| `backend/src/modules/auth/strategies/jwt.strategy.ts` | cookie-first extractor, pwd-claim check, blacklist check |
| `backend/src/modules/auth/guards/jwt-auth.guard.ts` | `@Public()` opt-out |
| `backend/src/modules/auth/controllers/auth.controller.ts` | `@Throttle({...})` decorators on every route |
| `backend/src/modules/security/services/account-lockout.service.ts` | sliding window + DB lock + token revocation |
| `backend/src/common/auth/cookie-auth.service.ts` | setAuthCookies / clearAuthCookies / parseCookies / safeEquals |
| `backend/src/common/auth/csrf.middleware.ts` | double-submit CSRF, in app.module.ts |
| `backend/prisma/migrations/20260705_auth_hardening_batch1/migration.sql` | User.passwordChangedAt + lockedUntil, RefreshToken.familyId + replacedById, LoginAttempt table, 246-row backfill of familyId |

### Frontend — NEW auth core (FIX-020)

> ⚠️ **DO NOT** import from anywhere other than `@/auth` for auth state changes. See [§16](#16-auth-architecture-fix-020--current-state).

| File | Role |
|---|---|
| `frontend-{tenant,admin}/src/auth/core/interfaces.ts` | ALL 7 SOLID interfaces + `AuthState`/`AuthFailure`/`AuthEvent` types |
| `frontend-{tenant,admin}/src/auth/impl/CookieTokenRepository.ts` | **The only** file that reads/writes the auth cookies. NEVER touches localStorage. |
| `frontend-{tenant,admin}/src/auth/impl/ZustandUserRepository.ts` | **The only** owner of the `useAuthStore` (tenant: `auth-storage`, admin: `admin-auth-storage`). |
| `frontend-{tenant,admin}/src/auth/impl/AuthEventBus.ts` | Pub/sub for cross-tab + non-React subscribers (sockets, analytics). |
| `frontend-{tenant,admin}/src/auth/impl/AuthRouteRegistry.ts` | Public-route allow-list + login/post-auth URLs. |
| `frontend-{tenant,admin}/src/auth/impl/RestAuthApi.ts` | Pure `/auth/*` HTTP calls. No state, no cookies. |
| `frontend-{tenant,admin}/src/auth/impl/SingleFlightRefreshCoordinator.ts` | Single-flight dedup of parallel `/auth/refresh` calls. |
| `frontend-{tenant,admin}/src/auth/impl/AuthSessionLifecycle.ts` | **The only** `killSession()` implementation. Atomic: cookies + store + eventBus + BroadcastChannel. |
| `frontend-{tenant,admin}/src/auth/impl/BaseAuthService.ts` | The L2 facade (the auth state machine). Admin extends this. |
| `frontend-admin/src/auth/impl/AuthService.ts` | Admin's subclass — disables register/loginWithGoogle, enforces admin roles. |
| `frontend-{tenant,admin}/src/auth/transport/authHttpClient.ts` | The single axios instance + CSRF request interceptor. |
| `frontend-{tenant,admin}/src/auth/transport/authResponseInterceptor.ts` | The 401/lockout/refresh-reuse response interceptor — delegates to `IAuthService.reportAuthFailure()`. |
| `frontend-{tenant,admin}/src/auth/di/authContainer.ts` | **Composition root.** The only place that wires concrete classes. |
| `frontend-{tenant,admin}/src/auth/hooks/useAuth.ts` | The L1 hook. Pages import only this. Uses `useSyncExternalStore`. |
| `frontend-{tenant,admin}/src/auth/hooks/useTenantAuth.ts` / `useAdminAuth.ts` | Back-compat shims. Thin wrappers over `useAuth()`. |
| `frontend-{tenant,admin}/src/auth/hooks/useRequireAuth.ts` | Convenience: `useAuth()` + soft redirect to `/login?from=...` if unauthenticated. |
| `frontend-{tenant,admin}/src/auth/components/AuthProvider.tsx` | Mounts `authService.initialize()` exactly once on mount. Cross-tab BroadcastChannel sync. |
| `frontend-{tenant,admin}/src/auth/components/SessionExpiredScreen.tsx` | Full-page "Your session expired. Sign in again." UI. |
| `frontend-{tenant,admin}/src/auth/components/AuthErrorScreen.tsx` | Unrecoverable error (refresh-reuse detected). |
| `frontend-{tenant,admin}/src/auth/components/LockoutScreen.tsx` | Lockout timer. |
| `frontend-{tenant,admin}/src/auth/index.ts` | Re-exports `{ AuthProvider, useAuth, useRequireAuth, authService, AuthError, ... }`. |

### Frontend — back-compat shims (still exist, delegate to the new core)

| File | Role |
|---|---|
| `frontend-{tenant,admin}/src/hooks/useTenantAuth.ts` / `useAdminAuth.ts` | Re-export of `auth/hooks/useTenantAuth.ts`. Existing 45 pages keep working. |
| `frontend-{tenant,admin}/src/stores/authStore.ts` | Re-export of `useAuthStore` from the auth core. |
| `frontend-tenant/src/services/cookieAuth.ts` (admin: deprecated, kept for back-compat) | Tenant: removed in FIX-020. Admin: thin shim that delegates to `CookieTokenRepository`. `CookieTokenRepository.clearTokens()` is what `cookieAuth.clear()` now calls. |
| `frontend-{tenant,admin}/src/services/api.ts` | Legacy axios instance (kept for non-auth-cored consumers). The interceptor now calls `authService.reportAuthFailure` instead of `window.location.href = '/login'`. |
| `frontend-{tenant,admin}/src/lib/errors.ts` | `useErrorHandler` no longer clears cookies / hard-redirects. The 401 handling moved to `authResponseInterceptor`. |

### DELETED in FIX-020

| File | Why |
|---|---|
| `frontend-{tenant,admin}/src/lib/security.ts` | Dead `SecureStorageKey`/`setSecureToken`/`getSecureToken`/`clearAllSecureTokens`. The XSS helpers (`sanitizeHtml`, `isValidEmail`, etc.) were never imported — if needed later, re-add narrowly. |
| `frontend-admin/src/services/cookieAuth.ts` direct cookie writes | Now delegates to `CookieTokenRepository`. |

### CI / prevention

| File | Role |
|---|---|
| `scripts/auth-lint.sh` | Greps for 4 banned patterns. Fails CI on any hit. Run before every push. |
| `frontend-tenant/tests/e2e/auth-smoke.spec.ts` | 3 Playwright tests on local + production — verify the loop is gone. |
| `frontend-tenant/tests/e2e/prod-auth-smoke.spec.ts` | 4 Playwright tests against `https://hq.neurecore.com` / `https://cc.neurecore.com`. |
| `frontend-tenant/tests/e2e/prod-login-flow.spec.ts` | 1 test: real login flow on prod. |
| `frontend-tenant/tests/e2e/prod-walkthrough.spec.ts` | 1 test: post-login walkthrough with no console errors. |

---

## 15. Known limitations & future work

| Issue | Status |
|---|---|
| `bcryptjs` (pure JS) is slow on the login hot-path. ~150ms per login vs ~30ms with native `bcrypt`. | Tracked in future-plans.md; switch to native `bcrypt` or `argon2id`. |
| Cookie auth assumes HTTPS termination in front. Plain HTTP would break `__Host-` prefix. | True; documented. Contabo uses Let's Encrypt via CyberPanel. |
| Single JWT secret; rotation invalidates all tokens. | Standard; rotation requires maintenance window. |
| No MFA on /auth/login. SMS/TOTP challenge not implemented. | Tracked; would slot in between `validateUser` and `issueTokenPair`. |
| Login attempts on `/auth/register` not lockouted (only throttled 5/min). | Low-risk (no existing user enumeration vector). |
| Session table grows unbounded; logout sets `isActive=false` but inactive rows aren't pruned. | Add nightly cron to expire sessions older than access-token TTL. |
| No per-route "remember me" / device-trust options. Refresh always 7d. | Future. |
| ~~Ad-hoc auth wiring~~ | ✅ **FIX-020 SHIPPED 2026-07-07** — 7 interfaces, 7 implementations, DI container, Atomic `killSession()`, single response interceptor, back-compat `useTenantAuth`/`useAdminAuth` shims, 27 new unit tests, 4 prod Playwright smoke tests, all green. See [int-features/auth-architecture.md](int-features/auth-architecture.md). |

---

## 16. Auth architecture (FIX-020 — current state)

> **⚠️ This entire section is structural. If any item below is broken in a regression, treat it as a Critical bug. Do NOT patch symptoms by reintroducing localStorage auth, direct cookie writes, or `window.location.href` redirects.**

### 16.1 The contract

The auth system is one orthogonal 4-layer machine:

| Layer | Lives in | What | Single entrypoint |
|---|---|---|---|
| L1 (UI) | `@/auth` | Hook + Context | `useAuth()` (discriminated `AuthState`) |
| L2 (Service) | `@/auth/di/authContainer.ts` | State machine | `IAuthService` (singleton `authService`) |
| L3 (Core) | `@/auth/impl/*` | 7 SOLID modules | `IAuthSessionLifecycle`, `ITokenRepository`, `IUserRepository`, `IAuthApi`, `IRefreshCoordinator`, `IAuthEventBus`, `IAuthRouteRegistry` |
| L4 (Transport) | `@/auth/transport/*` | Single axios + response interceptor | `authHttpClient` + `authResponseInterceptor` |

**Every layer depends on abstractions below, never concretions.** This is what makes the architecture "structurally incapable of being corrupted".

Full design: [int-features/auth-architecture.md](int-features/auth-architecture.md).

### 16.2 Corrupting the auth system is structurally hard

The following patterns are **banned** (CI-enforced by `bash scripts/auth-lint.sh`):

| Pattern | Why banned |
|---|---|
| `localStorage.setItem/getItem/removeItem` for `accessToken`/`refreshToken`/`auth`/`session`/`user` keys (outside `auth/`) | XSS exfiltration. Tokens must be in HttpOnly cookies. |
| `sessionStorage.setItem/getItem/removeItem` for the same keys | Same. |
| `document.cookie = ...` outside `src/auth/impl/CookieTokenRepository.ts` | Single owner of cookie I/O. The tenant `TokenManager` (a thin shim) and admin `cookieAuth` (also a shim) both delegate to it. |
| `window.location.href = '/login'` outside `auth/` | Bypasses the React state machine. Use `useAuth().logout()` or `useRequireAuth()` for soft redirects. |
| `SecureStorageKey` / `setSecureToken` / `getSecureToken` / `clearAllSecureTokens` | Dead legacy code (writes to `nc_at` key that doesn't match `__Host-nc_at`). The whole `lib/security.ts` file was deleted. |
| `useAuthStore.getState().setUser/clearUser` outside `auth/` | Bypasses the auth state machine. The store is owned by `ZustandUserRepository`. |
| `import { useAuthStore } from '@/stores/authStore'` for direct mutation | Use `useAuth()` instead. The `@/stores/authStore` re-export exists only for backwards-compat. |

If you find yourself wanting to add one of these for a "quick fix" — stop and ask: is there a way to do this through `useAuth()` / `authService` instead? In 100% of cases there is.

### 16.3 Quick diagnostic for "auth feels broken"

If a user reports "auth got corrupted" or "I got logged out randomly":

1. **Run `bash scripts/auth-lint.sh`** — if it fails, there's a banned-pattern regression. The error message tells you exactly which file/line.
2. **Check the served JS bundle** on the prod URL: `curl -sk https://hq.neurecore.com/_next/static/chunks/$(curl -sk https://hq.neurecore.com/ | grep -oE 'main-app-[a-z0-9]+\.js' | head -1) | grep -c "authService"`. Should be > 0. The reverse — if the new bundle doesn't reference `authService`, the deploy didn't go through or the build cache is stale.
3. **Check `__Host-nc_at` cookie**. If it's gone but the user is on a protected page, `killSession()` was called. Inspect the PM2 log for `[AuthSessionLifecycle]` (if added) or just `pm2 logs neurecore-tenant --lines 200 | grep -i auth`.
4. **Run `npx playwright test prod-auth-smoke --project=chromium`** (lives in `frontend-tenant/tests/e2e/`). 4 tests cover the live prod URLs. They assert: login form renders, no console errors, no hard-redirect-loop.
5. **Full-page navigation logs user out — `doInitialize` HttpOnly blind spot (FIXED 2026-07-08):**  
   The `__Host-nc_at` access-token cookie is `HttpOnly`, so `document.cookie` can't read it. On a full page reload (e.g. navigating to `/departments` via URL bar), `BaseAuthService.doInitialize()` previously called `this.tokenRepository.getAccessToken()` which returned `null` for the HttpOnly cookie. This caused the `!cookie && cachedUser` branch to clear the user from localStorage and redirect to `/login`.  
   **Fix:** `doInitialize()` now calls `this.tokenRepository.getCsrfToken()` instead — the CSRF cookie (`__Host-nc_csrf`) is NOT HttpOnly, so it's readable via JS. If a CSRF cookie exists AND a cached user exists in the Zustand store, the session is treated as valid (refetch runs in background to validate).
6. **Reference:** the full audit (now historical): [plans/auth-hardening-refactor.md](plans/auth-hardening-refactor.md).

### 16.4 What `useTenantAuth` / `useAdminAuth` do now

The shims are still exported (for the 21 tenant pages + 24 admin pages that imported them) but **they are now thin wrappers over `useAuth()`** with the original `AuthUser | null` return signature preserved. New code should `import { useAuth } from '@/auth'` directly.

```ts
// tenant: src/hooks/useTenantAuth.ts → re-exports auth/hooks/useTenantAuth.ts
// admin:  src/hooks/useAdminAuth.ts → re-exports auth/hooks/useAdminAuth.ts
// Both internals live in src/auth/hooks/.
```

### 16.5 Frontend Admin SUPER_ADMIN-only access (2026-07-17)

Per [user-roles.md](user-roles.md), Frontend Admin (cc.neurecore.com) is restricted to SUPER_ADMIN only.

**Implementation:**
- `frontend-admin/src/middleware.ts` — Server-side Next.js middleware decodes JWT from `auth-token` cookie and checks `role === 'SUPER_ADMIN'`. Non-SUPER_ADMIN users are redirected to `/login?reason=insufficient`.
- `frontend-admin/src/auth/impl/AuthService.ts` — `ADMIN_ROLES` changed from `['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT']` to `['SUPER_ADMIN']` only. Non-SUPER_ADMIN login fails with "Admin portal access restricted to SUPER_ADMIN only."
- `frontend-admin/src/auth/hooks/useAdminAuth.ts` — Enforces `ADMIN_ROLES = ['SUPER_ADMIN']`
- `frontend-admin/src/auth/hooks/useRequirePlatformAdmin.ts` — Enforces `PLATFORM_ADMIN_ROLES = ['SUPER_ADMIN']`

**Frontend Tenant access:** All 8 roles (SUPER_ADMIN, PLATFORM_ADMIN, SECURITY_OFFICER, SUPPORT, OWNER, ADMIN, USER, AUDITOR) can access hq.neurecore.com via `useTenantAuth()`.

**Backend note:** API 403 errors on POST/PATCH/DELETE are expected when CSRF protection is enabled (`CSRF_ENABLED=true` on production). Browser SPAs automatically include `X-CSRF-Token` header; direct API calls require manual CSRF handling.

---

## 17. Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser shows "Network Error" on login | OLS CORS strip; frontend using `withCredentials: true` to cross-origin API | Verify `next.config.js` rewrites exist; `NEXT_PUBLIC_API_URL` not set in `.env.production`; backend at `NEXT_INTERNAL_API_URL` reachable from Next.js process |
| API calls go to `localhost:3000` instead of relative `/api/v1` | `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` which gets inlined at build time | Change `.env.local` to `NEXT_PUBLIC_API_URL=/api/v1` and rebuild. Next.js inlines `process.env.NEXT_PUBLIC_*` at build time. |
| 401 on every protected endpoint | Token issued before backend's `passwordChangedAt` bump (or token in blacklist Redis after logout) | Re-login |
| 429 after a few bad attempts | AccountLockoutService threshold hit (5/10min) → surface `<LockoutScreen />` | Reset `lockedUntil` and Redis keys (Section 12); the user will see the lockout timer in the UI |
| Full-page navigation logs user out (redirects to /login) | `BaseAuthService.doInitialize()` used `getAccessToken()` (HttpOnly → null) instead of `getCsrfToken()` (non-HttpOnly) to detect session | Fixed in 2026-07-08: `doInitialize()` uses `getCsrfToken()` to check session presence. Rebuild and redeploy; ensure server has new chunk hash. |
| User stuck on "Restoring session..." splash | State stuck in `initializing` — usually means the persist hydration promise never resolved | Check `ZustandUserRepository.onHydrationComplete()` — it falls back to `queueMicrotask` if `persist.hasHydrated()` already returned true. If the issue persists, run `pm2 restart neurecore-tenant` (clears in-memory state). |
| Backend `INVALID_REQUEST` with no useful message | Class-validator 400; an old issue fixed by F8 update of `GlobalExceptionFilter` | Verify the deployed global exception filter has `extractGenericBadRequestHint` (Section F8 in fixes) |
| Access token returns 401 right after refresh | Refresh-failed → refresh-reuse detected → account tokens were revoked | Verify it's not a real compromise via `audit_logs` (Section 12); otherwise have user re-login |
