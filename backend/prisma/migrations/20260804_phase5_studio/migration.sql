-- Phase 5 migration: Business Studio no-code authoring surface
-- Source plan: creatio-ai-parity-implementation-plan-v2.md §5.13

CREATE TYPE "StudioAppStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');
CREATE TYPE "StudioPageKind" AS ENUM ('LIST', 'DETAIL', 'FORM', 'DASHBOARD', 'CUSTOM');
CREATE TYPE "StudioProcessKind" AS ENUM ('WORKFLOW', 'BUSINESS_PROCESS', 'CASE', 'AI_WORKFLOW');
CREATE TYPE "StudioComponentOrigin" AS ENUM ('PREDEFINED', 'TENANT', 'COMMUNITY');
CREATE TYPE "StudioDeploymentKind" AS ENUM ('DEV_TO_STAGING', 'STAGING_TO_PRODUCTION', 'ROLLBACK');
CREATE TYPE "StudioDeploymentStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "studio_apps" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "status" "StudioAppStatus" NOT NULL DEFAULT 'DRAFT',
  "manifest" JSONB NOT NULL DEFAULT '{}',
  "version" TEXT NOT NULL DEFAULT '0.1.0',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "studio_apps_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "studio_apps_tenantId_status_idx" ON "studio_apps"("tenantId", "status");

CREATE TABLE "studio_pages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "appId" TEXT NOT NULL REFERENCES "studio_apps"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind" "StudioPageKind" NOT NULL DEFAULT 'CUSTOM',
  "layout" JSONB NOT NULL DEFAULT '{}',
  "componentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_pages_appId_slug_key" UNIQUE ("appId", "slug")
);
CREATE INDEX "studio_pages_tenantId_idx" ON "studio_pages"("tenantId");

CREATE TABLE "studio_processes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "appId" TEXT NOT NULL REFERENCES "studio_apps"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind" "StudioProcessKind" NOT NULL DEFAULT 'WORKFLOW',
  "definition" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_processes_appId_slug_key" UNIQUE ("appId", "slug")
);
CREATE INDEX "studio_processes_tenantId_idx" ON "studio_processes"("tenantId");

CREATE TABLE "studio_data_models" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "appId" TEXT NOT NULL REFERENCES "studio_apps"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_data_models_appId_slug_key" UNIQUE ("appId", "slug")
);
CREATE INDEX "studio_data_models_tenantId_idx" ON "studio_data_models"("tenantId");

CREATE TABLE "studio_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "appId" TEXT NOT NULL REFERENCES "studio_apps"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "layout" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_reports_appId_slug_key" UNIQUE ("appId", "slug")
);
CREATE INDEX "studio_reports_tenantId_idx" ON "studio_reports"("tenantId");

CREATE TABLE "studio_components" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "appId" TEXT REFERENCES "studio_apps"("id") ON DELETE SET NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "origin" "StudioComponentOrigin" NOT NULL DEFAULT 'TENANT',
  "schema" JSONB NOT NULL DEFAULT '{}',
  "previewUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "studio_components_tenantId_slug_key" UNIQUE ("tenantId", "slug")
);
CREATE INDEX "studio_components_origin_idx" ON "studio_components"("origin");

CREATE TABLE "studio_deployments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "appId" TEXT NOT NULL REFERENCES "studio_apps"("id") ON DELETE CASCADE,
  "kind" "StudioDeploymentKind" NOT NULL,
  "status" "StudioDeploymentStatus" NOT NULL DEFAULT 'PENDING',
  "version" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "errorMessage" TEXT
);
CREATE INDEX "studio_deployments_tenantId_appId_createdAt_idx" ON "studio_deployments"("tenantId", "appId", "createdAt");
CREATE INDEX "studio_deployments_tenantId_status_idx" ON "studio_deployments"("tenantId", "status");
