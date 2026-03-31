# Tech Context — NeureCore Gold Stack

## Last Updated: March 31, 2026

## Technology Stack

### Backend Runtime & Framework

- **Runtime**: Node.js 20+ (via NestJS CLI)
- **Framework**: NestJS 11.0.1
  - HTTP decorators (@Controller, @Get, @Post, etc.)
  - WebSocket support (@WebSocketGateway via Socket.IO)
  - Dependency injection container
  - Module-based architecture
  - Guards, Filters, Interceptors, Pipes

### HTTP & WebSocket

- **HTTP Server**: Express.js (via @nestjs/platform-express)
- **WebSocket**: Socket.IO 4.8.1 (via @nestjs/websockets)
- **Authentication**: Passport.js + JWT

### Database & ORM (Current State — March 31, 2026)

#### Production (brain.neurecore.com / Neon)

- **DB**: Neon PostgreSQL (cloud) — `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech`
- **Database**: `neondb` — 34 tables, all migrations applied
- **URL**: `postgresql://neondb_owner:npg_EaF8DrC3hdcm@.../neondb?sslmode=require`
- **Schema fixes applied**: `tiers` table 13 columns added, `tenants.tierId` NULLs fixed

#### Local Dev (via SSH tunnel to Contabo)

- **DB**: Contabo PostgreSQL 16.13 — `neurecore_prod` (29 tables, older schema)
- **Tunnel ports**: `localhost:15433` → Contabo `5432`
- **Credentials**: `neurecore_app` / `NeureCoreApp2026!SecureDBPass`
- **Note**: May need `npx prisma migrate deploy` to bring up to 34 tables

#### ORM

- **Prisma 5.22.0** — schema at `backend/prisma/schema.prisma`
- **Key models**: Tenant, User, Agent, AgentTemplate, Department, DepartmentTemplate, Tier,
  TierAgentPool, Conversation, Message, Integration, Goal, Project, etc.

### Cache Layer

#### Production

- **Upstash Redis** (cloud) — used by Contabo PM2 backend process

#### Local Dev (via SSH tunnel to Contabo)

- **Contabo Redis 7.0.15** — `localhost:16380` → Contabo `6379`
- **Password**: `kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=`
- **Client libs**: ioredis 5.9.3

### Infrastructure

#### Contabo VPS (109.123.248.253)

- **Web server**: OpenLiteSpeed — reverse proxies `brain.neurecore.com` → NestJS port 3003
- **Process manager**: PM2 — backend at id 24
- **SSH**: `ssh contabo` (`~/.ssh/id_contabo`)
- **Key config**: `/usr/local/lsws/conf/httpd_config.conf` (fixed March 31: missing `}`)
- **VHost config**: `/usr/local/lsws/conf/vhosts/brain.neurecore.com/vhost.conf`
- **Backup**: `/usr/local/lsws/conf/httpd_config.conf.bak2`

#### Vercel (Frontend)

- `frontend-admin` → `cc.neurecore.com` (Admin Portal)
- `frontend-tenant` → `hq.neurecore.com` (Tenant Portal)
- DNS: CNAME → `cname.vercel-dns.com`

### Authentication & Authorization

- **JWT (JSON Web Tokens)**
  - Signing: HS256 (HMAC-SHA256)
  - Secret: JWT_SECRET env var
  - Access Token TTL: 15 minutes
  - Refresh Token: 7 days
  - Strategy: Passport + @nestjs/jwt

- **Password Security**
  - Algorithm: bcryptjs (2.4.3)
  - Salt rounds: 10 (configurable)
  - Comparison: Timing-safe

### Frontend Frameworks

- **Runtime**: Node.js 20+
- **React**: 19 (via Next.js)
- **Next.js**: 15 (App Router)
  - Streaming SSR support
  - API routes (/api/\*)
  - Image optimization
  - Environment variable loading

### Frontend UI & Styling

- **CSS Framework**: Tailwind CSS 4
- **Component Library**: Radix UI v1
  - Dialog, Dropdown, Tooltip, etc.
- **Animation**: Framer Motion (12.34.2)
- **Data Visualization**: Recharts (3.7.0)
- **Charts/Graphs**: ReactFlow (11.11.4) for node-based workflows
- **Command Palette**: cmdk (1.1.1)
- **Date Utilities**: date-fns (4.1.0)

### AI & Language Models

- **LangChain**: 0.3.0
  - Core (langchain): Agent/chain framework
  - OpenAI (langchain/openai): GPT integration
  - LangChain/core: Base interfaces/components

- **OpenAI SDK**: 4.77.0
  - Direct API access
  - GPT-4, GPT-3.5-turbo support
  - Streaming responses

### Observability & Tracing

- **OpenTelemetry**: Full instrumentation
  - SDK Node (0.205.0)
  - Auto instrumentations for Node (0.62.0)
  - Resources & semantic conventions
  - Exporters: OTLP HTTP tracer

- **Logging**: Pino (9.14.0)
  - Structured JSON logging
  - HTTP request logging via pino-http (10.5.0)
  - Performance optimized

- **Monitoring**: Sentry (v10)
  - Next.js integration (@sentry/nextjs)
  - Error tracking
  - Performance monitoring
  - Release tracking

### Security & Validation

- **Helmet**: 8.1.0 (HTTP headers hardening)
- **class-validator**: 0.14.1 (DTO validation decorators)
- **class-transformer**: 0.5.1 (DTO transformation)
- **bcryptjs**: 2.4.3 (password hashing)
- **uuid**: 11.1.0 (unique identifiers)
- **Throttler**: @nestjs/throttler (rate limiting)

### Testing Frameworks

- **Jest**: 30.0.0
  - Unit tests (\*.spec.ts)
  - Integration tests (\*.integration-spec.ts)
  - E2E tests (test/jest-e2e.json)
- **Supertest**: 7.0.0 (HTTP assertions)
- **Testing Library**: (implicit with Jest)

### Development Tools

- **TypeScript**: 5.7.3
  - Target: ES2020 (modern Node.js)
  - Strict mode enabled
  - Path aliases (~, @)
  - tsconfig-paths for runtime resolution

- **Linting & Formatting**
  - ESLint: 9.18.0 (with TypeScript support)
  - Prettier: 3.4.2 (code formatting)
  - @typescript-eslint/eslint-plugin: 8.20.0

- **Bundler**: NestJS CLI (internal)
  - Compilation: tsc
  - Watching: ts-loader

### Docker & Deployment

- **Docker**: Multi-stage builds
  - Base: node:20-alpine
  - Stages: Builder → Production
  - Benefits: Smaller image size, faster pulls

- **Docker Compose**: 3.8 schema
  - Services: postgres, pgvector, redis
  - Health checks: Built-in for all services
  - Volumes: Named volumes for persistence
  - Networks: Default bridge network

- **Production Hosting**
  - Vercel (frontends & edge functions)
  - Self-hosted VPS or AWS/Heroku (backend)
  - Postgres: Managed (AWS RDS, Railway, etc.)
  - Redis: Managed (Upstash, AWS ElastiCache, etc.)

## Environment Variables

### Backend (.env)

```
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://neurecore:password@localhost:5432/neurecore_dev

# Vector Store
VECTOR_DB_URL=postgresql://neurecore:password@localhost:5433/neurecore_vectors

# Cache
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# OpenAI
OPENAI_API_KEY=sk-...

# Sentry (optional)
SENTRY_DSN=...
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=...

# Application
API_BASE_URL=http://localhost:3000
FRONTEND_BASE_URL=http://localhost:3001
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=...
```

## Performance Considerations

- **Database**: Indexes on tenantId, userId, and foreign keys
- **Caching**: Redis for sessions, token blacklist, rate limiting
- **Compression**: gzip via Helmet
- **Rate Limiting**: @nestjs/throttler with Redis backend
- **Connection Pooling**: Prisma connection pool (tunable)
- **Vector Search**: pgvector for efficient similarity queries

## Architecture Patterns Used

- **Dependency Injection**: NestJS IoC container
- **Repository Pattern**: Services abstract Prisma queries
- **Strategy Pattern**: Passport strategies for different auth flows
- **Guard Pattern**: Auth and role guards on routes
- **Decorator Pattern**: Custom decorators for tenant context
- **Observer Pattern**: Socket.IO event emitters
