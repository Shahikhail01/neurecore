-- Add isSelected column to agents table
-- This column was previously applied ad-hoc via raw SQL; this migration formalises it.
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "isSelected" BOOLEAN NOT NULL DEFAULT true;
