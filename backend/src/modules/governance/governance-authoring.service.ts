/**
 * Governance Authoring — custom rules + operational + security + internal.
 *
 * Source plan: §5.14.3 / §5.14.8 / §5.14.9 / §5.14.12.
 *
 * Solid:
 *   • SRP — governance authoring only. Evaluation is composed from the
 *     scheduler runner (Phase 6.2).
 *   • OCP — adding a new domain / new probe = new entry in the
 *     operational health probe catalog.
 *   • Append-only audit: OperationalHealthMetric, InternalComplianceCheck
 *     are insert-only.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  InternalComplianceCheck,
  OperationalHealthMetric,
  OperationalHealthSeverity,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

// ─── Custom governance control rules (§5.14.3) ────────────────

@Injectable()
export class CustomGovernanceControlService {
  private readonly logger = new Logger(CustomGovernanceControlService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(args: {
    tenantId: string;
    slug: string;
    displayName: string;
    description: string;
    domain: 'data' | 'user-access' | 'operational' | 'security';
    standards?: string[];
    predicate?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const validDomains = ['data', 'user-access', 'operational', 'security'];
    if (!validDomains.includes(args.domain)) {
      throw new BadRequestException(
        `domain must be one of ${validDomains.join(', ')}`,
      );
    }
    return this.prisma.governanceControlRule.create({
      data: {
        tenantId: args.tenantId,
        slug: args.slug,
        displayName: args.displayName,
        description: args.description,
        domain: args.domain,
        standards: args.standards ?? [],
        predicate: args.predicate ?? {},
      },
    });
  }

  list(tenantId: string, domain?: string) {
    return this.prisma.governanceControlRule.findMany({
      where: { tenantId, ...(domain ? { domain } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Evaluate a custom rule against an evidence row. Deterministic
   * JSON-predicate matcher (same shape as the case-triage runner).
   */
  evaluate(args: {
    tenantId: string;
    ruleId: string;
    evidence: Record<string, unknown>;
  }) {
    return this.prisma.governanceControlRule
      .findUnique({ where: { id: args.ruleId } })
      .then((rule) => {
        if (!rule) throw new NotFoundException('rule not found');
        if (rule.tenantId !== args.tenantId) {
          throw new ForbiddenException('rule belongs to a different tenant');
        }
        if (!rule.enabled) return { passed: false, reason: 'rule disabled' };
        const ok = matchesPredicate(
          rule.predicate as Record<string, unknown>,
          args.evidence,
        );
        return {
          passed: ok,
          reason: ok ? 'predicate matched' : 'predicate did not match',
        };
      });
  }
}

function matchesPredicate(
  predicate: Record<string, unknown>,
  evidence: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(predicate)) {
    const actual = evidence[key];
    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
      const ops = expected as Record<string, unknown>;
      if ('eq' in ops && actual !== ops.eq) return false;
      if ('ne' in ops && actual === ops.ne) return false;
      if ('in' in ops && Array.isArray(ops.in) && !ops.in.includes(actual)) return false;
      if ('contains' in ops && typeof actual === 'string' && !actual.includes(String(ops.contains))) return false;
      if ('gt' in ops && typeof actual === 'number' && !(actual > (ops.gt as number))) return false;
      if ('lt' in ops && typeof actual === 'number' && !(actual < (ops.lt as number))) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

// ─── Operational governance (§5.14.8) ─────────────────────────

/**
 * OPERATIONAL_PROBES — the single canonical catalog. Adding a probe
 * = new entry here. The runner reads this list and probes each in
 * sequence.
 */
export const OPERATIONAL_PROBES: ReadonlyArray<{
  key: string;
  description: string;
  category: 'license' | 'dev-flag' | 'integrity';
}> = [
  { key: 'license.expiry', description: 'License expiry within 30 days', category: 'license' },
  { key: 'dev-flag-in-prod', description: 'DEV-mode feature flags enabled in PROD', category: 'dev-flag' },
  { key: 'integrity.routine-check', description: 'Daily integrity verification of audit chain', category: 'integrity' },
];

@Injectable()
export class OperationalGovernanceService {
  private readonly logger = new Logger(OperationalGovernanceService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run every OOB probe once and append the result to the audit log.
   * Deterministic stub: each probe's outcome is decided by a hash of
   * the tenant id; real probes wire in Phase 7.5.
   */
  async runAll(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const now = new Date();
    const results: OperationalHealthMetric[] = [];
    for (const probe of OPERATIONAL_PROBES) {
      const hash = simpleHashString(`${tenantId}:${probe.key}:${now.getUTCDate()}`);
      const severity =
        hash % 7 === 0
          ? 'CRITICAL'
          : hash % 3 === 0
            ? 'WARN'
            : 'OK';
      const row = await this.prisma.operationalHealthMetric.create({
        data: {
          tenantId,
          probe: probe.key,
          severity,
          detail: {
            description: probe.description,
            category: probe.category,
          } as Prisma.InputJsonValue,
        },
      });
      results.push(row);
    }
    return results;
  }

  list(tenantId: string, severity?: string) {
    return this.prisma.operationalHealthMetric.findMany({
      where: {
        tenantId,
        ...(severity ? { severity: severity as OperationalHealthSeverity } : {}),
      },
      orderBy: { observedAt: 'desc' },
      take: 50,
    });
  }
}

// ─── Security governance (§5.14.9) ───────────────────────────

/**
 * SECURITY_CONTROL_KEYS — the canonical list of security controls
 * we surface (Redis/DB TLS, secure uploads, etc.). Phase 7.1 ships
 * the table + state recording; Phase 7.5 wires live probes.
 */
export const SECURITY_CONTROL_KEYS = [
  'redis-tls',
  'db-tls',
  'secure-uploads',
  'ai-twin-permission-mirror',
] as const;

export type SecurityControlKey = (typeof SECURITY_CONTROL_KEYS)[number];

@Injectable()
export class SecurityGovernanceService {
  private readonly logger = new Logger(SecurityGovernanceService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record (or update) the state of one security control. Idempotent
   * per (tenantId, controlKey).
   */
  async setState(args: {
    tenantId: string;
    controlKey: string;
    state: 'enabled' | 'disabled' | 'misconfigured';
    detail?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    if (!SECURITY_CONTROL_KEYS.includes(args.controlKey as SecurityControlKey)) {
      throw new BadRequestException(
        `controlKey must be one of: ${SECURITY_CONTROL_KEYS.join(', ')}`,
      );
    }
    return this.prisma.securityControlState.upsert({
      where: {
        tenantId_controlKey: {
          tenantId: args.tenantId,
          controlKey: args.controlKey,
        },
      },
      create: {
        tenantId: args.tenantId,
        controlKey: args.controlKey,
        state: args.state,
        detail: args.detail ?? {},
      },
      update: {
        state: args.state,
        detail: args.detail ?? {},
      },
    });
  }

  list(tenantId: string) {
    return this.prisma.securityControlState.findMany({
      where: { tenantId },
      orderBy: { controlKey: 'asc' },
    });
  }
}

// ─── Internal compliance checks (§5.14.12) ─────────────────

/**
 * INTERNAL_COMPLIANCE_CHECKS — the canonical check catalog.
 */
export const INTERNAL_COMPLIANCE_CHECKS: ReadonlyArray<{
  category: 'operational' | 'management' | 'it';
  name: string;
  description: string;
}> = [
  { category: 'operational', name: 'daily-audit-trail-verify', description: 'Verify the audit-log chain hash for the previous day.' },
  { category: 'operational', name: 'weekly-completeness-recompute', description: 'Recompute control completeness.' },
  { category: 'management', name: 'monthly-access-review', description: 'Review admin-role assignments.' },
  { category: 'management', name: 'quarterly-policy-attestation', description: 'Re-attest every active governance control.' },
  { category: 'it', name: 'tls-renewal-check', description: 'Verify TLS certificate expiry > 30 days.' },
  { category: 'it', name: 'secret-rotation-check', description: 'Verify every secret was rotated within 90 days.' },
];

@Injectable()
export class InternalComplianceService {
  private readonly logger = new Logger(InternalComplianceService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run every OOB internal check once. Deterministic stub.
   */
  async runAll(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const now = new Date();
    const results: InternalComplianceCheck[] = [];
    for (const check of INTERNAL_COMPLIANCE_CHECKS) {
      const hash = simpleHashString(
        `${tenantId}:${check.name}:${now.getUTCMonth()}`,
      );
      const outcome = hash % 5 === 0 ? 'FAIL' : 'PASS';
      const row = await this.prisma.internalComplianceCheck.create({
        data: {
          tenantId,
          category: check.category,
          checkName: check.name,
          outcome,
          detail: { description: check.description } as Prisma.InputJsonValue,
        },
      });
      results.push(row);
    }
    return results;
  }

  list(tenantId: string, category?: string) {
    return this.prisma.internalComplianceCheck.findMany({
      where: { tenantId, ...(category ? { category } : {}) },
      orderBy: { ranAt: 'desc' },
      take: 50,
    });
  }
}

function simpleHashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
