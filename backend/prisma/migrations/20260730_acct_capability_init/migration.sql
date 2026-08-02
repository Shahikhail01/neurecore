-- ═══════════════════════════════════════════════════════════════════════════
-- 20260730_acct_capability_init — NC-ACCT-IMP-1 Accounting Capability
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Plan ref: NC-ACCT-IMP-1 §6 (Prisma schema additions).
--
-- Adds:
--   - 5 enums: AccountType, AccountNormalBalance, AccountingPeriodStatus,
--     AccountingDatasetKind, AccountingRole, AuditFindingSeverity,
--     AuditFindingStatus
--   - 8 models: ChartOfAccount, AccountingPeriod, UserAccountingRole,
--     JournalEntry, AccountingRecord, AccountingDataset, AccountingReport,
--     AuditFinding, OutboxMerkleRoot
--
-- All additive. No existing tables modified. Back-relations on Tenant and
-- User are added in the schema file (generated separately).
--
-- SoD constraint: a journal entry's `postingUserId` and `approvedById` MUST
-- differ. Enforced at DB level via CHECK constraint (Prisma cannot express
-- this; raw SQL added below). The constraint is added as NOT VALID so it
-- does not require scanning existing rows (none, this is initial install).

-- ─── Enums ───────────────────────────────────────────────────────────────

CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "AccountNormalBalance" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED', 'LOCKED');
CREATE TYPE "AccountingDatasetKind" AS ENUM (
  'INVENTORY_ITEM', 'PAYROLL_EMPLOYEE', 'PAYROLL_RUN', 'LEASE_CONTRACT',
  'FIXED_ASSET', 'BANK_ACCOUNT', 'BANK_TRANSACTION', 'INVOICE',
  'CUSTOMER_RECEIVABLE', 'FINANCIAL_STATEMENT', 'VENDOR_PAYABLE',
  'TAX_RETURN', 'FX_TRANSACTION'
);
CREATE TYPE "AccountingRole" AS ENUM (
  'VIEWER', 'PREPARER', 'POSTING', 'REVIEWER', 'CONTROLLER', 'CFO', 'AUDITOR'
);
CREATE TYPE "AuditFindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WAIVED');

-- ─── ChartOfAccount ──────────────────────────────────────────────────────

CREATE TABLE "chart_of_accounts" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "type"         "AccountType" NOT NULL,
  "normalBalance" "AccountNormalBalance" NOT NULL,
  "parentId"     TEXT REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  "currency"     TEXT NOT NULL DEFAULT 'USD',
  "isLeaf"       BOOLEAN NOT NULL DEFAULT true,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "description"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "chart_of_accounts_tenantId_code_key"
  ON "chart_of_accounts" ("tenantId", "code");
CREATE INDEX "chart_of_accounts_tenantId_type_idx"
  ON "chart_of_accounts" ("tenantId", "type");
CREATE INDEX "chart_of_accounts_tenantId_isActive_idx"
  ON "chart_of_accounts" ("tenantId", "isActive");
CREATE INDEX "chart_of_accounts_parentId_idx"
  ON "chart_of_accounts" ("parentId");

-- ─── AccountingPeriod ────────────────────────────────────────────────────

CREATE TABLE "accounting_periods" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "status"      "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "fiscalYear"  INTEGER NOT NULL,
  "closedAt"    TIMESTAMP(3),
  "closedById"  TEXT,
  "lockedAt"    TIMESTAMP(3),
  "lockedById"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "accounting_periods_tenantId_code_key"
  ON "accounting_periods" ("tenantId", "code");
CREATE INDEX "accounting_periods_tenantId_fiscalYear_idx"
  ON "accounting_periods" ("tenantId", "fiscalYear");
CREATE INDEX "accounting_periods_tenantId_status_idx"
  ON "accounting_periods" ("tenantId", "status");

-- ─── UserAccountingRole ──────────────────────────────────────────────────

CREATE TABLE "user_accounting_roles" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "userId"      TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"        "AccountingRole" NOT NULL,
  "grantedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedById" TEXT,
  "revokedAt"   TIMESTAMP(3)
);
CREATE UNIQUE INDEX "user_accounting_roles_tenantId_userId_role_key"
  ON "user_accounting_roles" ("tenantId", "userId", "role");
CREATE INDEX "user_accounting_roles_tenantId_userId_idx"
  ON "user_accounting_roles" ("tenantId", "userId");
CREATE INDEX "user_accounting_roles_tenantId_role_idx"
  ON "user_accounting_roles" ("tenantId", "role");

-- ─── JournalEntry ────────────────────────────────────────────────────────

CREATE TABLE "journal_entries" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "periodId"      TEXT NOT NULL REFERENCES "accounting_periods"("id"),
  "txnId"         TEXT NOT NULL,
  "txnDate"       DATE NOT NULL,
  "narration"     TEXT NOT NULL,
  "source"        TEXT NOT NULL DEFAULT 'manual',
  "postingUserId" TEXT NOT NULL,
  "approvalId"    TEXT,
  "approvedById"  TEXT,
  "approvedAt"    TIMESTAMP(3),
  "totalDebit"    DECIMAL(18,4) NOT NULL,
  "totalCredit"   DECIMAL(18,4) NOT NULL,
  "baseCurrency"  TEXT NOT NULL DEFAULT 'USD',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "journal_entries_tenantId_txnId_key"
  ON "journal_entries" ("tenantId", "txnId");
CREATE INDEX "journal_entries_tenantId_periodId_idx"
  ON "journal_entries" ("tenantId", "periodId");
CREATE INDEX "journal_entries_tenantId_txnDate_idx"
  ON "journal_entries" ("tenantId", "txnDate");
CREATE INDEX "journal_entries_tenantId_postingUserId_idx"
  ON "journal_entries" ("tenantId", "postingUserId");
CREATE INDEX "journal_entries_approvalId_idx"
  ON "journal_entries" ("approvalId");

-- SoD constraint: approvedById must differ from postingUserId when set.
-- We use a partial CHECK constraint that's evaluated only when approvedById
-- IS NOT NULL — i.e. once approval completes, the users must differ.
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_sod_check"
  CHECK ("approvedById" IS NULL OR "approvedById" <> "postingUserId");

-- ─── AccountingDataset ───────────────────────────────────────────────────

CREATE TABLE "accounting_datasets" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "scenarioId"      TEXT,
  "simulationRunId" TEXT,
  "kind"            "AccountingDatasetKind" NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "schemaVersion"   INTEGER NOT NULL DEFAULT 1,
  "rowCount"        INTEGER NOT NULL,
  "seedValue"       INTEGER,
  "generatedBy"     TEXT NOT NULL DEFAULT 'manual',
  "payload"         JSONB NOT NULL,
  "payloadUrl"      TEXT,
  "checksum"        TEXT NOT NULL,
  "approvedAt"      TIMESTAMP(3),
  "approvedById"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "accounting_datasets_tenantId_name_key"
  ON "accounting_datasets" ("tenantId", "name");
CREATE INDEX "accounting_datasets_tenantId_kind_idx"
  ON "accounting_datasets" ("tenantId", "kind");
CREATE INDEX "accounting_datasets_tenantId_simulationRunId_idx"
  ON "accounting_datasets" ("tenantId", "simulationRunId");


-- ─── AccountingRecord ─────────────────────────────────────────────────────

CREATE TABLE "accounting_records" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"       TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
  "accountId"      TEXT NOT NULL REFERENCES "chart_of_accounts"("id"),
  "datasetId"      TEXT REFERENCES "accounting_datasets"("id") ON DELETE SET NULL,
  "amount"         DECIMAL(18,4) NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'USD',
  "fxRate"         DECIMAL(12,8),
  "baseCurrency"   TEXT,
  "baseAmount"     DECIMAL(18,4),
  "postingType"    TEXT NOT NULL,
  "counterparty"   TEXT,
  "narration"      TEXT,
  "tags"           JSONB NOT NULL DEFAULT '[]',
  "sourceRef"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_records_posting_type_check"
    CHECK ("postingType" IN ('DEBIT', 'CREDIT'))
);
CREATE INDEX "accounting_records_tenantId_journalEntryId_idx"
  ON "accounting_records" ("tenantId", "journalEntryId");
CREATE INDEX "accounting_records_tenantId_accountId_idx"
  ON "accounting_records" ("tenantId", "accountId");
CREATE INDEX "accounting_records_tenantId_datasetId_idx"
  ON "accounting_records" ("tenantId", "datasetId");
CREATE INDEX "accounting_records_tenantId_postingType_idx"
  ON "accounting_records" ("tenantId", "postingType");

-- ─── AccountingReport ────────────────────────────────────────────────────

CREATE TABLE "accounting_reports" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "periodId"        TEXT REFERENCES "accounting_periods"("id"),
  "reportType"      TEXT NOT NULL,
  "asOf"            DATE,
  "periodStart"     DATE,
  "periodEnd"       DATE,
  "baseCurrency"    TEXT NOT NULL DEFAULT 'USD',
  "computedBy"      TEXT NOT NULL DEFAULT 'manual',
  "inputs"          JSONB NOT NULL DEFAULT '{}',
  "results"         JSONB NOT NULL DEFAULT '{}',
  "beancountExport" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "accounting_reports_tenantId_reportType_idx"
  ON "accounting_reports" ("tenantId", "reportType");
CREATE INDEX "accounting_reports_tenantId_periodId_idx"
  ON "accounting_reports" ("tenantId", "periodId");
CREATE INDEX "accounting_reports_tenantId_asOf_idx"
  ON "accounting_reports" ("tenantId", "asOf");

-- ─── AuditFinding ────────────────────────────────────────────────────────

CREATE TABLE "audit_findings" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "scenarioId"      TEXT,
  "simulationRunId" TEXT,
  "severity"        "AuditFindingSeverity" NOT NULL,
  "category"        TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "evidence"        JSONB NOT NULL DEFAULT '{}',
  "recommendation"  TEXT,
  "status"          "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt"      TIMESTAMP(3),
  "resolvedById"    TEXT,
  "resolvedNote"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_findings_tenantId_severity_idx"
  ON "audit_findings" ("tenantId", "severity");
CREATE INDEX "audit_findings_tenantId_status_idx"
  ON "audit_findings" ("tenantId", "status");
CREATE INDEX "audit_findings_tenantId_simulationRunId_idx"
  ON "audit_findings" ("tenantId", "simulationRunId");

-- ─── OutboxMerkleRoot (tamper-evidence) ───────────────────────────────────

CREATE TABLE "outbox_merkle_roots" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "rootHash"      TEXT NOT NULL UNIQUE,
  "prevRootHash"  TEXT,
  "leafCount"     INTEGER NOT NULL,
  "firstEventId"  TEXT,
  "lastEventId"   TEXT,
  "periodStart"   TIMESTAMP(3) NOT NULL,
  "periodEnd"     TIMESTAMP(3) NOT NULL,
  "computedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "outbox_merkle_roots_tenantId_computedAt_idx"
  ON "outbox_merkle_roots" ("tenantId", "computedAt");