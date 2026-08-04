/**
 * SLA Timer — Append-only GDPR Article 12(3) + case SLA enforcement.
 *
 * Source plan: §5.4.8 (GDPR — Article 12(3) 30-day response timer) +
 * §5.9.5 (SLA intelligence).
 *
 * Solid:
 *   • SRP — only SLA open + escalation + resolution. The actual data
 *     remediation (export zip generation, case deletion) lives in
 *     dedicated services.
 *   • OCP — adding a new SLA policy = new entry in `SLA_POLICIES`.
 *   • Append-only: SLAEvent is insert-only at the service layer.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface SlaPolicy {
  id: string;
  durationDays: number;
  description: string;
}

/**
 * SLA_POLICIES — single canonical list. Adding a policy = new row;
 * no other code changes.
 */
export const SLA_POLICIES: Readonly<Record<string, SlaPolicy>> = {
  'gdpr-art12-3': {
    id: 'gdpr-art12-3',
    durationDays: 30,
    description: 'GDPR Article 12(3) — DSR response within 30 days.',
  },
  'case-first-response': {
    id: 'case-first-response',
    durationDays: 1,
    description: 'Service case first response within 24h.',
  },
  'case-resolution': {
    id: 'case-resolution',
    durationDays: 7,
    description: 'Service case resolution within 7 days.',
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SlaTimerService {
  private readonly logger = new Logger(SlaTimerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Open + close ─────────────────────────────────────────────

  async open(args: {
    tenantId: string;
    subjectId: string;
    subjectKind: string;
    policy: string;
    openedAt?: Date;
  }) {
    const p = SLA_POLICIES[args.policy];
    if (!p) {
      throw new Error(`unknown SLA policy "${args.policy}"`);
    }
    if (!args.tenantId || args.tenantId === '*') {
      throw new Error('tenantId "*" is forbidden');
    }
    const openedAt = args.openedAt ?? new Date();
    const dueAt = new Date(openedAt.getTime() + p.durationDays * MS_PER_DAY);
    return this.prisma.sLAEvent.create({
      data: {
        tenantId: args.tenantId,
        subjectId: args.subjectId,
        subjectKind: args.subjectKind,
        policy: args.policy,
        dueAt,
        status: 'OPEN',
      },
    });
  }

  async resolve(args: {
    tenantId: string;
    id: string;
    resolution: string;
  }) {
    const existing = await this.prisma.sLAEvent.findUnique({
      where: { id: args.id },
    });
    if (!existing) throw new Error(`SLA event ${args.id} not found`);
    if (existing.tenantId !== args.tenantId) {
      throw new Error('SLA event belongs to a different tenant');
    }
    if (existing.status !== 'OPEN') {
      throw new Error(`SLA event is already ${existing.status}`);
    }
    return this.prisma.sLAEvent.update({
      where: { id: args.id },
      data: {
        status: 'MET',
        resolvedAt: new Date(),
        resolution: args.resolution,
      },
    });
  }

  // ─── Escalation ───────────────────────────────────────────────

  /**
   * Find every OPEN SLA event whose dueAt is in the past and mark it
   * ESCALATED. Idempotent. Returns the list of newly-escalated events.
   */
  async escalateOverdue(now: Date = new Date()): Promise<Array<{ id: string; subjectId: string; policy: string }>> {
    const overdue = await this.prisma.sLAEvent.findMany({
      where: { status: 'OPEN', dueAt: { lt: now } },
      take: 100,
    });
    if (overdue.length === 0) return [];
    await this.prisma.sLAEvent.updateMany({
      where: { id: { in: overdue.map((e) => e.id) }, status: 'OPEN' },
      data: { status: 'ESCALATED', escalatedAt: now },
    });
    this.logger.warn(`escalated ${overdue.length} overdue SLA event(s)`);
    return overdue.map((e) => ({
      id: e.id,
      subjectId: e.subjectId,
      policy: e.policy,
    }));
  }

  // ─── Read helpers ──────────────────────────────────────────────

  async list(tenantId: string, status?: string) {
    return this.prisma.sLAEvent.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  listPolicies(): Readonly<Record<string, SlaPolicy>> {
    return SLA_POLICIES;
  }
}
