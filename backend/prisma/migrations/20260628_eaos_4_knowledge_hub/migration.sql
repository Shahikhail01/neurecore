-- ═══════════════════════════════════════════════════════════════════════════
-- EAOS-4 — Knowledge Hub
-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 6, Task 6.2 (per EAOS-implementation-roadmap.md §10 +
-- EAOS-implementation-plan.md §7.1, §9.7 + EAOS-api-contract.md §8.17).
--
-- Two new tables: knowledge_entries + knowledge_packs.
-- One new enum: knowledge_type.
-- pgvector extension enabled; contentVector column stores 1536-dim vectors
-- (text-embedding-3-small). The vector column uses HNSW index for
-- sub-millisecond cosine search at scale.
--
-- All changes are ADDITIVE — no existing model is modified.
-- Old MemoryEntry.embedding (text JSON) is left untouched per §14.1 Q6.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable pgvector extension (idempotent on Contabo PostgreSQL when available)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "knowledge_type" AS ENUM (
  'POLICY',
  'SOP',
  'PLAYBOOK',
  'TEMPLATE',
  'PROMPT',
  'REGULATION',
  'CONTRACT',
  'REPORT',
  'DOCUMENTATION',
  'FAQ',
  'GUIDE',
  'BRIEFING'
);

-- CreateTable
CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "knowledge_type" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentVector" vector(1536),
    "language" TEXT NOT NULL DEFAULT 'en',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "departmentId" TEXT,
    "entityTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceUrl" TEXT,
    "authorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "chunkCount" INTEGER NOT NULL DEFAULT 1,
    "retrievalCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetrievedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_packs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "solutionPackId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_packs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_entries_tenantId_type_idx" ON "knowledge_entries"("tenantId", "type");

-- CreateIndex
CREATE INDEX "knowledge_entries_tenantId_status_idx" ON "knowledge_entries"("tenantId", "status");

-- CreateIndex
CREATE INDEX "knowledge_entries_tenantId_departmentId_idx" ON "knowledge_entries"("tenantId", "departmentId");

-- CreateIndex (HNSW for cosine similarity — pgvector best practice)
CREATE INDEX "knowledge_entries_contentVector_idx" ON "knowledge_entries" USING hnsw ("contentVector" vector_cosine_ops);

-- CreateIndex
CREATE INDEX "knowledge_packs_tenantId_idx" ON "knowledge_packs"("tenantId");
