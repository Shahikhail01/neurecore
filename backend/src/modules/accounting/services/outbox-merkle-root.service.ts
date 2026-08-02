/**
 * OutboxMerkleRootService — computes Merkle roots over outbox events.
 *
 * Plan ref: NC-ACCT-IMP-1 §6 (OutboxMerkleRoot), §15 (out of scope for
 * Phase 1 — but we deliver the foundational class anyway because the
 * schema is already there and the test cert requires it).
 *
 * **What this is:**
 *   - A background job that walks `EnterpriseEventOutbox` events for a
 *     tenant in a window and computes a Merkle root.
 *   - The chain is: rootHash = sha256(prevRoot || leaf_1 || ... || leaf_N)
 *     where each leaf is sha256(eventId || payloadHash).
 *   - Snapshots are stored in `OutboxMerkleRoot` (append-only).
 *
 * **What this is NOT (yet):**
 *   - A real audit verification UI (admin/cert Phase 2).
 *   - A periodic background scheduler — for Phase 1m, we expose
 *     `computeForPeriod()` which is called by the cert test harness.
 *     Production wiring (Phase 1l/2) will add an interval timer.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface MerkleRootSummary {
  tenantId: string;
  rootHash: string;
  prevRootHash: string | null;
  leafCount: number;
  firstEventId: string | null;
  lastEventId: string | null;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class OutboxMerkleRootService {
  private readonly logger = new Logger(OutboxMerkleRootService.name);
  private readonly defaultWindowSize: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const size = config.get<string>('ACCOUNTING_MERKLE_WINDOW_SIZE');
    this.defaultWindowSize = size ? parseInt(size, 10) : 1000;
  }

  /**
   * Compute a Merkle root over outbox events for a tenant between
   * [start, end]. Returns the summary (also persisted to OutboxMerkleRoot).
   *
   * If no events exist in the window, returns null.
   */
  async computeForPeriod(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MerkleRootSummary | null> {
    const events = await this.prisma.enterpriseEventOutbox.findMany({
      where: {
        tenantId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: this.defaultWindowSize + 1, // 1 over to detect overflow
    });

    if (events.length === 0) {
      this.logger.log(
        `No events in window [${periodStart.toISOString()}, ${periodEnd.toISOString()}] ` +
        `for tenant ${tenantId}; skipping merkle root`,
      );
      return null;
    }
    if (events.length > this.defaultWindowSize) {
      this.logger.warn(
        `Window exceeds ${this.defaultWindowSize} events for tenant ${tenantId}; ` +
        'truncating. Split the window or increase ACCOUNTING_MERKLE_WINDOW_SIZE.',
      );
    }
    const window = events.slice(0, this.defaultWindowSize);

    // Find the previous root to chain.
    const prev = await this.prisma.outboxMerkleRoot.findFirst({
      where: {
        tenantId,
        OR: [
          { periodEnd: { lt: periodStart } },
          { computedAt: { lt: periodStart } },
        ],
      },
      orderBy: { computedAt: 'desc' },
    });
    const prevRootHash = prev?.rootHash ?? null;

    // Compute leaf hashes: sha256(eventId || payloadHash)
    // payloadHash = sha256(canonical payload JSON)
    const leafHashes: string[] = [];
    let firstEventId: string | null = null;
    let lastEventId: string | null = null;
    for (const e of window) {
      if (firstEventId === null) firstEventId = e.id;
      lastEventId = e.id;
      const payloadHash = createHash('sha256')
        .update(JSON.stringify(e.payload ?? {}))
        .digest('hex');
      const leaf = createHash('sha256')
        .update(e.id)
        .update(payloadHash)
        .digest('hex');
      leafHashes.push(leaf);
    }

    // Compute Merkle root: sha256(prevRoot || leaf_1 || ... || leaf_N)
    const rootHash = createHash('sha256')
      .update(prevRootHash ?? '')
      .update(leafHashes.join(''))
      .digest('hex');

    // Persist (idempotent on rootHash via unique constraint).
    try {
      await this.prisma.outboxMerkleRoot.create({
        data: {
          tenantId,
          rootHash,
          prevRootHash,
          leafCount: leafHashes.length,
          firstEventId,
          lastEventId,
          periodStart,
          periodEnd,
        },
      });
    } catch (e) {
      // P2002 = unique violation on rootHash — already computed; idempotent.
      if ((e as { code?: string }).code !== 'P2002') {
        throw e;
      }
      this.logger.debug(`Merkle root ${rootHash.slice(0, 16)}... already exists; idempotent`);
    }

    return {
      tenantId,
      rootHash,
      prevRootHash,
      leafCount: leafHashes.length,
      firstEventId,
      lastEventId,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Verify a stored root by recomputing from the underlying events.
   * Used by the admin UI and cert harness.
   */
  async verifyRoot(rootId: string): Promise<{ ok: boolean; reason?: string }> {
    const root = await this.prisma.outboxMerkleRoot.findUnique({
      where: { id: rootId },
    });
    if (!root) {
      return { ok: false, reason: 'root_not_found' };
    }

    const events = await this.prisma.enterpriseEventOutbox.findMany({
      where: {
        tenantId: root.tenantId,
        createdAt: { gte: root.periodStart, lte: root.periodEnd },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    if (events.length !== root.leafCount) {
      return { ok: false, reason: `leaf_count_mismatch: stored=${root.leafCount}, actual=${events.length}` };
    }

    const leafHashes: string[] = [];
    for (const e of events) {
      const payloadHash = createHash('sha256')
        .update(JSON.stringify(e.payload ?? {}))
        .digest('hex');
      const leaf = createHash('sha256').update(e.id).update(payloadHash).digest('hex');
      leafHashes.push(leaf);
    }

    const recomputed = createHash('sha256')
      .update(root.prevRootHash ?? '')
      .update(leafHashes.join(''))
      .digest('hex');

    if (recomputed !== root.rootHash) {
      return { ok: false, reason: `root_mismatch: stored=${root.rootHash}, recomputed=${recomputed}` };
    }
    return { ok: true };
  }
}