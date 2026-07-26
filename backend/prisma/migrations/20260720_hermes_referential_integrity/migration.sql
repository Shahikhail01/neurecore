-- Phase 1.3: Hermes tenant/user referential integrity
-- Adds missing FK constraints that the Prisma schema defines but the
-- live PostgreSQL instance never received because the schema evolved
-- incrementally after the Contabo baseline migration.

ALTER TABLE "HermesAgent"
  ADD CONSTRAINT "HermesAgent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES tenants(id)
  ON UPDATE CASCADE ON DELETE CASCADE
  NOT VALID;

ALTER TABLE "HermesSession"
  ADD CONSTRAINT "HermesSession_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES tenants(id)
  ON UPDATE CASCADE ON DELETE CASCADE
  NOT VALID;

ALTER TABLE "HermesSession"
  ADD CONSTRAINT "HermesSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES users(id)
  ON UPDATE CASCADE ON DELETE CASCADE
  NOT VALID;

ALTER TABLE "HermesMemoryEntry"
  ADD CONSTRAINT "HermesMemoryEntry_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES tenants(id)
  ON UPDATE CASCADE ON DELETE CASCADE
  NOT VALID;
