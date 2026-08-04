-- Phase 9 migration: Regional residency + drift observability
-- Source plan: §5.17.7, §5.2.2

CREATE TYPE "TenantRegion" AS ENUM (
  'US_EAST', 'US_WEST', 'EU_CENTRAL', 'EU_WEST',
  'ASIA_PACIFIC', 'ASIA_NORTHEAST', 'MIDDLE_EAST',
  'SOUTH_AMERICA', 'CANADA', 'AUSTRALIA', 'AFRICA'
);

CREATE TYPE "ResidencyEnforcementMode" AS ENUM ('SOFT', 'HARD');

CREATE TYPE "DriftOutcome" AS ENUM ('STABLE', 'DRIFTING', 'CRITICAL_DRIFT');

CREATE TABLE "tenant_region_configs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "region" "TenantRegion" NOT NULL,
  "enforcementMode" "ResidencyEnforcementMode" NOT NULL DEFAULT 'HARD',
  "overrides" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_region_configs_tenantId_region_key" UNIQUE ("tenantId", "region")
);
CREATE INDEX "tenant_region_configs_tenantId_region_idx" ON "tenant_region_configs"("tenantId", "region");

CREATE TABLE "drift_baselines" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "modelId" TEXT NOT NULL,
  "baseline" JSONB NOT NULL DEFAULT '{}',
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "drift_baselines_tenantId_modelId_recordedAt_idx" ON "drift_baselines"("tenantId", "modelId", "recordedAt");
CREATE INDEX "drift_baselines_tenantId_expiresAt_idx" ON "drift_baselines"("tenantId", "expiresAt");

CREATE TABLE "drift_evaluations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "modelId" TEXT NOT NULL,
  "outcome" "DriftOutcome" NOT NULL,
  "scores" JSONB NOT NULL DEFAULT '{}',
  "note" TEXT,
  "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "drift_evaluations_tenantId_modelId_ranAt_idx" ON "drift_evaluations"("tenantId", "modelId", "ranAt");
CREATE INDEX "drift_evaluations_tenantId_outcome_idx" ON "drift_evaluations"("tenantId", "outcome");
