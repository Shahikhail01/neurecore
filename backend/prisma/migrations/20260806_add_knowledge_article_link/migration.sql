-- Migration: 20260806_add_knowledge_article_link
--
-- Phase 12 of neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PHASE12.md
--
-- Adds the `KnowledgeArticle` table — the canonical storage for
-- `ArticleDraftSkill` outputs and the `KnowledgeHealthSkill`
-- (gap / duplicate / conflict) state.
--
-- Forward-only by design (no destructive column drops). Drops are
-- reserved for a later migration with explicit operator approval.
--
-- Reversibility: DROP TABLE + DROP TYPE for the enum.

BEGIN;

CREATE TYPE "KnowledgeArticleStatus" AS ENUM (
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TABLE IF NOT EXISTS "knowledge_articles" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "title" text NOT NULL,
  "intent" text NOT NULL DEFAULT 'concept',
  "bodyMarkdown" text NOT NULL DEFAULT '',
  "proposedTags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sourceChunkIds" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "duplicateOfId" text,
  "publishedAt" timestamptz,
  "publishedByUserId" text,
  "status" "KnowledgeArticleStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "knowledge_articles_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "knowledge_articles_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId")
    REFERENCES "knowledge_articles"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_articles_tenantId_title_key"
  ON "knowledge_articles"("tenantId","title");

CREATE INDEX IF NOT EXISTS "knowledge_articles_tenantId_status_updatedAt_idx"
  ON "knowledge_articles"("tenantId","status","updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "knowledge_articles_tenantId_duplicateOfId_idx"
  ON "knowledge_articles"("tenantId","duplicateOfId");

CREATE INDEX IF NOT EXISTS "knowledge_articles_publishedAt_idx"
  ON "knowledge_articles"("publishedAt");

COMMIT;
