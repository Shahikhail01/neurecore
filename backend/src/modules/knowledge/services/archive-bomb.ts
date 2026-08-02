/**
 * Archive-bomb / upload-size defences (P2 — Files & Knowledge).
 *
 * Two layers:
 *
 *   1. {@link enforceSizeBudget} — pure size limit (bytes, pages, tokens).
 *   2. {@link enforceArchiveBombGuards} — protects against zip-bombs by
 *      bounding the uncompressed-to-compressed ratio, the total entries,
 *      and the maximum nesting depth of any archive before parsing.
 *
 * The actual archive expansion is performed by the parser (e.g. the
 * parser responsible for `.zip`), but THIS module enforces the limits
 * the parsers must consult.
 */
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export interface SizeBudget {
  readonly maxBytes: number;
  readonly maxPages?: number;
  readonly maxTokens?: number;
}

export interface ArchiveBombLimits {
  /** Max entries inside a single archive. */
  readonly maxEntries: number;
  /** Max nesting depth (zip inside zip inside zip …). */
  readonly maxDepth: number;
  /** Max total uncompressed bytes (post-expansion). */
  readonly maxUncompressedBytes: number;
  /** Max compression ratio: uncompressed / compressed. */
  readonly maxCompressionRatio: number;
}

export const DEFAULT_SIZE_BUDGET: SizeBudget = {
  maxBytes: 100 * 1024 * 1024, // 100 MB
  maxPages: 5_000,
  maxTokens: 2_000_000,
};

export const DEFAULT_ARCHIVE_LIMITS: ArchiveBombLimits = {
  maxEntries: 10_000,
  maxDepth: 4,
  maxUncompressedBytes: 500 * 1024 * 1024, // 500 MB
  maxCompressionRatio: 100,
};

export function enforceSizeBudget(
  input: { bytes: number; pages?: number; tokens?: number },
  budget: SizeBudget,
): void {
  if (input.bytes > budget.maxBytes) {
    throw new PayloadTooLargeException(
      `Upload exceeds maxBytes=${budget.maxBytes}`,
    );
  }
  if (
    budget.maxPages !== undefined &&
    input.pages !== undefined &&
    input.pages > budget.maxPages
  ) {
    throw new BadRequestException(
      `Document exceeds maxPages=${budget.maxPages}`,
    );
  }
  if (
    budget.maxTokens !== undefined &&
    input.tokens !== undefined &&
    input.tokens > budget.maxTokens
  ) {
    throw new BadRequestException(
      `Document exceeds maxTokens=${budget.maxTokens}`,
    );
  }
}

export function enforceArchiveBombGuards(
  archive: {
    compressedBytes: number;
    uncompressedBytes: number;
    entryCount: number;
    depth: number;
  },
  limits: ArchiveBombLimits = DEFAULT_ARCHIVE_LIMITS,
): void {
  if (archive.entryCount > limits.maxEntries) {
    throw new BadRequestException(
      `Archive exceeds maxEntries=${limits.maxEntries} (archive-bomb defence)`,
    );
  }
  if (archive.depth > limits.maxDepth) {
    throw new BadRequestException(
      `Archive nesting depth exceeds maxDepth=${limits.maxDepth} (archive-bomb defence)`,
    );
  }
  if (archive.uncompressedBytes > limits.maxUncompressedBytes) {
    throw new PayloadTooLargeException(
      `Archive uncompressed size exceeds limit (archive-bomb defence)`,
    );
  }
  const compressed = Math.max(archive.compressedBytes, 1);
  const ratio = archive.uncompressedBytes / compressed;
  if (ratio > limits.maxCompressionRatio) {
    throw new BadRequestException(
      `Archive compression ratio ${ratio.toFixed(1)} exceeds limit ${limits.maxCompressionRatio} (archive-bomb defence)`,
    );
  }
}
