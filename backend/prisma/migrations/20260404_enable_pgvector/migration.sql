-- Enable pgvector extension
-- Apply this migration via Neon SQL console (NOT via `prisma migrate dev`)
-- because Neon requires superuser privileges for CREATE EXTENSION.

CREATE EXTENSION IF NOT EXISTS vector;

-- Add native vector column to memory_entries
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- IVFFlat index for fast approximate cosine-similarity search
-- lists = 100 is suitable for tables up to ~1 M rows
-- Tune `lists` and `probes` based on actual data volume
CREATE INDEX IF NOT EXISTS idx_memory_entries_embedding_vector
  ON memory_entries
  USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);
