/**
 * Governance Application — Service.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.14.
 *
 * Covers the 4 governance domains (data, user-access, operational,
 * security) by composing the Control Library and the audit log surface.
 *
 * Solid:
 *   • SRP — only governance business rules. The actual evaluation engine
 *     is a separate concern (ControlEngineService).
 *   • OCP — new control categories extend this file by adding branches
 *     to the per-domain factory.
 */

import { Injectable, Logger } from '@nestjs/common';
import { GovernanceControlOrigin } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';

export type GovernanceDomain =
  | 'data'
  | 'user-access'
  | 'operational'
  | 'security';

export interface PredefinedControlSeed {
  slug: string;
  displayName: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  domain: GovernanceDomain;
  standards: string[];
  cadence: string;
}

const PREDEFINED_CONTROLS: PredefinedControlSeed[] = [
  // ─── Data governance (§5.14.6) ───
  {
    slug: 'data-access-sensitive',
    displayName: 'Sensitive data access audited',
    description:
      'Every read of a customer record generates an audit-log entry within 24h.',
    severity: 'HIGH',
    domain: 'data',
    standards: ['AICPA_SOC2', 'HIPAA', 'GDPR', 'ISO_27001'],
    cadence: 'DAILY',
  },
  {
    slug: 'data-deletion-receipt',
    displayName: 'Data deletion produces a signed receipt',
    description:
      'GDPR Article 17 deletions write a signed evidence record to the audit log.',
    severity: 'CRITICAL',
    domain: 'data',
    standards: ['GDPR'],
    cadence: 'WEEKLY',
  },
  // ─── User-access governance (§5.14.7) ───
  {
    slug: 'admin-role-justified',
    displayName: 'Admin role assignments reviewed',
    description:
      'Users with ADMIN role have a justification comment recorded within the last 30 days.',
    severity: 'HIGH',
    domain: 'user-access',
    standards: ['AICPA_SOC2', 'ISO_27001'],
    cadence: 'WEEKLY',
  },
  {
    slug: 'session-expiry-enforced',
    displayName: 'Inactive sessions auto-expire',
    description:
      'Users inactive for >30 days have their sessions invalidated and the event audited.',
    severity: 'MEDIUM',
    domain: 'user-access',
    standards: ['AICPA_SOC2', 'HIPAA'],
    cadence: 'DAILY',
  },
  // ─── Operational governance (§5.14.8) ───
  {
    slug: 'license-expiry-warn',
    displayName: 'License expiry notifications sent',
    description:
      'Tenants with subscriptions expiring in 7 days receive an admin notification.',
    severity: 'MEDIUM',
    domain: 'operational',
    standards: ['ISO_27001'],
    cadence: 'DAILY',
  },
  {
    slug: 'dev-in-prod-blocked',
    displayName: 'Development features disabled in production',
    description:
      'DEV-mode flags cannot be toggled in PRODUCTION environments.',
    severity: 'CRITICAL',
    domain: 'operational',
    standards: ['AICPA_SOC2', 'ISO_27001'],
    cadence: 'DAILY',
  },
  // ─── Security governance (§5.14.9) ───
  {
    slug: 'redis-connection-tls',
    displayName: 'Redis connection over TLS',
    description:
      'Redis connection enforces TLS 1.2+; plaintext connections are refused.',
    severity: 'CRITICAL',
    domain: 'security',
    standards: ['AICPA_SOC2', 'HIPAA', 'ISO_27001'],
    cadence: 'DAILY',
  },
  {
    slug: 'db-connection-tls',
    displayName: 'Database connection over TLS',
    description:
      'Postgres connection enforces TLS 1.2+; plaintext connections are refused.',
    severity: 'CRITICAL',
    domain: 'security',
    standards: ['AICPA_SOC2', 'HIPAA', 'ISO_27001'],
    cadence: 'DAILY',
  },
  {
    slug: 'secure-uploads',
    displayName: 'Secure upload surface',
    description:
      'File uploads are scanned (clamd) and stored in tenant-isolated paths.',
    severity: 'HIGH',
    domain: 'security',
    standards: ['HIPAA', 'ISO_27001'],
    cadence: 'DAILY',
  },
  {
    slug: 'ai-twin-permission-mirror',
    displayName: 'AI Twin permission mirror enforced',
    description:
      'Every AI Twin action is evaluated against the actor’s permissions; wildcard tenant id is refused.',
    severity: 'HIGH',
    domain: 'security',
    standards: ['EU_AI_ACT', 'ISO_27001'],
    cadence: 'DAILY',
  },
];

export interface GovernanceDomainSummary {
  domain: GovernanceDomain;
  displayName: string;
  total: number;
  passing: number;
  failing: number;
}

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  private static readonly DOMAIN_LABELS: Record<GovernanceDomain, string> = {
    data: 'Data Governance',
    'user-access': 'User Access Governance',
    operational: 'Operational Governance',
    security: 'Security Governance',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Seed the predefined controls for a tenant on first activation. Idempotent.
   */
  async seedPredefinedControlsForTenant(tenantId: string): Promise<number> {
    if (!tenantId || tenantId === '*') {
      throw new Error('seedPredefinedControlsForTenant requires a real tenantId');
    }
    let created = 0;
    for (const seed of PREDEFINED_CONTROLS) {
      const existing = await this.prisma.governanceControl.findUnique({
        where: { tenantId_slug: { tenantId, slug: seed.slug } },
      });
      if (existing) continue;
      // Predefined controls are owned by the platform (tenantId=null), but
      // we still need a per-tenant enabled record so the control surface
      // is tenant-aware. We model "tenant activates the predefined control"
      // by storing the tenant-specific activation with origin=PREDEFINED
      // and slug including the tenant id in metadata.
      await this.prisma.governanceControl.create({
        data: {
          tenantId,
          slug: seed.slug,
          displayName: seed.displayName,
          description: seed.description,
          severity: seed.severity,
          status: 'ACTIVE',
          origin: GovernanceControlOrigin.PREDEFINED,
          domain: seed.domain,
          standards: seed.standards,
          rule: {
            predefinedSlug: seed.slug,
            cadence: seed.cadence,
          },
          cadence: seed.cadence,
        },
      });
      created++;
    }
    return created;
  }

  listPredefinedControlSeeds(): PredefinedControlSeed[] {
    return [...PREDEFINED_CONTROLS];
  }

  async getDomainSummary(tenantId: string): Promise<GovernanceDomainSummary[]> {
    if (!tenantId || tenantId === '*') {
      throw new Error('getDomainSummary requires a real tenantId');
    }
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.governanceControl.findMany({
      where: { tenantId },
      select: {
        domain: true,
        evaluations: {
          where: { finishedAt: { gte: since } },
          orderBy: { finishedAt: 'desc' },
          take: 1,
          select: { outcome: true },
        },
      },
    });
    const grouped = new Map<GovernanceDomain, GovernanceDomainSummary>();
    for (const row of rows) {
      const domain = row.domain as GovernanceDomain;
      if (!grouped.has(domain)) {
        grouped.set(domain, {
          domain,
          displayName: GovernanceService.DOMAIN_LABELS[domain],
          total: 0,
          passing: 0,
          failing: 0,
        });
      }
      const summary = grouped.get(domain)!;
      summary.total++;
      const last = row.evaluations[0]?.outcome;
      if (last === 'PASS') summary.passing++;
      else if (last === 'FAIL' || last === 'ERROR') summary.failing++;
    }
    return Array.from(grouped.values());
  }
}
