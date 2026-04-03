# Product Context — Phase 1 API Specification

## Phase 1 Scope

Focus: Multi-tenant user authentication, tenant management, and basic WebSocket connectivity.

## Complete Phase 1 Endpoints

### Authentication Module (`/api/v1/auth`)

#### 1. Register User
```
POST /api/v1/auth/register
Auth: Public
Body: {
  email: string         (email format)
  password: string      (min 8 chars)
  firstName: string
  lastName: string
}
Response: {
  id: string
  email: string
  tenantId: string
  role: "USER"
  accessToken: string
  refreshToken: string
}
Error: 409 if email already registered
```

#### 2. Login User
```
POST /api/v1/auth/login
Auth: Public
Body: {
  email: string
  password: string
}
Response: {
  id: string
  email: string
  tenantId: string
  role: UserRole        (SUPER_ADMIN | PLATFORM_ADMIN | OWNER | ADMIN | USER | ...)
  accessToken: string   (15m expires)
  refreshToken: string  (7d expires)
}
Error: 401 if invalid credentials
```

#### 3. Refresh Token
```
POST /api/v1/auth/refresh
Auth: Public (uses refreshToken from body or cookie)
Body: {
  refreshToken: string
}
Response: {
  accessToken: string   (new 15m token)
}
Error: 401 if refresh token invalid/expired
```

#### 4. Logout User
```
POST /api/v1/auth/logout
Auth: JWT Required
Header: Authorization: Bearer <accessToken>
Body: {}
Response: { message: "Logged out successfully" }
Side Effect: Token blacklisted in Redis, cannot reuse
```

#### 5. Get Current User Profile
```
GET /api/v1/auth/me
Auth: JWT Required
Header: Authorization: Bearer <accessToken>
Response: {
  id: string
  email: string
  firstName: string
  lastName: string
  tenantId: string
  role: UserRole
  createdAt: ISO8601
}
```

### Tenants Module (`/api/v1/tenants`)

#### 6. List All Tenants (Admin Only)
```
GET /api/v1/tenants
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN)
Query: 
  - limit?: number (default 20)
  - offset?: number (default 0)
  - status?: "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED"
Response: {
  data: [
    {
      id: string
      name: string
      slug: string            (unique identifier)
      plan: TenantPlan        (STARTER | GROWTH | PRO | ENTERPRISE)
      status: TenantStatus    (ACTIVE | SUSPENDED | TRIAL | CANCELLED)
      agentLimit: number      (5 for STARTER, etc.)
      logoUrl?: string
      website?: string
      industry?: string
      createdAt: ISO8601
      updatedAt: ISO8601
    }
  ]
  total: number
  page: number
}
Error: 403 if insufficient role
```

#### 7. Get Tenant by ID
```
GET /api/v1/tenants/:id
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN | OWNER)
Response: {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  status: TenantStatus
  agentLimit: number
  logoUrl?: string
  website?: string
  industry?: string
  userCount: number         (total users in tenant)
  createdAt: ISO8601
  updatedAt: ISO8601
}
Error: 403 if not authorized for tenant
Error: 404 if tenant not found
```

#### 8. Create Tenant
```
POST /api/v1/tenants
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN)
Body: {
  name: string              (required)
  slug: string              (unique, required)
  plan: TenantPlan          (default STARTER)
  logoUrl?: string
  website?: string
  industry?: string
}
Response: {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  status: "ACTIVE"          (always starts as ACTIVE)
  agentLimit: number        (based on plan)
  createdAt: ISO8601
}
Error: 409 if slug not unique
Error: 403 if insufficient role
```

#### 9. Update Tenant
```
PATCH /api/v1/tenants/:id
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN | OWNER)
Body: {
  name?: string
  plan?: TenantPlan
  status?: TenantStatus
  logoUrl?: string
  website?: string
  industry?: string
}
Response: {
  id: string
  name: string
  slug: string              (read-only)
  plan: TenantPlan
  status: TenantStatus
  agentLimit: number
  updatedAt: ISO8601
}
Error: 403 if insufficient authorization
Error: 404 if tenant not found
```

### Users Module (`/api/v1/users`)

#### 10. List Tenant Users
```
GET /api/v1/users
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN | OWNER | ADMIN)
Query:
  - tenantId: string        (SUPER_ADMIN can filter; others use their own tenant)
  - limit?: number (default 20)
  - offset?: number (default 0)
  - role?: UserRole (filter by role)
Response: {
  data: [
    {
      id: string
      tenantId: string
      email: string
      firstName: string
      lastName: string
      role: UserRole
      status: "ACTIVE" | "INVITED" | "DISABLED"
      createdAt: ISO8601
    }
  ]
  total: number
  page: number
}
```

#### 11. Get User by ID
```
GET /api/v1/users/:id
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN | OWNER | ADMIN | self)
Response: {
  id: string
  tenantId: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  status: "ACTIVE" | "INVITED" | "DISABLED"
  lastLoginAt?: ISO8601
  createdAt: ISO8601
  updatedAt: ISO8601
}
Error: 403 if not authorized to view user
Error: 404 if user not found
```

#### 12. Create User (Invite)
```
POST /api/v1/users
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN | OWNER | ADMIN)
Body: {
  email: string
  firstName: string
  lastName: string
  role: UserRole
  tenantId?: string         (auto-filled if not SUPER_ADMIN)
}
Response: {
  id: string
  tenantId: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  status: "INVITED"         (invitation email sent separately)
  createdAt: ISO8601
}
Error: 409 if email already in tenant
Error: 403 if insufficient role for target role
```

#### 13. Update User
```
PATCH /api/v1/users/:id
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN | OWNER | ADMIN | self)
Body: {
  firstName?: string
  lastName?: string
  role?: UserRole           (only by OWNER/ADMIN)
  status?: "ACTIVE" | "DISABLED"  (only by OWNER/ADMIN)
}
Response: {
  id: string
  email: string            (read-only)
  firstName: string
  lastName: string
  role: UserRole
  status: string
  updatedAt: ISO8601
}
Error: 403 if insufficient role
Error: 404 if user not found
```

#### 14. Delete User
```
DELETE /api/v1/users/:id
Auth: JWT + Roles (SUPER_ADMIN | PLATFORM_ADMIN | OWNER | ADMIN)
Response: { message: "User deleted successfully" }
Error: 403 if insufficient role
Error: 404 if user not found
Side Effect: User record soft-deleted or marked inactive
```

### Health Module (`/api/v1/health`)

#### 15. System Health Check
```
GET /api/v1/health
Auth: Public
Response: {
  status: "healthy" | "degraded" | "unhealthy"
  uptime: number           (seconds)
  database: {
    status: "connected" | "disconnected"
  }
  redis: {
    status: "connected" | "disconnected"
  }
  timestamp: ISO8601
}
Details:
  - Checks Prisma connection pool
  - Checks Redis connection
  - Returns overall system status
```

### WebSocket Gateway (`/`)

#### 16. Socket.IO Connection
```
WS wss://api.neurecore.com/socket
Auth: JWT in handshake query param
Handshake: {
  query: {
    token: string         (JWT accessToken)
    tenantId: string      (from JWT payload)
  }
}
Response (on success): 
  { event: 'connected', data: { userId, tenantId } }

Response (on auth failure):
  { event: 'error', data: 'Invalid token' }
  → Connection rejected
```

#### 17. Socket Events

**Client → Server Events**:
```
// Heartbeat / Keep-alive
emit('ping')
  → Server responds with 'pong'

// User presence
emit('user:status', { status: 'online' | 'away' })
  → Broadcast to other users in tenant

// Message (demo)
emit('message:send', { content: string, recipientId?: string })
  → Broadcast or DM
```

**Server → Client Events**:
```
// Connection established
on('connected', { userId, tenantId, onlineUsers: [] })

// Other user online
on('user:online', { userId, status: 'online' })

// Other user offline
on('user:offline', { userId, status: 'offline' })

// Broadcast message
on('message:receive', { fromUserId, content, sentAt })

// Error
on('error', { message })

// Server shutting down
on('server:shutdown', { message })
```

---

## Authentication Flow Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├─ POST /auth/register ──→ ✅ Create user, tenant
       │                         ← Returns accessToken + refreshToken
       │
       ├─ POST /auth/login ─────→ ✅ Validate password
       │                         ← Returns accessToken (15m) + refreshToken (7d)
       │
       ├─ GET /auth/me ────────→ ✅ Verify JWT
       │  (+ Bearer token)      ← Returns user profile
       │
       ├─ WS /socket ──────────→ ✅ Verify JWT in handshake
       │  (token in query)      ← Connected to event stream
       │
       └─ POST /auth/logout ───→ ✅ Add token to Redis blacklist
                                ← Old token rejected on subsequent requests
```

---

## Role Access Matrix

| Endpoint | SUPER_ADMIN | PLATFORM_ADMIN | OWNER | ADMIN | USER |
|----------|:-----------:|:---------------:|:-----:|:-----:|:----:|
| GET /tenants | ✅ | ✅ | ❌ | ❌ | ❌ |
| POST /tenants | ✅ | ✅ | ❌ | ❌ | ❌ |
| PATCH /tenants/:id | ✅ | ✅ | ✅ | ❌ | ❌ |
| GET /users | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /users | ✅ | ✅ | ✅ | ✅ | ❌ |
| PATCH /users/:id | ✅ | ✅ | ✅ | ✅ | (self only) |
| GET /auth/me | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /health | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Error Response Format

All errors follow this format:
```typescript
{
  statusCode: number       (400, 401, 403, 404, 409, 500)
  message: string          (human-readable)
  errors?: Array<{         (optional, validation errors)
    field: string
    message: string
  }>
  timestamp: ISO8601
}
```

### Common Errors
| Code | Cause | Action |
|------|-------|--------|
| 400 | Bad request (validation) | Check request body schema |
| 401 | Missing/invalid JWT | Refresh token or re-login |
| 403 | Insufficient role/tenant | Request higher privilege user |
| 404 | Resource not found | Verify ID exists |
| 409 | Conflict (duplicate email, slug) | Use different value |
| 500 | Server error | Check logs |

---

## Frontend Integration Points

### Tenant Portal (Next.js 3001)
- Uses Phase 1 auth endpoints
- Calls GET /auth/me on app load
- Connects to WebSocket for real-time updates
- Displays user profile and tenant info
- Lists users in tenant (if ADMIN role)

### Admin Portal (Next.js 3002)
- Uses all Phase 1 endpoints
- Lists/manages tenants (if SUPER_ADMIN/PLATFORM_ADMIN)
- Manages users across tenants
- Views system health
- Connects to WebSocket for real-time admin alerts

---

## Testing Checklist

Phase 1 is complete when all of these tests pass:

**Auth Service**:
- [ ] Register creates user + tenant
- [ ] Login returns valid JWT tokens
- [ ] Logout blacklists token
- [ ] GET /me returns correct user
- [ ] Refresh token extends session
- [ ] Invalid credentials return 401

**Tenant Service**:
- [ ] List tenants (SUPER_ADMIN only)
- [ ] Create tenant with plan assignment
- [ ] Update tenant status
- [ ] Tenant isolation: User A cannot access Tenant B data

**User Service**:
- [ ] Create user in tenant
- [ ] List users within tenant
- [ ] Update user role (OWNER/ADMIN only)
- [ ] User isolation: User A cannot manage User B (unless ADMIN)

**WebSocket**:
- [ ] Socket authenticates with JWT
- [ ] Socket broadcasts presence
- [ ] Disconnection broadcast
- [ ] Invalid token rejected

**Integration**:
- [ ] Frontends can register → login → access dashboard
- [ ] Token refresh works seamlessly
- [ ] WebSocket reconnects on network restore

---

## Onboarding Wizard — Product Flow (9 Steps)

### Step Order (WELCOME is defined but skipped in ACTIVE_STEPS)
1. **ORGANIZATION** — Company name, slug, industry, size, timezone, currency
2. **ADMIN** — Admin user profile (first/last name, title)
3. **PLAN** — Select billing tier (fetched from platform; set by admin)
4. **DEPARTMENTS** — Create departments (name, description)
5. **TEAM** — Invite team members (email, firstName, lastName, role)
6. **INTEGRATIONS** — Toggle integrations (Slack, Google Workspace, etc.)
7. **AGENTS** — Configure AI agents from platform templates
8. **SECURITY** — Set 2FA requirements, session policy, IP allowlist
9. **REVIEW** → triggers `completeWizard` which deploys everything to DB

### Wizard Completion Behavior
- `completeWizard` is the **only** step that writes to the database for invitations, integrations, and agents
- Organization + departments are written to DB during their respective steps
- `completeWizard` is idempotent — safe to call multiple times

### What Admin Pre-configures for Tenants
Before a tenant can complete the wizard, an admin should have:
1. Created at least one active **Tier/Plan** — tenants select from these in PLAN step
2. Created **Platform Agent Templates** — tenants pick from these in AGENTS step
3. (Optional) Deployed dept templates or agents directly to skip wizard for specific tenants

---

## Admin Portal Control Surface

### Tenant Management
- List all tenants, view per-tenant stats (agents, users, plan)
- Deploy department template to specific tenant
- Deploy agents directly to specific tenant (bypasses wizard)

### Platform Configuration
- **Tiers**: Create/edit/toggle/reorder plans that appear in tenant wizard
  - Controls: `maxAgents`, `maxUsers`, features list, price, billing cycle
- **Agent Templates**: Create platform-level templates for wizard AGENTS step
  - Only `type: PLATFORM` templates appear in onboarding
- **Department Templates**: Named department sets admins can deploy to tenants

### Monitoring & Analytics
- Cross-tenant agent fleet view
- Global user count and role breakdown
- Per-tenant KPIs (active agents, invitations, integrations)
- Platform-wide usage metrics

### Platform Settings
- Security policy (password requirements, 2FA enforcement)
- Notification settings
- Integration configuration

---

## Tenant Portal — Current Implementation Status

| Feature | Status |
|---|---|
| Auth (login/register/logout) | ✅ Complete |
| Onboarding wizard (9 steps) | ✅ Complete |
| Dashboard | ✅ Shell (needs agent data) |
| Agent management | 🔲 Planned |
| Team management | 🔲 Planned |
| Billing/plan management | 🔲 Planned |
| Integrations management | 🔲 Planned |
| Settings | 🔲 Planned |
