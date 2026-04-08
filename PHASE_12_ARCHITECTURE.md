# Phase 12: System Architecture & Integration Documentation

**Date**: April 8, 2026  
**Status**: 🚀 **IN PROGRESS**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Module Dependencies](#module-dependencies)
5. [API Reference](#api-reference)
6. [Security Model](#security-model)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

NeureCore Phase 12 represents a fully integrated, production-ready platform with a unified 3-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                   NeureCore Platform v1.0                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐          ┌──────────────────────────┐ │
│  │  Frontend-Admin  │          │  Frontend-Tenant         │ │
│  │  (33 modules)    │          │  (33 modules)            │ │
│  │  8,741 files     │          │  8,699 files             │ │
│  │                  │          │                          │ │
│  │  - Admin Panel   │          │  - User Dashboard        │ │
│  │  - Collections   │          │  - Data Views            │ │
│  │  - Plugins       │          │  - Plugins               │ │
│  │  - Settings      │          │  - Configuration Items   │ │
│  └────────┬─────────┘          └──────────────┬───────────┘ │
│           │                                   │               │
│           └──────────────────┬────────────────┘               │
│                              │                                │
│                    REST API (OAuth2/JWT)                      │
│                    WebSocket (Real-time)                      │
│                    gRPC (Server-to-Server)                    │
│                              │                                │
│           ┌──────────────────┴────────────────┐               │
│           │                                   │               │
│  ┌────────▼─────────────────────────────────────────┐        │
│  │           Backend API (NestJS)                    │        │
│  │           33 modules, 14,922 files               │        │
│  │                                                   │        │
│  │  ┌──────────────────────────────────────────┐  │        │
│  │  │    Core Infrastructure (Tier 1)          │  │        │
│  │  │  - Database abstraction (Prisma ORM)     │  │        │
│  │  │  - Authentication & Authorization        │  │        │
│  │  │  - Request/Response lifecycle            │  │        │
│  │  │  - Error handling & validation           │  │        │
│  │  └──────────────────────────────────────────┘  │        │
│  │                                                   │        │
│  │  ┌──────────────────────────────────────────┐  │        │
│  │  │    Business Logic (Tier 2)                │  │        │
│  │  │  - Collections management                 │  │        │
│  │  │  - Records CRUD operations                │  │        │
│  │  │  - Plugin execution                       │  │        │
│  │  │  - Workflow management                    │  │        │
│  │  │  - ACL enforcement                        │  │        │
│  │  └──────────────────────────────────────────┘  │        │
│  │                                                   │        │
│  │  ┌──────────────────────────────────────────┐  │        │
│  │  │    Infrastructure Services (Tier 3)      │  │        │
│  │  │  - Audit logging                         │  │        │
│  │  │  - Cron job scheduling                   │  │        │
│  │  │  - Pub/Sub messaging                     │  │        │
│  │  │  - API Gateway                           │  │        │
│  │  │  - Cache management (Redis)              │  │        │
│  │  └──────────────────────────────────────────┘  │        │
│  │                                                   │        │
│  │  125+ Plugins                                     │        │
│  │  - Field types, Components, Actions              │        │
│  │  - Business logic extensions                     │        │
│  │                                                   │        │
│  └───────────────────┬────────────────┬─────────────┘        │
│                      │                │                       │
│                      │                │                       │
│        ┌─────────────┘  ┌──────────────┴─────────────┐        │
│        │                │                            │        │
│   ┌────▼──────┐   ┌─────▼─────┐           ┌────────▼──┐    │
│   │ PostgreSQL │   │  Redis    │           │   S3/Blob │    │
│   │ (Neon DB)  │   │  Cache    │           │  Storage  │    │
│   │            │   │           │           │           │    │
│   │ - Tenants  │   │- Sessions │           │- Uploads  │    │
│   │ - Collections  │- Cache    │           │- Assets   │    │
│   │ - Records  │   │- Queues  │           │           │    │
│   │ - Plugins  │   │           │           │           │    │
│   └────────────┘   └───────────┘           └───────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Total System Statistics:**

- **Total Files**: 32,809
- **Total Modules**: 123
- **Lines of Code**: ~500k+ (estimated)
- **Plugin Count**: 125+
- **API Endpoints**: 200+ (estimated)
- **Deployment Targets**: Vercel (frontend), Vercel/Railway (backend)

---

## Component Architecture

### 1. Frontend-Admin (33 Modules, 8,741 Files)

**Purpose**: System administration and data management interface

**Core Modules**:

- `acl` - Access control and permissions management
- `api-client` - Backend API communication
- `application` - App lifecycle and initialization
- `block-provider` - Data visualization blocks
- `collection-manager` - Collection CRUD UI
- `common` - Shared utilities
- `data-source` - Data source configuration
- `filter-provider` - Advanced filtering UI
- `formily` - Form building framework
- `hooks` - React hooks library
- `modules` - Feature modules (blocks, actions, workflows)
- `plugins` - 125+ plugin packages
- `schema-component` - UI component rendering
- `schema-templates` - Pre-built UI templates

**Technology Stack**:

- React 18
- TypeScript 4.9+
- Ant Design 5
- Next.js for SSG/page generation
- MobX for state management
- Webpack 5 for bundling

**Key Features**:

- Create and manage data collections
- Define field types and validation rules
- Design user interfaces (blocks, views, forms)
- Install and configure plugins
- Manage permissions and roles
- Monitor system health

---

### 2. Frontend-Tenant (33 Modules, 8,699 Files)

**Purpose**: End-user facing data application interface

**Core Modules**: (Identical structure to frontend-admin)

- All 33 modules from frontend-admin
- 125+ plugins with tenant-scoped visibility

**Technology Stack**: (Same as frontend-admin)

**Key Features**:

- View configured data collections
- Create, read, update, delete records
- Apply filters and sorting
- Use configured UI blocks (Grid, Form, Calendar, etc.)
- Execute tenant-accessible plugins
- Real-time collaboration (if enabled)

**Data Isolation**:

- All API requests include `tenantId` parameter
- Backend enforces tenant-scoped data access
- UI never shows admin-only features
- Plugin visibility controlled server-side

---

### 3. Backend API (33 Modules, 14,922 Files)

**Technology Stack**:

- NestJS 9+ framework
- TypeScript 4.9+
- PostgreSQL (via Prisma ORM)
- Redis for caching/sessions
- Socket.io for real-time updates

**Core Tier 1 (Critical Infrastructure)**:

```
authentication/
├── AuthService
├── JWTStrategy
├── OAuth2Provider
└── MFAManager

authorization/
├── ACLService
├── RoleManager
└── PermissionValidator

database/
├── PrismaService
├── ConnectionPool
└── QueryBuilder

cache/
├── RedisService
├── CacheManager
└── SessionStore
```

**Core Tier 2 (Business Logic)**:

```
collections/
├── CollectionService (CRUD)
├── FieldManager
├── FieldValidator
└── TypeSystem

records/
├── RecordService
├── RecordValidator
├── QueryExecutor
└── FilterEngine

plugins/
├── PluginRegistry
├── PluginLoader
├── PluginExecutor
└── HookSystem

workflows/
├── WorkflowEngine
├── TaskScheduler
└── StateManager
```

**Tier 3 (Infrastructure Services)**:

```
audit/
├── AuditLogger
├── AuditStore
└── AuditReporter

cron/
├── CronService
├── JobScheduler
└── TaskQueue

messaging/
├── PubSubManager
├── EventBus
└── MessageQueue

gateway/
├── ApiGateway
├── RateLimiter
└── RequestRouter
```

---

## Data Flow Diagrams

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Authentication Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend                     Backend                         │
│     │                            │                            │
│     │─── POST /auth/login ─────→ │                           │
│     │   { email, password }      │                           │
│     │                            │                           │
│     │                ┌──────────►  Validate credentials       │
│     │                │            │                          │
│     │                │     ┌──────► Check 2FA/MFA             │
│     │                │     │       │                          │
│     │                │     │    Generate JWT token           │
│     │                │     │       │                          │
│     │  ◄─── JWT ─────┴─────┘       │                         │
│     │  { token, user, expiresIn } │                         │
│     │                              │                          │
│  Store token in localStorage/sessionStorage                  │
│     │                              │                          │
│     │─── GET /api/collections ─→ │                          │
│     │   Authorization: Bearer JWT │                          │
│     │                              │                          │
│     │          ┌──────────────────► Verify JWT signature     │
│     │          │                   │                         │
│     │          │         ┌────────► Check token expiration   │
│     │          │         │         │                         │
│     │          │         │      Extract userId, tenantId     │
│     │          │         │         │                         │
│     │  ◄─── collections ┴─────────┘                         │
│     │  [ { id, name, ... } ]                                │
│     │                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Data Query Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Data Query Flow (CRUD Operations)               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend-Tenant                                Backend       │
│        │                                          │          │
│        │  GET /api/collections/users/records    │          │
│        │  ?filter={role:admin}&sort={-id}       │          │
│        │─────────────────────────────────────→  │          │
│        │                                  ┌─────►  Route to RecordService
│        │                                  │       │          │
│        │                      ┌───────────────────► Validate author
│        │                      │           │       │ (tenantId)
│        │                      │    ┌──────────────► Parse filter/sort
│        │                      │    │      │       │          │
│        │                      │    │  ┌───────────► Query via Prisma
│        │                      │    │  │   │       │          │
│        │                  ┌───┴─┬─┴──┴────►        │ Filter by tenantId
│        │                  │   └─────────────────→  │ Execute query
│        │                  │                   │    │          │
│        │              Format response        │    │ Serialize results
│        │                  │                   │    │          │
│        │  ◄─ JSON Array ──┴───────────────────┴────┘          │
│        │  [ {id, name, role, ...} ]                          │
│        │                                                      │
│  Render in UI                                                 │
│        │                                                      │
│  User selects record                                          │
│        │                                                      │
│        │  PATCH /api/collections/users/records/123           │
│        │  { role: 'super_admin' }                            │
│        │─────────────────────────────────────→               │
│        │                                  ┌──────►  Auth check
│        │                      ┌───────────────────► ACL check
│        │                      │           │ (can user modify?)
│        │                      │    ┌──────────────► Validate input
│        │                      │    │      │        │          │
│        │                      │    │  ┌───────────► Prisma update
│        │                      │    │  │   │        │          │
│        │                      │    │  │   │     ┌──────────► Write to DB
│        │                      │    │  │   │     │  │        │
│        │                  ┌───┴─┬─┴──┴───┴──────┘  │        │
│        │              Emit audit log                │        │
│        │              Emit change event             │        │
│        │                  │                   │    │        │
│        │  ◄─ 200 OK ──────┴───────────────────┴────┘        │
│        │  { id: 123, role: 'super_admin', ... }             │
│        │                                                      │
└─────────────────────────────────────────────────────────────┘
```

### Plugin Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Plugin Execution Flow                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (UI)              Plugin System         Backend     │
│       │                           │                  │       │
│ User clicks plugin    ┌───────────►                  │       │
│ action in UI          │           │                  │       │
│       │               │        Check visibility      │       │
│       │               │           │                  │       │
│       │──────────────────POST /plugin/execute──────→│       │
│       │  { pluginId, action, params }               │       │
│       │               │           │                  ├──────►
│       │               │      Load plugin module      │       │
│       │               │           │                  │       │
│       │               │      Validate security      │       │
│       │               │           │                  │       │
│       │               │      Run before hooks       │       │
│       │               │           │                  │       │
│       │               │      Execute handler        │       │
│       │               │           │                  │       │
│       │               │      Capture output         │       │
│       │               │           │                  │       │
│       │               │      Run after hooks        │       │
│       │               │           │                  │       │
│       │      ◄────────────Response + metadata─────  │       │
│       │      { success, data, errors, duration }    │       │
│       │               │                              │       │
│    Display results                                    │       │
│       │                                              │       │
│    Real-time update (WebSocket)                      │       │
│       │                                              │       │
│       │◄─ WS: plugin.finished ────────────────────────      │
│       │  { pluginId, jobId, status, ... }                   │
│       │                                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Dependencies

### Frontend Module Dependency Graph

```
application (root)
├── api-client
│   └── common
├── acl
│   └── common
├── block-provider
│   ├── data-source
│   ├── schema-component
│   └── plugins
├── collection-manager
│   ├── data-source
│   ├── schema-component
│   └── acl
├── formily
│   ├── schema-component
│   └── common
├── modules
│   ├── blocks/data-blocks
│   ├── actions/custom
│   └── workflows
└── plugins (125+ packages)
    ├── field-types
    ├── ui-components
    ├── validators
    └── business-logic
```

### Backend Module Dependency Graph

```
app
├── auth (tier-1)
│   └── cache
├── database (tier-1)
│   └── common
├── collections (tier-2)
│   ├── database
│   ├── plugins
│   └── acl
├── records (tier-2)
│   ├── collections
│   ├── validation
│   └── audit
├── plugins (tier-2)
│   ├── loader
│   ├── executor
│   └── hooks
├── audit (tier-3)
│   ├── database
│   └── messaging
├── cron (tier-3)
│   ├── database
│   └── messaging
└── messaging (tier-3)
    └── cache
```

---

## API Reference

### Authentication Endpoints

```
POST /api/auth/register
- Register new user (admin or tenant user)
- Request: { email, password, name, tenantId? }
- Response: { token, user, expiresIn }

POST /api/auth/login
- Login with credentials
- Request: { email, password }
- Response: { token, user, expiresIn }

POST /api/auth/refresh
- Refresh JWT token
- Request: { refreshToken }
- Response: { token, expiresIn }

GET /api/auth/me
- Get current user profile
- Response: { id, email, name, tenantId, role, permissions }

POST /api/auth/logout
- Invalidate user session
- Request: {}
- Response: { success: true }
```

### Collections Endpoints

```
GET /api/collections
- List collections with pagination
- Query: { skip?, take?, search?, sort? }
- Response: { data: [], total: number }

GET /api/collections/:id
- Get collection with fields
- Response: { id, name, title, fields: [], createdAt, ... }

POST /api/collections
- Create new collection (admin only)
- Request: { name, title, description?, fields }
- Response: { id, name, ... }

PATCH /api/collections/:id
- Update collection settings
- Request: { title?, description?, config? }
- Response: { id, ... }

DELETE /api/collections/:id
- Delete collection (admin only, soft delete)
- Response: { success: true }
```

### Records Endpoints

```
GET /api/collections/:id/records
- Get records with filtering/sorting/pagination
- Query: { filter?, sort?, select?, skip?, take? }
- Response: { data: [], total, pageInfo }

POST /api/collections/:id/records
- Create new record
- Request: { field1: value1, field2: value2, ... }
- Response: { id, createdAt, ... }

GET /api/collections/:id/records/:recordId
- Get single record
- Response: { id, field1, field2, ... }

PATCH /api/collections/:id/records/:recordId
- Update record fields
- Request: { field1: newValue, ... }
- Response: { id, ... }

DELETE /api/collections/:id/records/:recordId
- Delete record
- Response: { success: true }

POST /api/collections/:id/records/batch
- Batch create/update records
- Request: { operations: [{ type, data }, ...] }
- Response: { results: [], errors: [] }
```

### UI Schema Endpoints

```
GET /api/ui/schemas
- List UI schemas for current user
- Response: { data: [], total }

GET /api/ui/schemas/:id
- Get specific UI schema
- Response: { id, type, config, ... }

POST /api/ui/schemas
- Create UI schema
- Request: { name, type, config, ... }
- Response: { id, ... }

PATCH /api/ui/schemas/:id
- Update UI schema
- Request: { config?, ... }
- Response: { id, ... }

DELETE /api/ui/schemas/:id
- Delete UI schema
- Response: { success: true }
```

### Plugins Endpoints

```
GET /api/plugins
- List available plugins
- Query: { type?, scope?, search? }
- Response: [ { id, name, version, ... } ]

GET /api/plugins/:id
- Get plugin metadata and settings
- Response: { id, name, config, hooks, ... }

POST /api/plugins/:id/execute
- Execute plugin action
- Request: { action, params, context }
- Response: { success, data, metadata }

POST /api/plugins/:id/install
- Install plugin (admin only)
-Request: { version?, config? }
- Response: { success, plugin }

DELETE /api/plugins/:id
- Uninstall plugin (admin only)
- Response: { success: true }
```

---

## Security Model

### Multi-Tenant Isolation

```
Every request is scoped to the authenticated user's tenant:

┌──────────────────────────────────────────────────────────────┐
│  Request Headers                                              │
│  ────────────────                                             │
│  Authorization: Bearer <JWT>                                  │
│                                                               │
│  JWT Payload:                                                │
│  {                                                            │
│    userId: "user-123",          // User ID                   │
│    tenantId: "tenant-456",      // Tenant ID (null=admin)   │
│    email: "user@example.com",                                │
│    role: "editor",                                           │
│    permissions: [...]                                         │
│  }                                                            │
│                                                               │
│  Backend Processing:                                         │
│  ─────────────────                                           │
│  1. Extract JWT                                              │
│  2. Verify signature & validity                              │
│  3. Extract tenantId                                         │
│  4. Add to request context: req.user = { userId, tenantId } │
│  5. All queries automatically filtered by tenantId           │
│  6. Respond with 403 if user attempts unauthorized access    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Permission Matrix

```
Resource          Admin   Editor  Viewer  Tenant-User
──────────────────────────────────────────────────────
Create Collection   ✓       -       -         -
Edit Collection     ✓       ✓       -         -
Delete Collection   ✓       -       -         -
View Collection     ✓       ✓       ✓         ✓

Create Record       ✓       ✓       -         ✓
Edit Record         ✓       ✓       -         ✓
Delete Record       ✓       -       -         ✓
View Record         ✓       ✓       ✓         ✓

Install Plugin      ✓       -       -         -
Configure Plugin    ✓       ✓       -         -
Execute Plugin      ✓       ✓       ✓         ✓

Manage Users        ✓       -       -         -
View Audit Logs     ✓       -       -         -
```

### Data Encryption

```
In Transit:
- All API traffic over HTTPS/TLS 1.3+
- WebSocket connections use WSS (WSS)

At Rest:
- Sensitive fields encrypted in database
  - Passwords: bcrypt (salt + hash)
  - API keys: AES-256-GCM
  - PII fields: Application-level encryption

In Memory:
- Secrets stored in environment variables
- No plaintext secrets in code/config
- Memory cleared after use where possible
```

---

## Deployment Architecture

### Production Infrastructure

```
┌─────────────────────────────────────────────────────────┐
│                    Internet (HTTPS)                      │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐      ┌───▼───┐      ┌───▼───┐
    │ Vercel  │      │Vercel │      │Vercel │
    │Database:│      │Backend│      │Logs   │
    │Neon PostPG  │      │API    │      │       │
    └────┬────┘      └───┬───┘      └───┬───┘
         │               │               │
    ┌────┴────────┬──────┴──────┬───────┴────┐
    │             │              │             │
┌───▼──┐      ┌──▼───┐       ┌──▼────┐    ┌──▼────┐
│ PgSQL│      │Redis │       │ S3    │    │ Email │
│  DB  │      │ Cache│       │Storage│    │ SES   │
└──────┘      └──────┘       └───────┘    └───────┘
```

### Environment Configuration

```
Development:
- Frontend: localhost:3000 (Next.js dev server)
- Backend: localhost:3001 (NestJS dev server)
- Database: Neon (development branch)

Staging:
- Frontend-Admin: https://admin-staging.neurecore.com (Vercel)
- Frontend-Tenant: https://app-staging.neurecore.com (Vercel)
- Backend: https://api-staging.neurecore.com (Vercel)
- Database: Neon (staging)

Production:
- Frontend-Admin: https://admin.neurecore.com (Vercel)
- Frontend-Tenant: https://app.neurecore.com (Vercel)
- Backend: https://api.neurecore.com (Vercel)
- Database: Neon (production)
```

---

## Phase 12 Deliverables Checklist

```
Documentation:
☐ System Architecture (this document)
☐ API Reference with OpenAPI spec
☐ Plugin Development Guide
☐ Deployment & DevOps Guide
☐ Operations & Monitoring Guide

Testing:
☐ E2E test suite (system.spec.ts)
☐ API integration tests (api-integration.spec.ts)
☐ Plugin validation suite
☐ Security audit checklist

Metrics & Reporting:
☐ Performance benchmarks
☐ Build time metrics
☐ Bundle size analysis
☐ Test coverage reports

Infrastructure:
☐ Staging environment setup
☐ CI/CD pipeline configuration
☐ Monitoring & alerting setup
☐ Backup & disaster recovery procedures
```

---

**Document Status**: In Progress (Phase 12)  
**Last Updated**: April 8, 2026  
**Next Review**: Upon Phase 12 completion
