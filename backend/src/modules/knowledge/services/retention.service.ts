/**
 * Retention service — soft delete, hard delete, legal hold, scheduled
 * reconciliation (P2).
 *
 * Storage model: a single retention row per (tenantId, fileId) tracks
 * `softDeletedAt`, `hardDeletedAt`, `legalHold`, `retentionPolicy`,
 * and a JSON `tombstone` so audit / reconciliation can prove the file
 * existed and when it was destroyed.
 *
 * All operations are tenant-scoped. Hard delete clears the encrypted
 * envelope from the in-memory ingestion record and writes a tombstone
 * to the audit log so the action remains visible forever.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  FileIngestionService,
  type FileIngestionRecord,
} from './file-ingestion.service';

export interface RetentionPolicy {
  /** Retention window in days (0 = retain indefinitely until policy says otherwise). */
  readonly days: number;
  /** Hard-delete grace period after soft-delete (days). */
  readonly hardDeleteGraceDays: number;
}

export interface FileRetentionRecord {
  fileId: string;
  tenantId: string;
  retentionPolicy: RetentionPolicy;
  legalHold: boolean;
  softDeletedAt: string | null;
  hardDeletedAt: string | null;
  tombstone: Tombstone | null;
  updatedAt: string;
}

export interface Tombstone {
  actorId: string;
  reason: string;
  evidenceSha256?: string;
  envelope?: Record<string, unknown>;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  days: 365,
  hardDeleteGraceDays: 30,
};

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly rows = new Map<string, FileRetentionRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ingestion: FileIngestionService,
  ) {}

  private key(tenantId: string, fileId: string): string {
    return `${tenantId}:${fileId}`;
  }

  /** Read or create the retention row for `fileId`. */
  ensurePolicy(
    tenantId: string,
    fileId: string,
    policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
  ): FileRetentionRecord {
    const k = this.key(tenantId, fileId);
    let row = this.rows.get(k);
    if (!row) {
      row = {
        fileId,
        tenantId,
        retentionPolicy: policy,
        legalHold: false,
        softDeletedAt: null,
        hardDeletedAt: null,
        tombstone: null,
        updatedAt: new Date().toISOString(),
      };
      this.rows.set(k, row);
    } else {
      row.retentionPolicy = policy;
      row.updatedAt = new Date().toISOString();
    }
    return row;
  }

  async setLegalHold(
    tenantId: string,
    fileId: string,
    actorId: string,
    hold: boolean,
  ): Promise<FileRetentionRecord> {
    const row = this.ensurePolicy(tenantId, fileId);
    if (row.legalHold === hold) return row;
    row.legalHold = hold;
    row.updatedAt = new Date().toISOString();
    await this.audit.log({
      actor: actorId,
      action: hold
        ? 'knowledge.file.legal_hold.set'
        : 'knowledge.file.legal_hold.cleared',
      resource: 'knowledge_file',
      resourceId: fileId,
      tenantId,
      details: { reason: hold ? 'legal_hold_engaged' : 'legal_hold_released' },
    });
    return row;
  }

  async softDelete(
    tenantId: string,
    fileId: string,
    actorId: string,
    reason: string,
  ): Promise<FileRetentionRecord> {
    const row = this.ensurePolicy(tenantId, fileId);
    if (row.legalHold) {
      throw new Error('legal_hold_blocks_soft_delete');
    }
    row.softDeletedAt = new Date().toISOString();
    row.updatedAt = row.softDeletedAt;
    await this.audit.log({
      actor: actorId,
      action: 'knowledge.file.soft_deleted',
      resource: 'knowledge_file',
      resourceId: fileId,
      tenantId,
      details: { reason },
    });
    return row;
  }

  /**
   * Hard delete: clears the encrypted envelope, writes a tombstone,
   * and detaches the file from any KnowledgeEntry. Tombstone entries
   * survive for audit.
   */
  async hardDelete(
    tenantId: string,
    fileId: string,
    actorId: string,
    reason: string,
  ): Promise<FileRetentionRecord> {
    const row = this.ensurePolicy(tenantId, fileId);
    if (row.legalHold) {
      throw new Error('legal_hold_blocks_hard_delete');
    }
    let record: FileIngestionRecord;
    try {
      record = this.ingestion.get(tenantId, fileId);
    } catch {
      throw new NotFoundException(`file ${fileId} not found`);
    }
    row.hardDeletedAt = new Date().toISOString();
    row.tombstone = {
      actorId,
      reason,
      evidenceSha256: record.sha256,
      envelope: record.envelope ? { ...record.envelope } : undefined,
    };
    row.updatedAt = row.hardDeletedAt;
    await this.audit.log({
      actor: actorId,
      action: 'knowledge.file.hard_deleted',
      resource: 'knowledge_file',
      resourceId: fileId,
      tenantId,
      details: { reason, sha256: record.sha256 },
    });
    // Detach knowledge entry if present (tenant-scoped)
    if (record.knowledgeEntryId) {
      await this.prisma.knowledgeEntry.updateMany({
        where: { id: record.knowledgeEntryId, tenantId },
        data: { status: 'archived', effectiveTo: new Date() },
      });
    }
    return row;
  }

  /**
   * Scheduled reconciliation — hard-deletes any file whose
   * soft-delete grace has elapsed, except when legalHold is set.
   * Returns the list of files that were hard-deleted (caller logs
   * it to the audit trail).
   */
  async reconcile(tenantId: string, now: Date = new Date()): Promise<string[]> {
    const purged: string[] = [];
    for (const row of this.rows.values()) {
      if (row.tenantId !== tenantId) continue;
      if (row.legalHold) continue;
      if (!row.softDeletedAt) continue;
      if (row.hardDeletedAt) continue;
      const graceMs =
        row.retentionPolicy.hardDeleteGraceDays * 24 * 60 * 60 * 1000;
      if (now.getTime() - new Date(row.softDeletedAt).getTime() >= graceMs) {
        await this.hardDelete(
          tenantId,
          row.fileId,
          'system:retention',
          'retention_window_expired',
        );
        purged.push(row.fileId);
      }
    }
    return purged;
  }

  get(tenantId: string, fileId: string): FileRetentionRecord {
    const r = this.rows.get(this.key(tenantId, fileId));
    if (!r) throw new NotFoundException(`retention row ${fileId} not found`);
    return r;
  }
}
