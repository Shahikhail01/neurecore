/**
 * command-center/services/security-events.service.ts
 *
 * P8 — CR-AI-1206 Security Events view.
 *
 * Surfaces tenant-scoped AuditLog entries classified as
 * security-relevant. The dashboard can show:
 *   - denials
 *   - injection / DLP / malware events
 *   - critical-severity activity
 *
 * IP addresses are masked to the /24 prefix before transmission
 * so the dashboard never sees raw PII (defence-in-depth alongside
 * the global DataMaskingService).
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  SecurityEventsResponseDto,
  SecurityEventsSummaryDto,
  SecurityEventDto,
} from '../dto/security-events.dto';

export const SECURITY_ACTIONS = [
  'auth.login_failed',
  'auth.token_revoked',
  'security.injection_attempt',
  'security.dlp_event',
  'security.malware_detected',
  'security.policy_denied',
  'security.cross_tenant_blocked',
  'tenant.isolation_violation',
  'auth.unauthorized_access',
  'rate_limit.exceeded',
  // Phase P2 — knowledge ingestion security telemetry (file uploads).
  'knowledge.security.malware_detected',
  'knowledge.security.dlp_violation',
  'knowledge.security.archive_bomb',
  'knowledge.security.injection_suspected',
  'knowledge.security.acl_violation',
  'knowledge.security.encryption_failure',
] as const;

const DEFAULT_LIMIT = 100;

export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 4).join(':')}:****`;
  }
  return null;
}

export function severityFromAction(
  action: string,
): SecurityEventDto['severity'] {
  if (/(injection|malware|cross_tenant|isolation_violation)/.test(action))
    return 'critical';
  if (/(dlp|policy_denied|unauthorized)/.test(action)) return 'high';
  if (/(token_revoked|rate_limit)/.test(action)) return 'medium';
  return 'low';
}

function categoryFromAction(action: string): string {
  if (action.startsWith('auth.')) return 'auth';
  if (action.startsWith('security.')) return 'security';
  if (action.startsWith('tenant.')) return 'data';
  return 'system';
}

export { categoryFromAction };

export function isSecurityAction(action: string): boolean {
  return (SECURITY_ACTIONS as readonly string[]).includes(action);
}

export function computeSecuritySummary(
  countsByAction: ReadonlyArray<{ action: string; count: number }>,
): SecurityEventsSummaryDto {
  const count = (re: RegExp): number =>
    countsByAction
      .filter((t) => re.test(t.action))
      .reduce((a, b) => a + b.count, 0);
  return {
    total: countsByAction.reduce((a, b) => a + b.count, 0),
    denials: count(/^security\.policy_denied$|^auth\.unauthorized_access$/),
    injectionAttempts: count(/injection/),
    dlpEvents: count(/dlp/),
    malwareEvents: count(/malware/),
    criticalCount: countsByAction
      .filter((t) => severityFromAction(t.action) === 'critical')
      .reduce((a, b) => a + b.count, 0),
  };
}

@Injectable()
export class SecurityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSecurityEvents(
    tenantId: string,
    limit = DEFAULT_LIMIT,
  ): Promise<SecurityEventsResponseDto> {
    const safeLimit = Math.max(1, Math.min(500, limit));
    const now = new Date();

    const [rows, totals] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { tenantId, action: { in: [...SECURITY_ACTIONS] } },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          actor: true,
          action: true,
          resource: true,
          resourceId: true,
          ipAddress: true,
          result: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { tenantId, action: { in: [...SECURITY_ACTIONS] } },
        _count: { _all: true },
      }),
    ]);

    const count = (re: RegExp): number =>
      totals
        .filter((t) => re.test(String(t.action)))
        .reduce((a, b) => a + Number(b._count._all), 0);

    const summary: SecurityEventsSummaryDto = {
      total: totals.reduce((a, b) => a + Number(b._count._all), 0),
      denials: count(/^security\.policy_denied$|^auth\.unauthorized_access$/),
      injectionAttempts: count(/injection/),
      dlpEvents: count(/dlp/),
      malwareEvents: count(/malware/),
      criticalCount: rows.filter(
        (r) => severityFromAction(r.action) === 'critical',
      ).length,
    };

    const events: SecurityEventDto[] = rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      category: categoryFromAction(r.action),
      severity: severityFromAction(r.action),
      resource: r.resource,
      resourceId: r.resourceId,
      ipAddress: maskIp(r.ipAddress),
      result: r.result === 'failure' ? 'failure' : 'success',
      occurredAt: r.createdAt.toISOString(),
      source: 'AuditLog',
    }));

    return {
      tenantId,
      fetchedAt: now.toISOString(),
      summary,
      events,
    };
  }
}
