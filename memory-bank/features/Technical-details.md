# Technical Details — NeureCore Platform

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Backend Stack](#backend-stack)
- [Frontend Stack](#frontend-stack)
- [Database Schema](#database-schema)
- [Module Architecture](#module-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [API Structure](#api-structure)
- [Infrastructure](#infrastructure)
- [Security](#security)
- [Observability](#observability)

---

## Architecture Overview

### Multi-Tenant SaaS Architecture

NeureCore is a multi-tenant platform with separated frontend and backend systems:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEURECORE ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────┐     ┌─────────────────────────────────┐  │
│   │    FRONTEND TENANT         │     │      FRONTEND ADMIN            │  │
│   │    (hq.neurecore.com)      │     │      (cc.neurecore.com)        │  │
│   │    Port: 3001              │     │      Port: 3002                │  │
│   │    Next.js 15 / React 19   │     │      Next.js 15 / React 19     │  │
│   └──────────────┬──────────────┘     └──────────────┬──────────────────┘  │
│                  │                                     │                     │
│                  └─────────────────┬───────────────────┘                     │
│                                    │                                         │
│                                    ▼                                         │
│                    ┌───────────────────────────────────┐                    │
│                    │      NESTJS BACKEND               │                    │
│                    │      (brain.neurecore.com)        │                    │
│                    │      Port: 3000                   │                    │
│                    │                                   │                    │
│                    │  ┌─────────┐  ┌─────────┐        │                    │
│                    │  │  Auth   │  │ Tenants │        │                    │
│                    │  │  Module │  │ Module  │        │                    │
│                    │  └─────────┘  └─────────┘        │                    │
│                    │  ┌─────────┐  ┌─────────┐        │                    │
│                    │  │  Users  │  │ Agents  │        │                    │
│                    │  │ Module  │  │ Module  │        │                    │
│                    │  └─────────┘  └─────────┘        │                    │
│                    │  ┌─────────┐  ┌─────────┐        │                    │
│                    │  │  Tasks  │  │ Workflow│        │                    │
│                    │  │ Module  │  │ Module  │        │                    │
│                    │  └─────────┘  └─────────┘        │                    │
│                    └──────────────┬────────────────────┘                    │
│                                   │                                         │
│              ┌────────────────────┼────────────────────┐                   │
│              ▼                    ▼                    ▼                   │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐        │
│   │   PostgreSQL    │   │      Redis      │   │    WebSocket    │        │
│   │   (Neon/Contabo)│   │  (Upstash/Contabo)│   │    (Socket.IO)  │        │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architecture Principles

1. **No Shared Code**: Frontend and backend are completely independent
2. **Tenant Isolation**: Every database query MUST include tenantId filter
3. **Service Injection**: Never instantiate services manually; always use DI
4. **API-First**: All communication via HTTP/WebSocket only

---

## Backend Stack

### Runtime & Framework

| Component   | Technology | Version                      |
| ----------- | ---------- | ---------------------------- |
| Runtime     | Node.js    | 20+                          |
| Framework   | NestJS     | 11.0.1                       |
| HTTP Server | Express.js | via @nestjs/platform-express |
| WebSocket   | Socket.IO  | 4.8.1                        |
| Language    | TypeScript | 5.7.3                        |

### Key Dependencies

| Category       | Package           | Version |
| -------------- | ----------------- | ------- |
| Database ORM   | Prisma            | 5.22.0  |
| Authentication | Passport.js + JWT | Latest  |
| Validation     | class-validator   | 0.14.1  |
| Security       | Helmet            | 8.1.0   |
| Rate Limiting  | @nestjs/throttler | Latest  |
| AI Framework   | LangChain         | 0.3.0   |
| Logging        | Pino              | 9.14.0  |
| Testing        | Jest              | 30.0.0  |
| Linting        | ESLint            | 9.18.0  |

### Project Structure

```
backend/
├── src/
│   ├── app.module.ts              # Root module
│   ├── common/                    # Shared utilities
│   │   ├── decorators/            # Custom decorators
│   │   ├── errors/                # Error handling
│   │   ├── filters/               # Exception filters
│   │   ├── interceptors/          # Request/response interceptors
│   │   ├── middleware/            # Custom middleware
│   │   └── logging/               # Logging service
│   ├── config/                    # Configuration module
│   ├── infrastructure/            # Infrastructure concerns
│   │   ├── cache/                 # Redis caching
│   │   ├── database/              # Prisma service
│   │   └── tracing/               # OpenTelemetry tracing
│   ├── modules/                   # Feature modules
│   │   ├── auth/                  # Authentication
│   │   ├── tenants/               # Tenant management
│   │   ├── users/                 # User management
│   │   ├── agents/                # AI agents
│   │   ├── tasks/                 # Task management
│   │   ├── workflows/             # Workflow automation
│   │   ├── chat/                  # Real-time chat
│   │   ├── analytics/             # Analytics & ML
│   │   ├── connectors/            # CRM integrations
│   │   ├── finance/               # Billing & costs
│   │   ├── governance/            # Approvals & rules
│   │   ├── tools/                 # Agent tools
│   │   └── [30+ more modules]    # See Module Architecture
│   └── types/                     # TypeScript definitions
├── prisma/
│   └── schema.prisma              # Database schema (40+ models)
├── test/                          # Test files
├── Dockerfile                     # Container definition
├── docker-compose.yml            # Local dev environment
└── package.json                  # Dependencies
```

---

## Frontend Stack

### Tenant Portal (hq.neurecore.com)

| Component       | Technology    | Version         |
| --------------- | ------------- | --------------- |
| Framework       | Next.js       | 15 (App Router) |
| UI Library      | React         | 19              |
| Styling         | Tailwind CSS  | 4               |
| Components      | Radix UI      | Latest          |
| Animation       | Framer Motion | 12.34.2         |
| Charts          | Recharts      | 3.7.0           |
| Workflow UI     | ReactFlow     | 11.11.4         |
| Command Palette | cmdk          | 1.1.1           |
| Date Utils      | date-fns      | 4.1.0           |

### Admin Portal (cc.neurecore.com)

- Same stack as Tenant Portal
- Additional admin-specific components
- Platform-wide analytics and monitoring

### Frontend Directory Structure

```
frontend-tenant/                  frontend-admin/
├── src/                          ├── src/
│   ├── app/                      │   ├── app/
│   │   ├── (app)/                │   │   ├── api/
│   │   │   ├── dashboard/        │   │   │   └── v1/           # API routes
│   │   │   ├── agents/           │   │   ├── overview/
│   │   │   ├── tasks/            │   │   ├── tenants/
│   │   │   ├── workflows/        │   │   ├── agents/
│   │   │   └── [more]            │   │   ├── billing/
│   │   ├── login/                │   │   ├── settings/
│   │   └── onboarding/           │   │   └── [more]
│   ├── components/               │   ├── login/
│   │   ├── ui/                  │   │   └── [shared]
│   │   ├── charts/              │   └── [shared]
│   │   └── [feature-based]      ├── components/
│   ├── core/                    │   ├── charts/
│   │   ├── infrastructure/      │   ├── kpi/
│   │   └── services/            │   ├── layout/
│   ├── features/               │   └── [shared]
│   ├── hooks/                   ├── hooks/
│   ├── lib/                     ├── lib/
│   ├── services/               │   ├── api/
│   ├── shared/                  │   └── [shared]
│   ├── stores/                  │   ├── services/
│   │                           │   │   └── settings/
│   │                           │   └── [shared]
│   │                           │   ├── stores/
│   │                           │   └── types/
│   └── [config, utils]          └── [config, utils]
```

---

## Database Schema

### Core Models (40+ entities)

| Category                     | Models                                                        |
| ---------------------------- | ------------------------------------------------------------- |
| **Tenant & User Management** | Tenant, User, Session, RefreshToken, ApiKey                   |
| **Access Control**           | Tier, TierAgentPool, TenantLimit, QuotaUsage                  |
| **AI Agents**                | Agent, AgentTemplate, AgentExecution, ExecutionLog            |
| **Task Management**          | Task, TaskAssignment, TaskComment                             |
| **Workflows**                | Workflow, WorkflowStep, WorkflowExecution                     |
| **Communication**            | Conversation, Message, Notification                           |
| **Data & Memory**            | MemoryEntry, MemoryVector                                     |
| **Integrations**             | CrmConnector, OAuthToken, ProvisioningConfig, ProvisioningJob |
| **Finance**                  | Invoice, Expense, BillingEvent, CostRecord, BudgetPolicy      |
| **Business**                 | Department, DepartmentTemplate, Goal, Project, Routine        |
| **Governance**               | GovernanceRule, ApprovalRequest                               |
| **Analytics**                | AnalyticsModel, AnalyticsFeature, TenantMetric                |
| **Audit**                    | AuditLog                                                      |

### Key Relationships

```
Tenant (1) ──┬── (N) User
            ├── (N) Agent
            ├── (N) Task
            ├── (N) Department
            ├── (N) Workflow
            ├── (N) Conversation
            ├── (N) Invoice
            └── (N) Project

User (N) ──┬── (N) Session
           └── (N) RefreshToken

Agent (N) ──┬── (N) Task
            └── (N) ExecutionLog

Tier (1) ──┬── (N) Tenant
           └── (N) TierAgentPool
```

### Database Configuration

| Environment | Database                 | Host                                                       |
| ----------- | ------------------------ | ---------------------------------------------------------- |
| Production  | Neon PostgreSQL          | ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech |
| Local Dev   | Contabo PostgreSQL 16.13 | localhost:15433 (SSH tunnel)                               |

---

## Module Architecture

### Core Backend Modules

| Module                  | Purpose                       | Key Components                                                         |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| **Auth**                | User authentication & JWT     | AuthService, TokenService, PasswordService, JwtStrategy, LocalStrategy |
| **Tenants**             | Multi-tenant management       | TenantsService, TenantRepository                                       |
| **Users**               | User CRUD & roles             | UsersService, UserRepository                                           |
| **Agents**              | AI agent management           | AgentsService, AgentRepository, AgentExecutionService                  |
| **Tasks**               | Task management               | TasksService, TasksRepository                                          |
| **Workflows**           | Workflow automation           | WorkflowsService, WorkflowExecutor                                     |
| **Chat**                | Real-time messaging           | ChatGateway, ChatService, ConversationRepository                       |
| **Analytics**           | Data analytics & ML           | AnalyticsService, ModelRunner, FeatureStore                            |
| **Connectors**          | CRM integrations              | ConnectorService, HubSpotAdapter, SalesforceAdapter, PipedriveAdapter  |
| **Finance**             | Billing & costs               | BillingService, InvoiceService, CostService                            |
| **Governance**          | Approvals & rules             | ApprovalsService, GovernanceRulesService                               |
| **Tools**               | Agent tools & capabilities    | ToolsService, StructuredToolRegistry, Built-in tools                   |
| **Orchestration**       | Task & workflow orchestration | OrchestrationService, TasksService, WorkflowsService                   |
| **Inbox**               | Notification inbox            | InboxService, InboxRepository                                          |
| **Goals**               | Goal management               | GoalsService, GoalRepository                                           |
| **Settings**            | Tenant settings               | SettingsService                                                        |
| **Audit**               | Audit logging                 | AuditService                                                           |
| **Health**              | System health                 | HealthController                                                       |
| **Security**            | Security middleware           | RateLimiter, CSRF, DataMasking                                         |
| **Events**              | WebSocket events              | EventsGateway                                                          |
| **Departments**         | Department management         | DepartmentsService                                                     |
| **DepartmentTemplates** | Department templates          | DeptTemplatesService                                                   |
| **Routines**            | Routine automation            | RoutinesService, RoutineRepository                                     |
| **Tiers**               | Tier/plan management          | TiersService, TierProvisioningService                                  |
| **Costs**               | Cost tracking                 | CostsService, CostRepository                                           |
| **Models**              | LLM model management          | LlmFactoryService, ModelClients                                        |
| **AI-Gateway**          | AI orchestration              | OpenclawGateway, LangsmithTracing                                      |

### Built-in Agent Tools

| Tool                | Functionality                             |
| ------------------- | ----------------------------------------- |
| Calculator          | Mathematical expressions                  |
| CalculatorEnhanced  | Advanced calculations with Zod validation |
| DatabaseQuery       | Read-only SQL queries via Prisma          |
| DocumentSummary     | Document summarization                    |
| EmailSend           | Email sending capability                  |
| HttpRequest         | HTTP API requests                         |
| HttpRequestEnhanced | HTTP with structured output               |
| WebSearch           | Web search capability                     |
| AgentMessaging      | Inter-agent communication                 |

---

## Authentication & Authorization

### JWT Configuration

| Parameter         | Value               |
| ----------------- | ------------------- |
| Algorithm         | HS256 (HMAC-SHA256) |
| Access Token TTL  | 15 minutes          |
| Refresh Token TTL | 7 days              |
| Secret            | JWT_SECRET env var  |

### Token Structure

```typescript
// JWT Payload
{
  sub: string; // User ID
  tenantId: string; // Tenant association
  role: UserRole; // Authorization level
  email: string; // User email
  iat: number; // Issued at
  exp: number; // Expiration
}
```

### Role-Based Access Control (RBAC)

| Role           | Description                             |
| -------------- | --------------------------------------- |
| SUPER_ADMIN    | Platform-wide admin (admin portal only) |
| PLATFORM_ADMIN | Platform management                     |
| OWNER          | Tenant owner                            |
| ADMIN          | Tenant admin                            |
| MANAGER        | Team manager                            |
| AGENT          | AI agent                                |
| VIEWER         | Read-only access                        |

### Authentication Flow

```
User Login
    ↓
[AuthService] Validate credentials
    ↓
[TokenService] Generate JWT (access + refresh)
    ↓
Client stores tokens
    ↓
All API requests include: Authorization: Bearer <accessToken>
    ↓
[JwtStrategy] Validate signature + check Redis blacklist
    ↓
[RolesGuard] Verify role permissions
    ↓
Request processed with authenticated context
```

### Logout Flow

```
User Logout
    ↓
[AuthService] Extract token from header
    ↓
[RedisService] Blacklist token (expires = token.exp)
    ↓
Subsequent requests with old token rejected
    ↓
Token auto-clears from Redis after TTL
```

---

## API Structure

### Base URLs

| Environment | Backend API                     | WebSocket                 |
| ----------- | ------------------------------- | ------------------------- |
| Development | http://localhost:3000/api       | ws://localhost:3000       |
| Production  | https://brain.neurecore.com/api | wss://brain.neurecore.com |

### Response Envelope Pattern

All API responses follow this format:

```typescript
// Non-paginated response
{
  "status": "success",
  "data": { /* actual response */ },
  "meta": { "timestamp": "ISO8601", "requestId": "uuid" }
}

// Paginated response
{
  "data": [],
  "total": number,
  "page": number,
  "limit": number,
  "totalPages": number
}
```

### Key API Endpoints

| Module     | Endpoint Prefix    | Operations                                |
| ---------- | ------------------ | ----------------------------------------- |
| Auth       | /api/v1/auth       | register, login, logout, refresh, profile |
| Tenants    | /api/v1/tenants    | CRUD, list, update                        |
| Users      | /api/v1/users      | CRUD, list, update, delete                |
| Agents     | /api/v1/agents     | CRUD, execute, list                       |
| Tasks      | /api/v1/tasks      | CRUD, assign, complete                    |
| Workflows  | /api/v1/workflows  | CRUD, execute, trigger                    |
| Chat       | /api/v1/chat       | send, history, conversations              |
| Analytics  | /api/v1/analytics  | metrics, forecast, anomaly                |
| Connectors | /api/v1/connectors | list, create, sync, oauth                 |
| Finance    | /api/v1/finance    | invoices, expenses, billing               |
| Governance | /api/v1/governance | rules, approvals                          |

### WebSocket Events

| Event                | Direction     | Description            |
| -------------------- | ------------- | ---------------------- |
| connected            | Server→Client | Connection established |
| ping/pong            | Both          | Keep-alive             |
| user:status          | Both          | Presence updates       |
| message:send/receive | Both          | Chat messages          |
| agent:update         | Server→Client | Agent state changes    |
| task:created         | Server→Client | New task notifications |

---

## Infrastructure

### Production Deployment

| Component       | Provider      | URL                             |
| --------------- | ------------- | ------------------------------- |
| Backend         | Contabo VPS   | brain.neurecore.com (port 3003) |
| Frontend Tenant | Vercel        | hq.neurecore.com                |
| Frontend Admin  | Vercel        | cc.neurecore.com                |
| Database        | Neon          | Cloud PostgreSQL                |
| Cache           | Upstash       | Cloud Redis                     |
| Web Server      | OpenLiteSpeed | VPS reverse proxy               |

### Local Development

| Component         | Port  | Connection             |
| ----------------- | ----- | ---------------------- |
| Backend           | 3000  | localhost              |
| Frontend Tenant   | 3001  | localhost              |
| Frontend Admin    | 3002  | localhost              |
| PostgreSQL        | 5432  | localhost (via Docker) |
| PostgreSQL (Prod) | 15433 | SSH tunnel to Contabo  |
| Redis             | 6379  | localhost (via Docker) |
| Redis (Prod)      | 16380 | SSH tunnel to Contabo  |

### Docker Configuration

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    ports: [5432:5432]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7
    ports: [6379:6379]

  pgvector:
    image: pgvector/pgvector:pg16
    ports: [5433:5432]
```

---

## Security

### Security Middleware

| Component          | Purpose                               |
| ------------------ | ------------------------------------- |
| Helmet             | HTTP security headers                 |
| CSRF Middleware    | Cross-site request forgery protection |
| Rate Limiter       | Request throttling (Redis-backed)     |
| Input Sanitization | XSS and injection prevention          |
| Data Masking       | Sensitive data obfuscation            |
| JWT Blacklist      | Token revocation                      |

### Password Security

| Parameter   | Value             |
| ----------- | ----------------- |
| Algorithm   | bcryptjs          |
| Salt Rounds | 10 (configurable) |
| Comparison  | Timing-safe       |

### Rate Limiting

| Tier    | Requests    |
| ------- | ----------- |
| Default | 100/minute  |
| Auth    | 10/minute   |
| API     | 1000/minute |

---

## Observability

### Logging

| Component   | Technology | Details                  |
| ----------- | ---------- | ------------------------ |
| Logger      | Pino       | Structured JSON logging  |
| HTTP Logger | pino-http  | Request/response logging |
| Format      | JSON       | Machine-parseable        |

### Tracing

| Component            | Technology                                |
| -------------------- | ----------------------------------------- |
| SDK                  | OpenTelemetry                             |
| Tracer               | @opentelemetry/sdk-node                   |
| Auto-instrumentation | @opentelemetry/auto-instrumentations-node |
| Exporter             | OTLP HTTP                                 |

### Monitoring

| Component        | Technology | Purpose             |
| ---------------- | ---------- | ------------------- |
| Error Tracking   | Sentry v10 | Error monitoring    |
| Performance      | Sentry     | Performance metrics |
| Release Tracking | Sentry     | Deployment tracking |

---

## Testing

### Test Types

| Type        | Framework        | Pattern                      |
| ----------- | ---------------- | ---------------------------- |
| Unit        | Jest             | \*.spec.ts files             |
| Integration | Jest             | \*.integration-spec.ts files |
| E2E         | Jest + Supertest | test/jest-e2e.json           |
| Manual      | Node.js scripts  | e2e-\*.mjs files             |

### Test Coverage Areas

- Authentication (register, login, logout, token refresh)
- Tenant CRUD operations
- User management
- Agent execution
- Task workflows
- API security (tenant isolation)
- WebSocket connections

---

## Environment Variables

### Backend Required

```bash
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://...

# Cache
REDIS_URL=redis://...

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# AI Providers
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
MINIMAX_API_KEY=...

# Observability
SENTRY_DSN=...
```

### Frontend Required

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=...
```

---

_Last Updated: April 4, 2026_
_Document Version: 1.0_
