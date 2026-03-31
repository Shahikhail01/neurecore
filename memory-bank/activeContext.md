# Active Context — NeureCore Development

## Last Updated

2026-03-31T10:15:00Z

## Architecture Overview

- **Production Backend**: NestJS on Contabo (PM2 id 24), port 3003, proxied via LiteSpeed → `brain.neurecore.com`
- **Production DB**: Neon (cloud PostgreSQL) — `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech`
- **Local Dev DB**: Contabo PostgreSQL 16 via SSH tunnel on `localhost:15433` → `neurecore_prod`
- **Local Dev Redis**: Contabo Redis 7 via SSH tunnel on `localhost:16380`
- **Docker**: No longer used for local dev — replaced by Contabo tunnel

### Contabo Server

- **IP**: `109.123.248.253`, SSH alias `contabo` (`~/.ssh/id_contabo`)
- **OS**: Ubuntu 24.04.3 LTS, 11GB RAM, 96GB disk
- **PostgreSQL**: 16.13 — `neurecore_prod` (29 tables) + `neurecore_dev` (36 tables)
- **Redis**: 7.0.15, password protected
- **LiteSpeed**: PID after last restart ~2309771, `brain.neurecore.com` VHost working
- **PM2**: Backend at id 24, using Neon DB URL

## Production Fixes Applied (March 31, 2026) ✅

### LiteSpeed 404 Root Cause — FIXED

- **Root cause**: Missing closing `}` brace in `virtualHost endtime.gec5.com {}` block
  in `/usr/local/lsws/conf/httpd_config.conf` (line ~388). All subsequent VHosts
  (including `brain.neurecore.com`) were parsed as nested inside endtime — invisible
  as top-level VHosts.
- **Fix**: `sed` inserted missing `}` after the `restrained 1` line.
- **VHost config** (`/usr/local/lsws/conf/vhosts/brain.neurecore.com/vhost.conf`):
  restored to CyberPanel format — `extprocessor nodeapi { type proxy; address 127.0.0.1:3003 }`
- **Result**: `brain.neurecore.com` returns HTTP 200 ✅

### Neon DB Schema Fixes — FIXED

- `tiers` table: added 13 missing columns (`slug`, `isDefault`, `monthlyPrice`, `yearlyPrice`,
  `currency`, `sortOrder`, `maxApiCalls`, `maxConversationMessages`, `maxFileSizeMB`,
  `allowCustomBranding`, `allowApiAccess`, `allowSso`, `allowAuditExport`)
- Renamed `maxStorageGb` → `maxStorageGB` (Prisma casing match)
- Set slugs: `starter` (isDefault=true, sortOrder=1), `professional`, `enterprise`
- `tenants.tierId`: set to `'tier_starter'` for NULL rows; column made NOT NULL with default

### Data Verified via Live API ✅

| Endpoint             | Count                                 |
| -------------------- | ------------------------------------- |
| Tenants              | 2 (Demo Tenant, Primary Tenant)       |
| Users                | 6                                     |
| Agent Templates      | 99 (platform)                         |
| Department Templates | 9                                     |
| Tiers                | 3 (Starter, Professional, Enterprise) |

## Current Running Services (Local Dev — March 31, 2026) ✅

| Service         | Port        | PID    | Database                            |
| --------------- | ----------- | ------ | ----------------------------------- |
| NestJS Backend  | 3000        | 97911  | Contabo `neurecore_prod` via tunnel |
| Frontend Tenant | 3001        | 102434 | —                                   |
| Frontend Admin  | 3002        | 101548 | —                                   |
| SSH Tunnel      | 15433/16380 | 85338  | Contabo PG + Redis                  |

Backend log confirmed: `Database connected` + `Redis connected` + `Redis ready`

## Environment Configuration (backend/.env — local dev)

- **NODE_ENV**: development
- **DATABASE_URL**: `postgresql://neurecore_app:...@127.0.0.1:15433/neurecore_prod?sslmode=prefer`
- **REDIS_URL**: `redis://:...@127.0.0.1:16380/0`
- **TENANT_FRONTEND_URL**: `http://localhost:3001`
- **ADMIN_FRONTEND_URL**: `http://localhost:3002`
- **ADDITIONAL_CORS_ORIGINS**: `http://localhost:3000,http://localhost:3001,http://localhost:3002,https://hq.neurecore.com,https://cc.neurecore.com`

## Superadmin Credentials

- **Email**: `mnpiracha@gmail.com`
- **Password**: `Admin@123!`
- **Script**: `backend/scripts/make-superadmin.mjs`

## SSH Tunnel Management

```bash
# Check tunnel status
ss -tlnp | grep -E '15433|16380'

# Start tunnel (if down)
ssh -f -N \
  -L 15433:localhost:5432 \
  -L 16380:localhost:6379 \
  root@109.123.248.253

# PID stored at: /tmp/neurecore_tunnel.pid (currently 85338)
```

## Recent DevOps Operations (March 31, 2026)

1. Fixed LiteSpeed httpd_config.conf missing `}` → `brain.neurecore.com` now 200
2. Fixed Neon `tiers` schema drift (13 columns added, slug populated)
3. Fixed `tenants.tierId` NULL → `'tier_starter'` for existing rows
4. Verified all production data via live API (brain.neurecore.com)
5. Updated `backend/.env` for local dev (NODE_ENV=development, localhost CORS)
6. Started full local dev stack: backend (3000), admin (3002), tenant (3001) — all connected to Contabo DBs via SSH tunnel
7. Created `docs/CONTABO_MIGRATION_PLAN.md` — comprehensive 6-phase plan
8. Added merge+delete `neurecore_dev`, local Docker cleanup to plan
9. UMB sync: Updated `progress.md` + `activeContext.md`

## Contabo Migration Plan Summary

**See**: `docs/CONTABO_MIGRATION_PLAN.md` for full details.

| Phase | Description                                            | Status  |
| ----- | ------------------------------------------------------ | ------- |
| 1     | Security hardening (Redis pass, pg_hba, firewall)      | ✅ Done |
| 2     | DB merge `neurecore_dev` → `neurecore_prod` + drop dev | ✅ Done |
| 3     | Backend config pointing to Contabo DBs                 | ✅ Done |
| 4     | Neon — dev branching only                              | ✅ Done |
| 5     | Production cutover (local)                             | ✅ Done |
| 6     | Full deployment (Contabo backend + Vercel frontends)   | Pending |

## SSH Tunnel (Local Access to Contabo)

**IMPORTANT**: Contabo PostgreSQL binds to 127.0.0.1 only (security hardening).

**Solution**: SSH tunnel for local development access

```bash
./backend/scripts/ssh-tunnel.sh start   # Start tunnel
./backend/scripts/ssh-tunnel.sh stop    # Stop tunnel
./backend/scripts/ssh-tunnel.sh status   # Check status
```

**Ports**:

- PostgreSQL: `localhost:15433` → `contabo:5432`
- Redis: `localhost:16380` → `contabo:6379`

## Deployment Architecture

### CURRENT SETUP (Phase 5a - March 30, 2026) ✅

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOCAL DEVELOPMENT MACHINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Backend    │  │  Tenant UI   │  │  Admin UI    │                 │
│  │  localhost   │  │  localhost   │  │  localhost   │                 │
│  │   :3000      │  │   :5173      │  │   :3001      │                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                  │                          │
│         └──────────────────┴──────────────────┘                          │
│                               │                                           │
│                    ┌──────────▼──────────┐                               │
│                    │     SSH Tunnel      │                               │
│                    │  127.0.0.1:15433 ───┼──► Contabo :5432 (PG)       │
│                    │  127.0.0.1:16380 ───┼──► Contabo :6379 (Redis)    │
│                    └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTABO SERVER (109.123.248.253)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16        Redis 7                                          │
│  neurecore_prod       (bound to 109.123.248.253)                       │
│  neurecore_dev        Password: kPzbcTiOQBWw...                        │
│                                                                         │
│  ✅ Vercel IPs allowed (76.76.0.0/16)                                   │
│  ✅ UFW ports open for Vercel                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### FUTURE SETUP (Phase 6 - Later)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL CLOUD                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                                    │
│  │  Tenant UI   │  │  Admin UI    │                                    │
│  │ hq.neurecore │  │ cc.neurecore  │                                    │
│  │   .com       │  │   .com        │                                    │
│  └──────┬───────┘  └──────┬───────┘                                    │
│         │                  │                                            │
│         └────────┬─────────┘                                            │
│                  │                                                      │
│                  ▼                                                      │
│         ┌───────────────┐                                               │
│         │   Backend     │  (Vercel Serverless Functions)                │
│         │  (Contabo)    │                                               │
│         └───────┬───────┘                                               │
│                 │                                                       │
└─────────────────┼─────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTABO SERVER (109.123.248.253)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16        Redis 7                                          │
│  neurecore_prod       (bound to 109.123.248.253)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Files

### Local Development (Current)

| Component | Config File                       | Connects To                          |
| --------- | --------------------------------- | ------------------------------------ |
| Backend   | `backend/.env.local-prod`         | SSH tunnel (127.0.0.1:15433, :16380) |
| Tenant UI | `frontend-tenant/.env.local-prod` | localhost:3000                       |
| Admin UI  | `frontend-admin/.env.local-prod`  | localhost:3000                       |

### Vercel Deployment (Future)

| Component | Config File           | Connects To                      |
| --------- | --------------------- | -------------------------------- |
| Backend   | `backend/.env.vercel` | Contabo direct (109.123.248.253) |
| Frontends | Vercel Dashboard      | Vercel Backend                   |

## Phase 5: Production Cutover — COMPLETED ✅ (March 30, 2026)

### Contabo Infrastructure Configuration

**PostgreSQL (Contabo):**

- ✅ pg_hba.conf: Vercel IPs (76.76.0.0/16) allowed
- ✅ UFW: Port 5432 open for 76.76.0.0/16
- ✅ DATABASE_URL: postgresql://neurecore_app:...@109.123.248.253:5432/neurecore_prod?sslmode=require

**Redis (Contabo):**

- ✅ Redis bind: Changed from 127.0.0.1 to 109.123.248.253
- ✅ UFW: Port 6379 open for 76.76.0.0/16
- ✅ REDIS_URL: redis://:kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=@109.123.248.253:6379/0

### Local Backend Test (via SSH Tunnel)

- ✅ Backend running on localhost:3000
- ✅ PostgreSQL connected (SSH tunnel: 127.0.0.1:15433 → Contabo:5432)
- ✅ Redis connected (SSH tunnel: 127.0.0.1:16380 → Contabo:6379)
- ✅ Health check: GET /api/v1/health → 200 OK

## Notes

- All services are ready for development
- SSH tunnel is REQUIRED for local backend to connect to Contabo DBs
- Docker containers to remain until Contabo is fully tested
- Phase 3 complete: Prisma schema synced to Contabo PostgreSQL ✓

## 🔴 ONGOING ISSUE: Prisma "Column Does Not Exist" Error

**Date**: 2026-03-31
**Status**: 🔴 UNRESOLVED - Requires further investigation

### Problem Summary

When frontend makes authenticated API requests, Prisma throws errors:

```
The column `agents.tierAgentPoolId` does not exist in the current database.
The column `tenants.tierId` does not exist in the current database.
```

### Verified Facts

| Check              | Result                  | Notes                                                                            |
| ------------------ | ----------------------- | -------------------------------------------------------------------------------- |
| DATABASE_URL       | ✅ Correct              | `postgresql://...@127.0.0.1:15433/neurecore_prod` (Contabo via SSH tunnel)       |
| psql direct query  | ✅ Columns EXIST        | Both `agents.tierAgentPoolId` and `tenants.tierId` verified via psql             |
| Schema PascalCase  | ✅ Restored             | `git checkout` restored original schema with `model Agent {}`, `model Tenant {}` |
| Prisma generate    | ✅ Success              | `pnpm exec prisma generate` completed without errors                             |
| TypeScript compile | ✅ 0 errors             | Backend compiles cleanly                                                         |
| Health endpoint    | ✅ 200 OK               | `GET /api/v1/health` works                                                       |
| Backend startup    | ✅ "Database connected" | All modules loaded successfully                                                  |

### Database Schema Verification (via psql)

```sql
-- agents table HAS tierAgentPoolId column:
tierAgentPoolId | text | nullable | FK → tier_agent_pools(id)

-- tenants table HAS tierId column:
tierId | text | NOT NULL | FK → tiers(id)
```

### Attempted Fixes (All Failed)

1. ✅ `git checkout backend/prisma/schema.prisma` - restored original schema
2. ✅ `pnpm exec prisma generate` - regenerated Prisma client
3. ✅ `rm -rf node_modules/.pnisma/client*` - cleared Prisma cache
4. ✅ `pkill -9` + restart - killed and restarted backend
5. ✅ `git checkout` restored PascalCase model names

### Root Cause Hypothesis

Prisma engine binary is caching the OLD introspected schema (with snake_case model names from `prisma db pull --force`). Despite regenerating the client, the binary may retain cached metadata.

### Next Steps (UNRESOLVED)

- [ ] Try `npx prisma migrate reset` or `npx prisma db push --force` to sync
- [ ] Check if Prisma engine binary needs explicit invalidation
- [ ] Consider removing and reinstalling `@prisma/client` package
- [ ] Investigate if this is a Prisma v5.22.0 bug with engine caching

### Files Modified

- `backend/prisma/schema.prisma` - restored via git checkout

## 🆕 NEXT PRIORITY: Agent Tool Connectors

**See**: `memory-bank/progress.md` → "NEXT: Agent Tool Connectors"

| Capability                         | Priority    |
| ---------------------------------- | ----------- |
| Email (SMTP/IMAP)                  | 🔴 Critical |
| Document Creation                  | 🔴 Critical |
| Spreadsheet                        | 🔴 Critical |
| File Storage                       | 🔴 Critical |
| Social APIs (Meta, LinkedIn, etc.) | 🔴 Critical |

This enables agents to function as true "digital employees".
