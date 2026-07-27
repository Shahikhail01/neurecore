-- Phase 6 — Human Review, Revision, and Lifecycle
-- Plan §8 (NC-AWL-IMP-1 v1.1)
--
-- Adds:
--   1. LifecycleWaiver model for guarded stage transitions (§8.2)
--   2. Enum LifecycleWaiverScope (PROJECT_STAGE, PROJECT_COMPLETION)
--   3. Project.stageVersion for optimistic concurrency on stage transitions
--      (defense against two operators racing the same stage advance)
--   4. Evidence immutability: a trigger that rejects UPDATE and DELETE on
--      evidence_artifacts. Plan §8.1: "approval cannot rewrite evidence".

ALTER TABLE "projects" ADD COLUMN "stageVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "LifecycleWaiverScope" AS ENUM ('PROJECT_STAGE', 'PROJECT_COMPLETION');

CREATE TABLE "lifecycle_waivers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "scope" "LifecycleWaiverScope" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fromStage" TEXT NOT NULL,
  "toStage" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "waivedByActorId" TEXT NOT NULL,
  "waivedByActorType" TEXT NOT NULL DEFAULT 'HUMAN',
  "guardFailureReason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "lifecycle_waivers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX "lifecycle_waivers_tenantId_scope_idx"
  ON "lifecycle_waivers"("tenantId", "scope");

CREATE INDEX "lifecycle_waivers_tenantId_entityType_entityId_idx"
  ON "lifecycle_waivers"("tenantId", "entityType", "entityId");

CREATE INDEX "lifecycle_waivers_occurredAt_idx"
  ON "lifecycle_waivers"("occurredAt");

-- Evidence immutability: a Phase 6 invariant from plan §8.1 / §14.2
-- ("Worker retry cannot overwrite approved artifact", "Revision never mutates
-- prior attempt evidence"). The trigger raises an exception on any UPDATE or
-- DELETE of an evidence_artifacts row, ensuring the only legal mutation is
-- INSERT. Worker retries and revision cycles that attempt to rewrite the
-- checksum, storageRef, or any other field will fail at the database boundary.

CREATE OR REPLACE FUNCTION evidence_artifacts_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'EVIDENCE_ARTIFACT_IMMUTABLE: evidence_artifacts rows cannot be updated or deleted (plan §8.1, §14.2)'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS evidence_artifacts_no_update ON "evidence_artifacts";
CREATE TRIGGER evidence_artifacts_no_update
  BEFORE UPDATE ON "evidence_artifacts"
  FOR EACH ROW
  EXECUTE FUNCTION evidence_artifacts_immutable();

DROP TRIGGER IF EXISTS evidence_artifacts_no_delete ON "evidence_artifacts";
CREATE TRIGGER evidence_artifacts_no_delete
  BEFORE DELETE ON "evidence_artifacts"
  FOR EACH ROW
  EXECUTE FUNCTION evidence_artifacts_immutable();

