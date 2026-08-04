/**
 * No-Code Governance Composition — Phase 9.3, §5.4.16.
 *
 * Per v2 plan, this capability is "composed" from Phase 2's Governance
 * surface rather than implemented as a separate module. This file
 * documents the composition contract and provides a single read-only
 * surface that downstream consumers (UI dashboards, matrix update
 * scripts) can call to render the current posture.
 *
 * Solid: SRP — read-only surface that aggregates Phase 2 / 7 data.
 * Append-only audit: this service writes nothing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export type GovernanceDomain =
  | 'data'
  | 'user-access'
  | 'operational'
  | 'security';

export interface GovernanceDomainPosture {
  domain: GovernanceDomain;
  totalControls: number;
  enabledControls: number;
  failingControls: number;
  // Average score across the last evaluation per control in this domain.
  averageScore: number | null;
  // Most recent scheduled run timestamp in this domain.
  lastEvaluatedAt: string | null;
}

export interface GovernanceComposition {
  tenantId: string;
  generatedAt: string;
  domains: GovernanceDomainPosture[];
  customRuleCount: number;
  securityControlCount: number;
}

@Injectable()
export class GovernanceCompositionService {
  private readonly logger = new Logger(GovernanceCompositionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compose a single Governance posture snapshot from the
   * Phase 2 + Phase 7 tables. Read-only.
   */
  async compose(tenantId: string): Promise<GovernanceComposition> {
    const controls = await this.prisma.governanceControl.findMany({
      where: { tenantId },
      select: { id: true, domain: true, status: true },
    });
    const evaluations = await this.prisma.governanceControlEvaluation.findMany({
      where: { tenantId },
      orderBy: { finishedAt: 'desc' },
    });
    const customRules = await this.prisma.governanceControlRule.count({
      where: { tenantId },
    });
    const securityStates = await this.prisma.securityControlState.count({
      where: { tenantId },
    });

    const lastByControl = new Map<string, { score: number | null; failed: boolean; ranAt: Date }>();
    for (const e of evaluations) {
      if (!lastByControl.has(e.controlId)) {
        lastByControl.set(e.controlId, {
          score: e.score,
          failed: e.outcome === 'FAIL' || e.outcome === 'ERROR',
          ranAt: e.finishedAt,
        });
      }
    }

    const domains: GovernanceDomainPosture[] = (['data', 'user-access', 'operational', 'security'] as GovernanceDomain[]).map((domain) => {
      const inDomain = controls.filter((c) => c.domain === domain);
      const enabled = inDomain.filter((c) => c.status === 'ACTIVE').length;
      let failing = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      let lastRanAt: Date | null = null;
      for (const c of inDomain) {
        const last = lastByControl.get(c.id);
        if (!last) continue;
        if (last.failed) failing++;
        if (last.score !== null) {
          scoreSum += last.score;
          scoreCount++;
        }
        if (!lastRanAt || last.ranAt > lastRanAt) lastRanAt = last.ranAt;
      }
      return {
        domain,
        totalControls: inDomain.length,
        enabledControls: enabled,
        failingControls: failing,
        averageScore: scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : null,
        lastEvaluatedAt: lastRanAt ? lastRanAt.toISOString() : null,
      };
    });

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      domains,
      customRuleCount: customRules,
      securityControlCount: securityStates,
    };
  }
}
