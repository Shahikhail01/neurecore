-- Migration: 20260726_g2_enum_column_casts
-- Purpose: Move live columns from legacy AWL enum type names to the
-- Prisma-generated AWL enum names after both enum types exist.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects'
      AND column_name = 'executionEngineVersion'
      AND udt_name = 'ExecutionEngine'
  ) THEN
    ALTER TABLE "projects"
      ALTER COLUMN "executionEngineVersion" DROP DEFAULT,
      ALTER COLUMN "executionEngineVersion" TYPE "AwlExecutionEngine"
        USING "executionEngineVersion"::text::"AwlExecutionEngine",
      ALTER COLUMN "executionEngineVersion" SET DEFAULT 'legacy'::"AwlExecutionEngine";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agents'
      AND column_name = 'availability'
      AND udt_name = 'AgentAvailability'
  ) THEN
    ALTER TABLE "agents"
      ALTER COLUMN "availability" DROP DEFAULT,
      ALTER COLUMN "availability" TYPE "AwlAgentAvailability"
        USING "availability"::text::"AwlAgentAvailability",
      ALTER COLUMN "availability" SET DEFAULT 'AVAILABLE'::"AwlAgentAvailability";
  END IF;
END $$;
