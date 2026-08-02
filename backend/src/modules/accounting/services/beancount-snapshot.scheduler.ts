/**
 * BeancountSnapshotScheduler — periodic background job that regenerates
 * per-tenant .beancount files for the sidecar to mmap.
 *
 * Plan ref: NC-ACCT-IMP-1 §10 / item "C" — Beancount snapshot scheduler.
 *
 * Wires the existing `BeancountSnapshotService.enqueue()` (which already
 * coalesces at ≤1 Hz per tenant) into the homegrown MiniCronService.
 *
 * **Idempotency / coalescing:** `enqueue()` is idempotent — calling it
 * once per sweep sets a 1-second timer that fires only if no other
 * enqueue came in. This scheduler ticks every 60s by default, but the
 * actual regen rate is capped at 1 Hz regardless.
 *
 * **Honest scope:** this scheduler ONLY regenerates the file. The
 * sidecar reads the file via mmap and emits SIGHUP on its own via the
 * WatchdogTimer thread we add to SnapshotStore. See P1-P2.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MiniCronService } from '../../information-engine/cron/mini-cron.service';
import { BeancountSnapshotService } from './beancount-snapshot.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const DEFAULT_CRON = '* * * * *'; // every minute at :00

@Injectable()
export class BeancountSnapshotScheduler {
  private readonly logger = new Logger(BeancountSnapshotScheduler.name);
  private started = false;

  constructor(
    private readonly miniCron: MiniCronService,
    private readonly snapshots: BeancountSnapshotService,
    private readonly prisma: PrismaService,
  ) {}

  startCron(): void {
    if (this.started) return;
    const expr = process.env.ACCOUNTING_BEANCOUNT_CRON_EXPR ?? DEFAULT_CRON;
    this.miniCron.registerCron(expr, 'accounting.beancountSnapshot', () => {
      void this.tick().catch((e) => this.logger.error(e));
    });
    this.started = true;
    this.logger.log(`Beancount snapshot scheduler registered (cron="${expr}")`);
  }

  async tick(): Promise<{ tenants: number; regenerated: number }> {
    const tenants = await this.discoverTenantsWithLedgerActivity();
    let regenerated = 0;
    for (const tid of tenants) {
      try {
        await this.snapshots.enqueue(tid);
        regenerated += 1;
      } catch (e) {
        this.logger.warn(
          `Snapshot enqueue for tenant ${tid} failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    this.logger.log(
      `Beancount sweep: ${tenants.length} tenants qualified, ${regenerated} enqueued`,
    );
    return { tenants: tenants.length, regenerated };
  }

  /** Tenants that have ledger activity in the last 10 minutes (so we
   *  don't waste cycles on tenants with no journal entries). */
  private async discoverTenantsWithLedgerActivity(): Promise<string[]> {
    const since = new Date(Date.now() - 10 * 60_000);
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT DISTINCT je."tenantId"
      FROM "JournalEntry" je
      WHERE je."createdAt" > ${since}
    `;
    return rows.map((r) => r.tenantId);
  }
}