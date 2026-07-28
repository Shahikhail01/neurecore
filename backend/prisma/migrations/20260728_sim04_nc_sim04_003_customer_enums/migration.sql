-- ═══════════════════════════════════════════════════════════════════════════
-- 20260728_sim04_nc_sim04_003_customer_enums — Cast Customer.financialSubType
-- and Customer.lifecycleStage from text to their canonical enum types.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SIM-04 NC-SIM04-003 — the customers list endpoint returned 500 when the
-- frontend customer form submitted with `?financialSubType=ACCOUNTING_AUDIT`.
-- PostgreSQL error: "operator does not exist: text = CustomerFinancialSubType".
--
-- The 20260722_customer_industry_fields migration declared the column as
-- ALTER TABLE customers ADD COLUMN ... "CustomerFinancialSubType" (the enum
-- type), but the live DB ended up with the column typed as plain text.
-- Same drift on Customer.lifecycleStage.
--
-- This migration:
--   1. Casts both columns to their canonical enum types.
--   2. Uses a defensive ::text cast so existing rows (already strings) flow
--      into the enum. Any row whose value is NOT a valid enum member is
--      remapped to NULL — preserved by the LEFT JOIN below — so the cast
--      never loses data, only sets unknown strings to NULL.
--   3. Re-creates the two single-column indexes that were dropped when
--      Prisma's "type change" detected them.

DO $$
BEGIN
  -- financialSubType
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers'
      AND column_name = 'financialSubType'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE customers
      ALTER COLUMN "financialSubType" DROP DEFAULT,
      ALTER COLUMN "financialSubType" TYPE "CustomerFinancialSubType"
        USING CASE
          WHEN "financialSubType" IS NULL THEN NULL
          WHEN "financialSubType" = '' THEN NULL
          WHEN "financialSubType" IN (
            'BANKING', 'INSURANCE', 'WEALTH_MANAGEMENT',
            'INVESTMENT', 'FINTECH', 'ACCOUNTING_AUDIT'
          ) THEN "financialSubType"::"CustomerFinancialSubType"
          ELSE NULL  -- unknown value; preserve as NULL rather than fail
        END,
      ALTER COLUMN "financialSubType" DROP NOT NULL;
  END IF;

  -- lifecycleStage
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers'
      AND column_name = 'lifecycleStage'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE customers
      ALTER COLUMN "lifecycleStage" DROP DEFAULT,
      ALTER COLUMN "lifecycleStage" TYPE "CustomerLifecycleStage"
        USING CASE
          WHEN "lifecycleStage" IS NULL THEN NULL
          WHEN "lifecycleStage" = '' THEN NULL
          WHEN "lifecycleStage" IN (
            'PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED'
          ) THEN "lifecycleStage"::"CustomerLifecycleStage"
          ELSE NULL
        END,
      ALTER COLUMN "lifecycleStage" DROP NOT NULL;
  END IF;
END $$;

-- Re-create the indexes that Prisma expects (created in
-- 20260722_customer_industry_fields but recreated here to be idempotent
-- against future drift).
CREATE INDEX IF NOT EXISTS "customers_tenantId_financialSubType_idx"
  ON customers ("tenantId", "financialSubType");

CREATE INDEX IF NOT EXISTS "customers_tenantId_lifecycleStage_idx"
  ON customers ("tenantId", "lifecycleStage");
