# Database Configuration & Migration History

**Last Updated:** 2026-07-22
**Status:** ✅ Migrated from Neon to Contabo local PostgreSQL

---

## Current Database

| Property | Value |
|----------|-------|
| Host | `127.0.0.1` (local Unix socket also works) |
| Port | `5432` (PostgreSQL 16 main cluster) |
| Database | `neurecore_prod` |
| User | `neurecore_app` |
| Auth | `trust` for `127.0.0.1/32`; `scram-sha-256` for remote |
| SSL | `disable` (local connection) |
| Cluster | `main` (pg_lsclusters) |
| Data directory | `/var/lib/postgresql/16/main` |

### Connection String

```
DATABASE_URL=postgresql://neurecore_app@127.0.0.1:5432/neurecore_prod?sslmode=disable&connection_limit=25&pool_timeout=20&connect_timeout=15
DATABASE_URL_UNPOOLED=postgresql://neurecore_app@127.0.0.1:5432/neurecore_prod?sslmode=disable&connection_limit=1&connect_timeout=15
```

No password is needed for localhost connections (pg_hba.conf trust). For remote access, the `neurecore_app` user uses `scram-sha-256`.

### Other Databases on Same Cluster

| Database | Owner | Purpose |
|----------|-------|---------|
| `neurecore` | `postgres` | Hermes entity tables owned by `neurecore` user |
| `neurecore_prod` | `neurecore_app` | **Production app data** (active) |
| `ecoearthshop` | `ecoearth` | Other project |
| `lifeosa` | `postgres` | Other project |
| `neurecore_audit_test` | `audit_tester` | Audit testing (on port 5433) |

### Audit-Test Cluster (Port 5433)

A separate PostgreSQL 16 cluster `audit-test` runs on port `5433` for isolated audit testing:
- Databases: `neurecore` (owner: `neurecore_app`), `neurecore_audit_test` (owner: `audit_tester`)
- This cluster is **not** used in production

---

## Previous Database (Neon — Decommissioned)

| Property | Value |
|----------|-------|
| Host | `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech` |
| Port | `5432` |
| Database | `neondb` |
| User | `neondb_owner` |
| SSL | `require` |
| Status | **☠️ Decommissioned** — compute quota exhausted, no longer in use |

All `.env` files have been updated to remove Neon references.

---

## Migration History

### 2026-07-22: Neon → Contabo Migration

**Problem:** Neon PostgreSQL compute quota was exhausted, causing the backend to return 503 (`Your account or project has exceeded the compute time quota`).

**Migration steps performed:**

1. **Identified Contabo local PostgreSQL** running on port 5432 (main cluster) and 5433 (audit-test cluster). The `neurecore_prod` database on port 5432 was empty and ready to use.

2. **Updated `.env` files** (all 4 files):
   - `backend/.env`
   - `backend/.env.production`
   - `backend/.env.development`
   - `backend/.env.test`
   
   Changed from `neondb_owner@ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require` to `neurecore_app@127.0.0.1:5432/neurecore_prod?sslmode=disable`.

3. **Applied all Prisma migrations.** Only 11 of 76 migrations were previously applied. The remaining 65 had to be forced through due to pre-existing schema inconsistencies:

   | Issue | Fix |
   |-------|-----|
   | `neurecore` user owned 29 enum types | Transferred ownership to `neurecore_app` |
   | `vector` extension not installed | Created via postgres superuser |
   | 5 EAOS enums had `PLACEHOLDER` values | Recreated enums with correct values, dropped old types |
   | Tables/constraints referenced by migrations didn't exist | Marked conflicting migrations as `--applied` after manual schema sync |
   | `prisma db push` enum conflicts | Fixed column defaults, dropped stale types |

4. **Final state:** All 76 migrations marked as applied in `_prisma_migrations`. Remaining schema gaps filled via `prisma db push`.

### DI Fixes Required After Migration

The backend failed to start after migration due to pre-existing code issues:

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `Nest can't resolve dependencies of TenantTemplateService (PrismaService, ?)` | `TemplateValidator[]` injected without token | Added `VALIDATORS_TOKEN` injection token with `useFactory` in module |
| `Nest can't resolve dependencies of IndustryComplianceService (CUSTOMER_REPOSITORY)` | `CustomersModule` didn't export `CUSTOMER_REPOSITORY` provider | Added `CUSTOMER_REPOSITORY` to `CustomersModule.exports` |

---

## Current Object Ownership

Production database `neurecore_prod` on port 5432:

| Owner | Objects |
|-------|---------|
| `neurecore_app` | All application tables (agents, tenants, users, projects, etc.), all enum types |
| `postgres` | (superuser, no application objects) |

The separate `neurecore` database on port 5432 contains Hermes entity tables owned by the `neurecore` user. This database is **not** actively used.

---

## Backups

Contabo local PostgreSQL should be backed up regularly:

```bash
# Manual backup
pg_dump -h 127.0.0.1 -p 5432 -U neurecore_app -Fc -b -v neurecore_prod > /opt/neurecore/_backups/neurecore_prod_$(date +%Y%m%d_%H%M%S).dump

# Auto-backup (cron suggestion)
# 0 3 * * * pg_dump -h 127.0.0.1 -p 5432 -U neurecore_app -Fc -b neurecore_prod > /opt/neurecore/_backups/neurecore_prod_$(date +\%Y\%m\%d).dump
```

### pg_hba.conf (relevant entries)

```
host    all             all             127.0.0.1/32            trust
host    neurecore_prod  neurecore_app   127.0.0.1/32            scram-sha-256
host    neurecore_prod  neurecore_app   ::1/128                 scram-sha-256
host    neurecore_prod  neurecore_app   109.123.248.253/32      scram-sha-256
host    neurecore_prod  neurecore_app   76.76.0.0/16            scram-sha-256
```

The generic `trust` rule for `127.0.0.1/32` matches before the specific `scram-sha-256` rules, so local connections require no password.

---

## PG Tuning (current)

| Parameter | Value |
|-----------|-------|
| `shared_buffers` | 128MB |
| `work_mem` | 4MB |
| `max_connections` | 100 |
| Disk usage | ~75% of 96GB |
| RAM free | ~7GB of 11GB |

---

## Rollback

If needed, revert to previous `.env` backup on Contabo:

```bash
ssh contabo 'cp /opt/neurecore/backend/.env.backup_* /opt/neurecore/backend/backend/.env && pm2 restart neurecore-backend'
```
