/**
 * Phase 30 — Audit alert sink (CR-AI-1305).
 *
 * Every ceiling denial leaves an append-only evidence row, so an
 * operator can answer "why did this tenant's AI stop?" from the audit
 * trail alone.
 *
 * SOLID
 *   SRP — owns ONLY alert emission.
 *   LSP — implements `IAlertSink`; a pager or webhook sink
 *         substitutes it without touching the service.
 *   DIP — delegates to the injected `AuditService`; it never opens a
 *         Prisma client itself.
 */

import { Injectable } from '@nestjs/common';
import { AuditService } from '@/modules/audit/audit.service';
import type { CostAlertEvent, IAlertSink } from '../interfaces/IAlertSink';

export const COST_CEILING_AUDIT_ACTION = 'cost-ceiling.denied';

@Injectable()
export class AuditCostAlertSink implements IAlertSink {
  constructor(private readonly audit: AuditService) {}

  async alert(event: CostAlertEvent): Promise<void> {
    await this.audit.log({
      actor: event.actorUserId ?? 'system',
      action: COST_CEILING_AUDIT_ACTION,
      resource: 'cost-ceiling',
      resourceId: event.evaluation.dimension,
      tenantId: event.tenantId,
      result: 'failure',
      details: {
        capability: event.capability,
        dimension: event.evaluation.dimension,
        unit: event.evaluation.unit,
        used: event.evaluation.used,
        projected: event.evaluation.projected,
        limitValue: event.evaluation.limitValue,
        utilization: event.evaluation.utilization,
      },
    });
  }
}
