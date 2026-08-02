/**
 * MerkleRootScheduler — periodic background job that computes Merkle roots
 * over outbox events for each tenant.
 *
 * Plan ref: NC-ACCT-IMP-1 §10 / item "B" — Merkle root scheduler.
 *
 * Wires the existing `OutboxMerkleRootService.computeForPeriod()` into the
 * codebase's homegrown `MiniCronService`. Default cadence: every hour at
 * minute 5 (i.e. `:05`). Configurable via env var
 * `ACCOUNTING_MERKLE_CRON_EXPR` (5-field cron).
 *
 * Idempotency: `OutboxMerkleRootService.computeForPeriod()` writes a new
 * `OutboxMerkleRoot` row keyed on a deterministic rootHash. The DB's
 * `rootHash UNIQUE` constraint makes duplicate runs safe — second-run
 * produces an INSERT 0 0 (silently skipped) and a debug log line.
 *
 * **Honest scope:** this scheduler ONLY computes Merkle roots. It does
 * not verify them, alert on breaks, or render them in the UI. That's
 * audit-findings-admin UI work (deferred).
 */

import { Injectable, Logger } from '@nestjs/common';
import { MiniCronService } from '../../information-engine/cron/mini-cron.service';
import { OutboxMerkleRootService } from './outbox-merkle-root.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const DEFAULT_CRON = '5 * * * *'; // every hour at minute 5

@Injectable()
export class MerkleRootScheduler {
  private readonly logger = new Logger(MerkleRootScheduler.name);
  private started = false;

  constructor(
    private readonly miniCron: MiniCronService,
    private readonly merkle: OutboxMerkleRootService,
    private readonly prisma: PrismaService,
  ) {}

  startCron(): void {
    if (this.started) return;
    const expr = process.env.ACCOUNTING_MERKLE_CRON_EXPR ?? DEFAULT_CRON;
    this.miniCron.registerCron(expr, 'accounting.merkleRoot', () => {
      void this.tick().catch((e) => this.logger.error(e));
    });
    this.started = true;
    this.logger.log(`Merkle root scheduler registered (cron="${expr}")`);
  }

  onModuleDestroy(): void { /* MiniCron owns the timer; nothing to do here */ }

  /** Run one full sweep. Returns count of tenants processed. Exposed for
   *  cert + manual triggers. */
  async tick(): Promise<{ tenants: number; roots: number }> {
    // Discover tenants that have outbox events newer than the last root.
    const tenants = await this.discoverTenantsNeedingRoot();
    let roots = 0;
    for (const tenantId of tenants) {
      try {
        const summary = await this.merkle.computeForPeriod(
          tenantId,
          this.windowStart(),
          this.windowEnd(),
        );
        if (summary) roots += 1;
      } catch (e) {
        this.logger.warn(
          `Merkle root for tenant ${tenantId} failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    this.logger.log(`Merkle sweep: ${tenants.length} tenants processed, ${roots} roots written`);
    return { tenants: tenants.length, roots };
  }

  /** Tenants that have outbox events created after their last root's
   *  `periodEnd` (or any events at all if no roots exist yet). */
  private async discoverTenantsNeedingRoot(): Promise<string[]> {
    // Pull distinct tenantIds from the outbox.
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT DISTINCT "tenantId"
      FROM "EnterpriseEventOutbox"
      WHERE "tenantId" IS NOT NULL
    `;
    const candidates = rows.map((r) => r.tenantId);
    const out: string[] = [];
    for (const tid of candidates) {
      const last = await this.prisma.outboxMerkleRoot.findFirst({
        where: { tenantId: tid },
        orderBy: { computedAt: 'desc' },
      });
      if (!last) { out.push(tid); continue; }
      const newer = await this.prisma.enterpriseEventOutbox.count({
        where: {
          tenantId: tid,
          createdAt: { gt: last.periodEnd },
        },
      });
      if (newer > 0) out.push(tid);
    }
    return out;
  }

  private windowStart(): Date {
    return new Date(Date.now() - 24 * 3600 * 1000); // last 24h
  }
  private windowEnd(): Date {
    return new Date();
  }
}