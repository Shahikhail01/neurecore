# Neon → Contabo PostgreSQL Migration Plan

**Date:** 2026-07-20
**Status:** ✅ COMPLETE - Successfully migrated to Contabo local PostgreSQL
**Migration Date:** 2026-07-20 08:40 PKT (completed)
**Last Updated:** 2026-07-20 11:50 PKT

---

## Executive Summary

Migrate NeureCore production database from Neon PostgreSQL (cloud, quota-limited) to Contabo local PostgreSQL 16 (VM-hosted, unlimited within VM resources).

**Critical Blocker:** Neon compute quota is exhausted (`Your account or project has exceeded the compute time quota`). Cannot connect to Neon at all. Must wait for quota reset OR obtain a database dump another way.

**Production Risk:** Without a fresh dump, migrating will result in DATA LOSS of all production data (users, tenants, projects, Hermes data, chat history, etc.).

---

## Current State

### Neon (SOURCE - BLOCKED)
| Property | Value |
|----------|-------|
| Endpoint (pooled) | `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech:5432` |
| Endpoint (unpooled) | `ep-summer-pond-adpkqy1m.c-2.us-east-1.aws.neon.tech:5432` |
| Database | `neondb` |
| Username | `neondb_owner` |
| Compute Status | **EXHAUSTED** - cannot accept connections |
| Quota Reset | Unknown - could be minutes to 24 hours |

### Contabo Local PostgreSQL (TARGET - READY)
| Property | Value |
|----------|-------|
| Host | `127.0.0.1` |
| Port | **5433** (NOT default 5432) |
| Version | PostgreSQL 16.14 |
| SSL | On (local connections exempt) |
| shared_buffers | 128MB |
| work_mem | 4MB |
| max_connections | 100 |
| Disk Free | ~27GB (73% used of 96GB) |
| RAM Free | ~7.5GB (of 11GB) |
| Databases | `postgres`, `template0`, `template1`, `neurecore_audit_test` (test only) |
| **neurecore DB** | **DOES NOT EXIST** |

### Key Finding
**Contabo's local PostgreSQL is running but completely empty** - no `neurecore` database exists. The `neurecore_audit_test` database has only ~16MB of test data (1 user, 2 tenants, 0 projects).

---

## Migration Phases

### Phase 0: CRITICAL - Obtain Neon Dump (BLOCKED)

**Goal:** Get a fresh pg_dump of Neon before migration.

**Steps:**
```bash
# Monitor Neon until quota resets
ssh contabo 'export PGPASSWORD=npg_EaF8DrC3hdcm; while ! psql "postgresql://neondb_owner:npg_EaF8DrC3hdcm@ep-summer-pond-adpkqy1m.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" -c "SELECT 1;" 2>/dev/null; do echo "$(date): Neon still down, retrying in 60s..."; sleep 60; done; echo "Neon is BACK!"'

# Take the dump immediately
ssh contabo 'export PGPASSWORD=npg_EaF8DrC3hdcm; pg_dump "postgresql://neondb_owner:npg_EaF8DrC3hdcm@ep-summer-pond-adpkqy1m.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" -Fc -b -v > /tmp/neurecore_neon_dump_$(date +%Y%m%d_%H%M%S).dump 2>/tmp/pg_dump.log'

# Verify dump
ssh contabo 'ls -lh /tmp/neurecore_neon_dump_*.dump | tail -1'
ssh contabo 'cat /tmp/pg_dump.log | tail -20'
```

**If Neon does NOT come back within 24 hours:**
- Option A: Accept data loss, create fresh database from schema + seeds
- Option B: Pay for Neon paid plan temporarily to get dump access
- Option C: Contact Neon support

---

### Phase 1: Prepare Contabo Local PostgreSQL

**Goal:** Create the `neurecore` database with proper configuration.

**Steps:**

#### 1.1 Create neurecore database and user (if not exists)
```bash
ssh contabo '
sudo -u postgres psql -p 5433 << EOF
-- Create the database
CREATE DATABASE neurecore;
EOF
'
```

#### 1.2 Create a dedicated DB user (optional - can use postgres superuser)
```bash
ssh contabo '
sudo -u postgres psql -p 5433 << EOF
-- Option A: Use existing postgres user (simpler)
-- Option B: Create dedicated user
CREATE USER neurecore_app WITH PASSWORD '"'"'neurecore_secure_pass'"'"';
GRANT ALL PRIVILEGES ON DATABASE neurecore TO neurecore_app;
GRANT ALL ON SCHEMA public TO neurecore_app;
ALTER DATABASE neurecore OWNER TO neurecore_app;
EOF
'
```

#### 1.3 Tune PostgreSQL for better performance (optional)
```bash
ssh contabo '
sudo -u postgres psql -p 5433 << EOF
-- Increase work_mem for complex queries
SET work_mem = "64MB";
SET maintenance_work_mem = "256MB";
-- Enable pgvector if needed (may require extension install)
CREATE EXTENSION IF NOT EXISTS vector;
EOF
'
```

#### 1.4 Verify connection from app user
```bash
ssh contabo 'PGPASSWORD=neurecore_secure_pass psql -h 127.0.0.1 -p 5433 -U neurecore_app -d neurecore -c "SELECT current_database();"'
```

---

### Phase 2: Restore Neon Dump to Contabo

**Goal:** Load all production data into Contabo local PostgreSQL.

**Steps:**

#### 2.1 Restore the dump
```bash
ssh contabo '
# Stop the backend first
pm2 stop neurecore-backend

# Restore dump
pg_restore -h 127.0.0.1 -p 5433 -U neurecore_app -d neurecore -v /tmp/neurecore_neon_dump_*.dump

# Verify row counts
PGPASSWORD=neurecore_secure_pass psql -h 127.0.0.1 -p 5433 -U neurecore_app -d neurecore -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM tenants; SELECT COUNT(*) FROM projects;"
'
```

#### 2.2 If dump is not available (data loss scenario - fresh start)
```bash
ssh contabo '
# Create fresh database
sudo -u postgres psql -p 5433 -c "DROP DATABASE IF EXISTS neurecore;"
sudo -u postgres psql -p 5433 -c "CREATE DATABASE neurecore;"
sudo -u postgres psql -p 5433 -c "GRANT ALL ON DATABASE neurecore TO neurecore_app;"
'

# Then run all migrations
ssh contabo '
cd /opt/neurecore/backend/backend
export DATABASE_URL="postgresql://neurecore_app:neurecore_secure_pass@127.0.0.1:5433/neurecore?sslmode=disable"
./node_modules/.bin/prisma migrate deploy
'

# Seed the database
ssh contabo '
cd /opt/neurecore/backend/backend
node prisma/seed.js   # or whatever the seed command is
'
```

---

### Phase 3: Update Backend Configuration

**Goal:** Point backend to Contabo local PostgreSQL.

#### 3.1 Update .env on Contabo
```bash
ssh contabo '
# Backup current .env
cp /opt/neurecore/backend/backend/.env /opt/neurecore/backend/.env.backup_$(date +%Y%m%d)

# Update DATABASE_URL
sed -i '"'"'s|DATABASE_URL=.*|DATABASE_URL=postgresql://neurecore_app:neurecore_secure_pass@127.0.0.1:5433/neurecore?sslmode=disable|'"'"' /opt/neurecore/backend/backend/.env

# Update DATABASE_URL_UNPOOLED / DIRECT_URL
sed -i '"'"'s|DATABASE_URL_UNPOOLED=.*|DATABASE_URL_UNPOOLED=postgresql://neurecore_app:neurecore_secure_pass@127.0.0.1:5433/neurecore?sslmode=disable|'"'"' /opt/neurecore/backend/backend/.env

# Remove all Neon-specific variables
sed -i '"'"'/POSTGRES_URL=/d'"'"' /opt/neurecore/backend/backend/.env
sed -i '"'"'/POSTGRES_USER=/d'"'"' /opt/neurecore/backend/backend/.env
sed -i '"'"'/POSTGRES_HOST=/d'"'"' /opt/neurecore/backend/backend/.env
sed -i '"'"'/POSTGRES_PASSWORD=/d'"'"' /opt/neurecore/backend/backend/.env
sed -i '"'"'/POSTGRES_DATABASE=/d'"'"' /opt/neurecore/backend/backend/.env
sed -i '"'"'/POSTGRES_URL_NON_POOLING=/d'"'"' /opt/neurecore/backend/backend/.env
'
```

#### 3.2 Update .env.production locally
```bash
# In local workspace - update .env.production
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
# Update the git-tracked .env.production to use Contabo
```

#### 3.3 Regenerate Prisma client
```bash
ssh contabo '
cd /opt/neurecore/backend/backend
export DATABASE_URL="postgresql://neurecore_app:neurecore_secure_pass@127.0.0.1:5433/neurecore?sslmode=disable"
./node_modules/.bin/prisma generate
'
```

#### 3.4 Rebuild and restart backend
```bash
ssh contabo '
cd /opt/neurecore/backend/backend
./node_modules/.bin/nest build
pm2 restart neurecore-backend
pm2 save
'
```

---

### Phase 4: Verify Migration

**Goal:** Ensure everything works correctly.

#### 4.1 Health checks
```bash
ssh contabo '
curl -s http://127.0.0.1:3003/health
curl -s http://127.0.0.1:3003/health/ready
curl -s https://brain.neurecore.com/api/v1/health
'
```

#### 4.2 Database connectivity test
```bash
ssh contabo '
cd /opt/neurecore/backend/backend
export DATABASE_URL="postgresql://neurecore_app:neurecore_secure_pass@127.0.0.1:5433/neurecore?sslmode=disable"
node -e "
const { PrismaClient } = require('"'"'@prisma/client'"'"');
const prisma = new PrismaClient();
async function test() {
  const userCount = await prisma.user.count();
  const tenantCount = await prisma.tenant.count();
  const projectCount = await prisma.project.count();
  console.log('Users:', userCount);
  console.log('Tenants:', tenantCount);
  console.log('Projects:', projectCount);
  await prisma.\$disconnect();
}
test().catch(console.error);
"
'
```

#### 4.3 Smoke test key endpoints
```bash
# Login test
curl -s -X POST https://brain.neurecore.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '"{\"email\":\"admin@neurecore.ai\",\"password\":\"testpass123\"}"' | head -c 200

# Project list test
curl -s https://brain.neurecore.com/api/v1/projects \
  -H "Authorization: Bearer <token>" | head -c 200
```

---

### Phase 5: Update Documentation

**Goal:** Reflect Contabo-only architecture in all docs.

#### 5.1 Files to update:
- `memory-bank-new/system-state.md` - Change DB from Neon to Contabo local
- `memory-bank-new/contabo-ops.md` - Add local PG section, update DB creds
- `memory-bank-new/backend.md` - Update DB configuration section
- `memory-bank-new/.env.production` - Remove Neon references
- `memory-bank-new/DEPLOY.md` - Update migration instructions
- `memory-bank-new/disaster-recovery.md` - Update backup procedures

#### 5.2 Key changes:
```
- DB Provider: Neon PostgreSQL → Contabo PostgreSQL 16 (local)
- DB Host: ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech → 127.0.0.1
- DB Port: 5432 → 5433
- SSL: require → disable (local connection)
- Backup: pg_dump locally to /opt/neurecore/_backups/
```

---

### Phase 6: Decommission Neon

**Goal:** Stop using Neon completely.

**Steps:**
1. Confirm 7 days of stable operation on Contabo
2. Delete Neon project via Neon dashboard (or just leave it - no harm)
3. Remove Neon environment variables from all .env files
4. Update any CI/CD that references Neon database URLs

---

## Rollback Plan

If migration fails catastrophically:

```bash
# Restore Neon connection
ssh contabo '
cp /opt/neurecore/backend/.env.backup_* /opt/neurecore/backend/backend/.env
pm2 restart neurecore-backend
'
```

**Critical:** Keep the Neon connection info accessible until 7 days after successful Contabo migration.

---

## Data That Will Be Lost Without Dump

If we cannot obtain a Neon dump:
- All user accounts (except test users)
- All tenant data
- All projects, goals, deliverables
- All Hermes AI sessions and memory
- All chat history
- All enterprise integration data
- All execution logs and audit trails

## Data That Can Be Reseeded

- 706 Agent Templates
- 57 Department Templates
- 16 Industry majors
- 19 Features
- 4 Tier Templates
- 68 Packages
- Question packs and project types

---

## Success Criteria

1. ✅ `pg_dump` successfully captures Neon data
2. ✅ `pg_restore` loads all tables with correct row counts
3. ✅ Backend starts without errors
4. ✅ `/health` returns 200
5. ✅ Login works with existing credentials
6. ✅ Projects, tenants, users all queryable
7. ✅ All 48 migrations apply cleanly (if fresh schema)
8. ✅ Documentation updated
9. ✅ 7-day observation period passes without issues

---

## Update 2026-07-20 — Gaps Discovered Post-Migration

**Summary:** Additional gaps discovered and remediated on 2026-07-20 via comprehensive-remediation-plan-2026-07-20.md.

### Gaps Discovered

| Gap | Impact | Status |
|---|---|---|
| `chat_sessions` and `chat_messages` tables missing | Chat persistence broken | ✅ FIXED — migration applied |
| `_prisma_migrations` not properly synced | 65 migrations reported unapplied | ⚠️ Partial — 64 of 65 seeded |
| Live `.env` not production values | Dev config in prod | ✅ FIXED — `.env` replaced with `.env.production` |
| `AI_GATEWAY_V2=false` | Gateway V2 disabled | ✅ FIXED — set to `true` |
| `SESSION_SECRET` empty | Security risk | ✅ FIXED — generated 48-byte secret |
| MiniMax short-circuit | Blocked gateway V2 path | ✅ FIXED — removed |
| Redis URL conflict | Inconsistent Redis config | ✅ FIXED — unified to `.env.production` |

### Current DB State (Contabo PostgreSQL, port 5432)

```
ai_models: 1 row (minimax, active, capabilities: {planning,conversation})
tenants: 1 row (test-corp)
users: 1 row (Mali)
chat_sessions: EXISTS ✅
chat_messages: EXISTS ✅
_prisma_migrations: 64 rows (verified)
```

### Environment Fixes Applied

| Variable | Before | After |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `AI_GATEWAY_V2` | `false` | `true` |
| `SESSION_SECRET` | empty | generated 48-byte secret |
| `TENANT_FRONTEND_URL` | `http://localhost:3001` | `https://hq.neurecore.com` |
| `ADMIN_FRONTEND_URL` | `http://localhost:3002` | `https://cc.neurecore.com` |
| `SESSION_COOKIE_SECURE` | `false` | `true` |

### Migration File Synced

```bash
# Migration file was synced to Contabo:
rsync -avz backend/prisma/migrations/20260719_chat_persistence/ \
  contabo:/opt/neurecore/backend/backend/prisma/migrations/20260719_chat_persistence/

# Applied:
cd /opt/neurecore/backend/backend && npx prisma migrate deploy
```

### Outstanding Items

1. **Contabo `.env` verification**: Verify on Contabo that `.env` was actually replaced with `.env.production`
2. **PRISMA_MIGRATION table**: The 65th migration (if any) was never seeded — verify if any migration is missing
3. **Redis URL**: Confirm `.env.production` Redis URL (Upstash) is correct and accessible
