/**
 * Phase 22 — Chat export audit sink (CR-AI-0003).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §3 (P22).
 *
 * SOLID — ISP: `IExportAuditSink` is the single narrow surface the
 * export service depends on for evidence. The sink in turn delegates
 * to the existing `AuditService` (append-only audit_log table).
 *
 * DIP: domain code depends on `IExportAuditSink`; the concrete sink
 * is injected. No new `PrismaService` import.
 *
 * SRP: owns ONLY the act of writing a typed `chat.export.*` audit row.
 * File bytes live in `IFileRenderer`; tenant scope lives in the
 * controller.
 */

import type { AuditService } from '../../audit/audit.service';

export const CHAT_EXPORT_AUDIT_SINK = Symbol('CHAT_EXPORT_AUDIT_SINK');

export type ExportAuditAction = 'created' | 'deleted' | 'downloaded';

export interface ExportAuditActor {
  readonly sub: string;
  readonly tenantId: string;
}

export interface IExportAuditSink {
  record(
    actor: ExportAuditActor,
    exportId: string,
    action: ExportAuditAction,
  ): Promise<void>;
}

export class ChatExportAuditSink implements IExportAuditSink {
  constructor(private readonly audit: AuditService) {}

  async record(
    actor: ExportAuditActor,
    exportId: string,
    action: ExportAuditAction,
  ): Promise<void> {
    if (!actor.tenantId || actor.tenantId === '*') return;
    await this.audit.log({
      actor: actor.sub,
      tenantId: actor.tenantId,
      action: `chat.export.${action}`,
      resource: 'chat_export',
      resourceId: exportId,
      result: 'success',
      details: { action },
    });
  }
}
