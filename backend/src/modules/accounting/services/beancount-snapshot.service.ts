/**
 * BeancountSnapshotService — regenerates per-tenant .beancount snapshots
 * from the DB on a background cadence.
 *
 * Plan ref: NC-ACCT-IMP-1 §3 (Snapshot strategy), §5 (BeancountExport).
 *
 * Lifecycle:
 *   1. NestJS writes a journal entry → `LedgerRepositoryService.createJournalEntry`
 *      commits a single UoW (DB only; no FS writes inside the UoW).
 *   2. After commit, NestJS enqueues a snapshot regen for the affected tenant.
 *   3. The regen job coalesces (≤1 Hz per tenant) and writes a temp file,
 *      then atomically renames to the canonical snapshot path.
 *   4. The sidecar's SIGHUP handler remaps the snapshot via mmap.
 *
 * Atomicity guarantees:
 *   - DB is the source of truth.
 *   - The snapshot file may briefly be stale (≤1 regen interval) but
 *     is never inconsistent with itself (write-temp + atomic rename).
 *   - If the regen fails, the LAST GOOD snapshot continues to be served.
 *
 * Deployment:
 *   - Snapshot path: `/var/lib/neurecore/accounting/snapshots/<tenantId>.beancount`
 *   - NestJS writes via `fs.writeFile` to a temp sibling, then `fs.rename`
 *     (atomic on POSIX).
 *   - The sidecar must have **read-only** access to the snapshot dir.
 *     Use systemd `ReadOnlyPaths=` + ACLs for enforcement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChartOfAccountsService } from './chart-of-accounts.service';

interface SnapshotRegenEntry {
  tenantId: string;
  enqueuedAt: number;
}

@Injectable()
export class BeancountSnapshotService {
  private readonly logger = new Logger(BeancountSnapshotService.name);
  private readonly snapshotDir: string;
  private readonly maxCoalesceHz: number;
  private readonly queue = new Map<string, SnapshotRegenEntry>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly coa: ChartOfAccountsService,
    config: ConfigService,
  ) {
    const dir = config.get<string>('ACCOUNTING_SNAPSHOT_DIR')
      ?? '/var/lib/neurecore/accounting/snapshots';
    this.snapshotDir = dir;
    const hz = config.get<string>('ACCOUNTING_SNAPSHOT_COALESCE_HZ');
    this.maxCoalesceHz = hz ? parseInt(hz, 10) : 1; // 1 Hz default
    this.logger.log(`Beancount snapshots → ${this.snapshotDir} (coalesce ${this.maxCoalesceHz}Hz)`);
  }

  /**
   * Enqueue a tenant snapshot regen. Coalesces with prior pending regens
   * for the same tenant (max 1 regen per tenant per coalesce window).
   */
  enqueue(tenantId: string): void {
    this.queue.set(tenantId, { tenantId, enqueuedAt: Date.now() });
    this.scheduleFlush();
  }

  /**
   * Schedule a flush. If one is already scheduled, no-op.
   * Coalesce window = 1000 / maxCoalesceHz ms.
   */
  private scheduleFlush(): void {
    if (this.timer) return;
    const delay = Math.max(50, Math.floor(1000 / this.maxCoalesceHz));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  private async flush(): Promise<void> {
    const tenants = Array.from(this.queue.values());
    this.queue.clear();
    for (const entry of tenants) {
      try {
        await this.regenerate(entry.tenantId);
      } catch (e) {
        this.logger.error(
          `Snapshot regen failed for tenant ${entry.tenantId}: ` +
          (e instanceof Error ? e.message : String(e)),
        );
      }
    }
  }

  /**
   * Generate the .beancount text for a tenant and atomically write it to disk.
   * Returns the path written, or null if the directory is not configured.
   */
  async regenerate(tenantId: string): Promise<string | null> {
    const text = await this.buildBeancount(tenantId);
    const target = path.join(this.snapshotDir, `${tenantId}.beancount`);
    const tmp = `${target}.${randomUUID()}.tmp`;

    try {
      await fs.mkdir(this.snapshotDir, { recursive: true });
      await fs.writeFile(tmp, text, { encoding: 'utf-8', mode: 0o644 });
      await fs.rename(tmp, target);
      this.logger.debug(`Snapshot regen OK: ${target} (${text.length} bytes)`);
      return target;
    } catch (e) {
      // Best-effort cleanup of temp file
      await fs.unlink(tmp).catch(() => undefined);
      // If the dir doesn't exist (e.g. local dev), swallow the error and
      // log at debug. Production deploys must have the dir mounted.
      if (e instanceof Error && e.message.includes('ENOENT')) {
        this.logger.debug(`Snapshot dir not present; skipping regen for ${tenantId}`);
        return null;
      }
      throw e;
    }
  }

  /**
   * Build the full .beancount text for a tenant from DB rows.
   *
   * Format:
   *   YYYY-MM-DD open Account:Name CURRENCY
   *   YYYY-MM-DD txn "narration"
   *     Account:Name   AMOUNT CURRENCY
   */
  async buildBeancount(tenantId: string): Promise<string> {
    const accounts = await this.coa.list(tenantId, { isActive: true });
    const lines: string[] = [];

    // Open directives — one per active account.
    for (const a of accounts) {
      const dateStr = a.createdAt.toISOString().slice(0, 10);
      lines.push(`${dateStr} open ${a.code} ${a.currency}`);
    }

    // Transactions + postings.
    const entries = await this.prisma.journalEntry.findMany({
      where: { tenantId },
      include: {
        postings: { include: { account: true } },
      },
      orderBy: [{ txnDate: 'asc' }, { createdAt: 'asc' }],
    });
    for (const je of entries) {
      const dateStr = je.txnDate.toISOString().slice(0, 10);
      lines.push(`${dateStr} * "${escapeBeancount(je.narration)}"`);
      for (const p of je.postings) {
        const amt = p.postingType === 'CREDIT'
          ? `-${p.amount.toString()}`
          : p.amount.toString();
        lines.push(`  ${p.account.code}  ${amt} ${p.currency}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Snapshot freshness — useful for the /healthz endpoint and admin UI.
   */
  async freshness(tenantId: string): Promise<{
    exists: boolean;
    mtime: Date | null;
    sizeBytes: number;
  }> {
    const target = path.join(this.snapshotDir, `${tenantId}.beancount`);
    try {
      const stat = await fs.stat(target);
      return { exists: true, mtime: stat.mtime, sizeBytes: stat.size };
    } catch {
      return { exists: false, mtime: null, sizeBytes: 0 };
    }
  }

  /**
   * Synchronous one-shot regen for tests (skips coalescing).
   */
  async regenerateSync(tenantId: string): Promise<string | null> {
    return this.regenerate(tenantId);
  }
}

function escapeBeancount(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}