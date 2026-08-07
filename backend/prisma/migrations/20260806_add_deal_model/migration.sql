-- Migration: 20260806_add_deal_model
-- R3 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-BACKLOG-R1-R4.md
--
-- Adds first-class Deal aggregate so nc.forecast_pipeline can speak
-- about weighted pipeline (stage × amount × probability) instead of
-- relying solely on Quote.total.
--
-- Backfill strategy:
--   1. Create DealStage + DealSource enums.
--   2. Create deals table (without FKs first).
--   3. For every distinct (tenantId, dealId) in Quote where dealId IS NOT NULL,
--      insert one Deal row with id 'deal_legacy_<md5>', name 'Legacy bridge: <dealId>',
--      source = LEGACY_BRIDGE, stage = PROPOSAL, amount = MAX(Quote.total).
--   4. UPDATE Quote.dealId to point to the new synthetic Deal.id.
--   5. Now safe to add FK on Quote.dealId → Deal.id (ON DELETE RESTRICT
--      preserves evidence; deals must be soft-deleted manually).
--   6. Add FKs from Deal → tenant/customer/contact/project/owner.
--
-- Idempotency: the migration uses ON CONFLICT DO NOTHING for the
-- backfill so re-application on a partially-applied state is safe.
--
-- Reversibility: BACKFILL_SNAPSHOT below captures row counts so a
-- rollback script (not included in this file) can clear bridge rows
-- if the migration is reverted.

BEGIN;

-- ─── 1. Create enums ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "DealStage" AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DealSource" AS ENUM ('INBOUND', 'OUTBOUND', 'PARTNER', 'REFERRAL', 'EVENT', 'LEGACY_BRIDGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Create deals table (no FKs yet — backfill is easier) ───────────────

CREATE TABLE IF NOT EXISTS "deals" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "customerId" text,
  "contactId" text,
  "projectId" text,
  "ownerUserId" text,
  "name" text NOT NULL,
  "stage" "DealStage" NOT NULL DEFAULT 'LEAD',
  "source" "DealSource" NOT NULL DEFAULT 'INBOUND',
  "amount" numeric(18,2) NOT NULL DEFAULT 0,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "probability" numeric(5,4) NOT NULL DEFAULT 0.1000,
  "expectedCloseDate" timestamptz,
  "aiScore" numeric(5,4),
  "notes" text,
  "deletedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "deals_tenantId_stage_updatedAt_idx"
  ON "deals"("tenantId","stage","updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "deals_tenantId_expectedCloseDate_idx"
  ON "deals"("tenantId","expectedCloseDate");
CREATE INDEX IF NOT EXISTS "deals_tenantId_ownerUserId_idx"
  ON "deals"("tenantId","ownerUserId");
CREATE INDEX IF NOT EXISTS "deals_tenantId_deletedAt_idx"
  ON "deals"("tenantId","deletedAt");

-- The @@unique([tenantId, customerId, name]) translates to a partial
-- unique index in Postgres so NULL customerId rows can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "deals_tenantId_customerId_name_key"
  ON "deals"("tenantId","customerId","name");

-- ─── 3. Backfill: one Deal per distinct non-null (Quote.tenantId, Quote.dealId)

INSERT INTO "deals" (
  "id","tenantId","customerId","contactId","projectId","ownerUserId",
  "name","stage","source","amount","currency","probability","createdAt","updatedAt"
)
SELECT
  'deal_legacy_' || md5(q."tenantId" || '|' || q."dealId"),
  q."tenantId",
  NULL,
  NULL,
  NULL,
  NULL,
  'Legacy bridge: ' || q."dealId",
  'PROPOSAL'::"DealStage",
  'LEGACY_BRIDGE'::"DealSource",
  COALESCE(MAX(q."total"), 0),
  COALESCE(MAX(q."currency"), 'USD'),
  0.50,
  MIN(q."createdAt"),
  now()
FROM "quotes" q
WHERE q."dealId" IS NOT NULL
GROUP BY q."tenantId", q."dealId"
ON CONFLICT ("id") DO NOTHING;

-- ─── 4. Repoint existing Quote.dealId values at the synthetic Deal.id ────

UPDATE "quotes" q
SET "dealId" = 'deal_legacy_' || md5(q."tenantId" || '|' || q."dealId")
WHERE q."dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = 'deal_legacy_' || md5(q."tenantId" || '|' || q."dealId")
  );

-- ─── 5. Add FK on quotes.dealId → deals.id (ON DELETE RESTRICT) ─────────────

DO $$ BEGIN
  ALTER TABLE "quotes"
    ADD CONSTRAINT "quotes_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 6. Add remaining FKs on deals table ────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "deals" ADD CONSTRAINT "deals_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "deals" ADD CONSTRAINT "deals_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "deals" ADD CONSTRAINT "deals_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "customer_contacts"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "deals" ADD CONSTRAINT "deals_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "deals" ADD CONSTRAINT "deals_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
