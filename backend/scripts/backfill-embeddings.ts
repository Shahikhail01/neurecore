/**
 * Backfill Embeddings Script
 *
 * Computes and stores pgvector `embedding_vector` for all MemoryEntry rows
 * that have a JSON `embedding` but no native `embedding_vector` yet.
 *
 * Usage:
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-embeddings.ts
 *
 * Prerequisites:
 *   1. Apply prisma/migrations/20260404_enable_pgvector/migration.sql on Neon.
 *   2. Ensure DATABASE_URL in .env points to the Neon database.
 *   3. OPENAI_API_KEY must be set (used only if regenerating embeddings).
 *
 * Behaviour:
 *   - Processes entries in batches of BATCH_SIZE (default 100).
 *   - Skips rows that already have embedding_vector populated.
 *   - Reads the existing JSON embedding column to avoid re-computing embeddings
 *     (saves OpenAI API costs when embeddings are already present).
 *   - If JSON embedding is missing for a row, skips that row (safe to re-run).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function main() {
  console.log('[backfill] Starting embedding_vector backfill…');

  let offset = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;

  while (true) {
    // Fetch rows that have JSON embedding but no native vector
    const rows = await prisma.$queryRaw<
      Array<{ id: string; embedding: string | null }>
    >`
      SELECT id, embedding
      FROM memory_entries
      WHERE embedding IS NOT NULL
        AND embedding_vector IS NULL
      ORDER BY created_at ASC
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `;

    if (rows.length === 0) {
      console.log('[backfill] No more rows to process.');
      break;
    }

    for (const row of rows) {
      if (!row.embedding) {
        totalSkipped++;
        continue;
      }

      let vec: number[];
      try {
        vec = JSON.parse(row.embedding) as number[];
        if (!Array.isArray(vec) || vec.length !== 1536) {
          console.warn(
            `[backfill] Skipping ${row.id}: unexpected embedding length ${vec?.length}`,
          );
          totalSkipped++;
          continue;
        }
      } catch {
        console.warn(`[backfill] Skipping ${row.id}: invalid JSON embedding`);
        totalSkipped++;
        continue;
      }

      const vecLiteral = `[${vec.join(',')}]`;

      await prisma.$executeRaw`
        UPDATE memory_entries
        SET embedding_vector = ${vecLiteral}::vector
        WHERE id = ${row.id}
      `;

      totalProcessed++;
    }

    console.log(
      `[backfill] Batch complete — processed ${totalProcessed} rows so far…`,
    );

    // If we got a full batch, there may be more rows
    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(
    `[backfill] Done. Processed: ${totalProcessed}, Skipped: ${totalSkipped}`,
  );
}

main()
  .catch((err) => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
