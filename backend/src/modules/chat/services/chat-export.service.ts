/**
 * Phase 15/22 — ChatExportService.
 *
 * Source plans:
 *   - IMPLEMENTATION_PLAN_PHASE_15_18.md §1 (initial service)
 *   - IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §3 (P22 SOLID split)
 *
 * Closes CR-AI-0003 "export/delete/redact + audit". Exports a
 * conversation in CSV / Markdown / JSON. Redaction is policy-driven
 * — a typed policy DSL + audit row per export.
 *
 * SOLID — P22 split:
 *   SRP — this orchestrator owns ONLY the sequence: read rows →
 *     renderer → redact → persist → audit. Bytes are produced by
 *     `IFileRenderer`; evidence is written by `IExportAuditSink`.
 *   OCP — adding a new export format = one `IFileRenderer` + one
 *     enum member. The orchestrator is closed for modification.
 *   DIP — depends on `IExportAuditSink`, not `PrismaService` directly.
 *
 * SECURITY — no external URL is ever returned. `storagePath` is
 * internal; the operator downloads via an authenticated
 * /api/v1/chat/export/:exportId route (controller wires RBAC).
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { ExportFormat } from '../dto/chat-export.dto';
import { getRenderer, type ExportRow } from './chat-export-renderers';
import type { IExportAuditSink, ExportAuditActor } from './chat-export-audit-sink';

export class ChatExportForbiddenError extends Error {
  constructor(readonly reason: string) {
    super(`chat-export forbidden: ${reason}`);
    this.name = 'ChatExportForbiddenError';
  }
}

export interface ChatExportResult {
  readonly exportId: string;
  readonly tenantId: string;
  readonly conversationId: string;
  readonly format: ExportFormat;
  readonly byteSize: number;
  readonly storagePath: string;
  readonly redacted: boolean;
  readonly expiresAt: string;
}

export const CHAT_EXPORT_AUDIT_SINK = Symbol('CHAT_EXPORT_AUDIT_SINK');

@Injectable()
export class ChatExportService {
  private readonly logger = new Logger(ChatExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(CHAT_EXPORT_AUDIT_SINK)
    private readonly auditSink?: IExportAuditSink,
  ) {}

  /**
   * Run the export pipeline. Each step is its own concern; the
   * orchestrator's job is sequence + audit row.
   */
  async export(params: {
    tenantId: string;
    actorId: string;
    conversationId: string;
    format: ExportFormat;
    redact: boolean;
  }): Promise<ChatExportResult> {
    if (!params.tenantId || params.tenantId === '*') {
      throw new ChatExportForbiddenError('tenant context required');
    }
    const rows = await this.readRows(params.tenantId, params.conversationId);
    const redacted = params.redact
      ? rows.map((r) => ({ ...r, content: redactPii(r.content) }))
      : rows;

    const renderer = getRenderer(params.format);
    const bytes = renderer.render(redacted);
    const byteSize = bytes.byteLength;

    const exportId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `chat-exports/${params.tenantId}/${exportId}.${params.format}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.chatExport.create({
      data: {
        id: exportId,
        tenantId: params.tenantId,
        actorId: params.actorId,
        conversationId: params.conversationId,
        format: params.format,
        redact: params.redact,
        byteSize,
        storagePath,
        expiresAt,
      },
    });

    if (this.auditSink) {
      await this.auditSink.record(
        { sub: params.actorId, tenantId: params.tenantId },
        exportId,
        'created',
      );
    }

    return {
      exportId,
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      format: params.format,
      byteSize,
      storagePath,
      redacted: params.redact,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Read the rendered bytes back from the orchestrator for the
   * byte-download route. Renderer is keyed by the row's `format`.
   * Returns null when the export id is unknown or tenant-foreign.
   */
  async readBytes(
    tenantId: string,
    exportId: string,
  ): Promise<{ bytes: Buffer; format: ExportFormat; exportId: string } | null> {
    if (!tenantId || tenantId === '*') return null;
    const row = await this.prisma.chatExport.findFirst({
      where: { id: exportId, tenantId },
    });
    if (!row) return null;
    const messages = await this.readRows(tenantId, row.conversationId);
    const processed = row.redact
      ? messages.map((r) => ({ ...r, content: redactPii(r.content) }))
      : messages;
    const renderer = getRenderer(row.format as ExportFormat);
    const bytes = renderer.render(processed);
    if (this.auditSink) {
      await this.auditSink.record(
        { sub: row.actorId, tenantId },
        exportId,
        'downloaded',
      );
    }
    return { bytes, format: row.format as ExportFormat, exportId };
  }

  /**
   * Hard-delete export by id, tenant-scoped. Returns true when
   * a row was deleted.
   */
  async deleteExport(tenantId: string, exportId: string): Promise<boolean> {
    if (!tenantId || tenantId === '*') {
      throw new ChatExportForbiddenError('tenant context required');
    }
    let existing: { actorId: string } | null = null;
    if (this.auditSink) {
      try {
        existing = await this.prisma.chatExport.findFirst({
          where: { id: exportId, tenantId },
          select: { actorId: true },
        });
      } catch {
        existing = null;
      }
    }
    const res = await this.prisma.chatExport.deleteMany({
      where: { id: exportId, tenantId },
    });
    if (res.count > 0 && this.auditSink && existing) {
      await this.auditSink.record(
        { sub: existing.actorId, tenantId },
        exportId,
        'deleted',
      );
    }
    return res.count > 0;
  }

  /**
   * Back-compat: keep `recordAudit` for any caller that still uses
   * it. New code should prefer `IExportAuditSink` directly.
   */
  async recordAudit(
    actor: ExportAuditActor,
    exportId: string,
    action: 'created' | 'deleted' | 'downloaded',
  ): Promise<void> {
    if (this.auditSink) {
      await this.auditSink.record(actor, exportId, action);
      return;
    }
    if (!actor.tenantId || actor.tenantId === '*') return;
    await this.prisma.auditLog.create({
      data: {
        actor: actor.sub,
        tenantId: actor.tenantId,
        action: `chat.export.${action}`,
        resource: 'chat_export',
        resourceId: exportId,
        result: 'success',
      },
    });
  }

  private async readRows(
    tenantId: string,
    conversationId: string,
  ): Promise<ExportRow[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        model: true,
        provider: true,
      },
    });
    if (rows.length === 0) {
      throw new ChatExportForbiddenError(
        `conversation ${conversationId} not found`,
      );
    }
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: r.createdAt,
      model: r.model ?? undefined,
      provider: r.provider ?? undefined,
    }));
  }
}

/**
 * Conservative PII strip. Replaces emails with `<email>`, currency
 * tokens with `<currency>`, phone-like sequences with `<phone>`.
 * Not a defence-in-depth; the audit log records the export so the
 * operator can review redacted exports manually.
 */
export function redactPii(text: string): string {
  return text
    .replace(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/[$€£¥₹]\s?\d[\d,.\s]*/g, '<currency>')
    .replace(/\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, '<phone>');
}
