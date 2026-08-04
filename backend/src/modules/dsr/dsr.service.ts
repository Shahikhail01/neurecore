/**
 * DSR (Data Subject Request) — Service.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.4.8 (GDPR).
 *
 * Implements the GDPR Article 15-22 workflow as a finite state machine
 * with append-only audit. Every state transition writes a DsrAuditLog row.
 *
 * State machine:
 *   OPEN → IN_PROGRESS → COMPLETED
 *                     ↘ REJECTED (with reason)
 *   OPEN → CANCELLED (by requester)
 *
 * Solid:
 *   • SRP — only DSR workflow rules. The actual data remediation
 *     (export zip generation, contact/user deletion) is a separate
 *     concern owned by the tenant-data services.
 *   • OCP — adding a new state transition is a new branch in
 *     `transition`. No other code changes.
 *   • DIP — depends on the PrismaService and the audit log surface.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DsrAuditAction,
  DsrRequestStatus,
  DsrRequestType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

export interface OpenDsrInput {
  tenantId: string;
  type: DsrRequestType;
  subjectId: string;
  subjectKind?: string;
  requesterId: string;
  reason?: string;
}

const ALLOWED_TRANSITIONS: Record<DsrRequestStatus, DsrRequestStatus[]> = {
  [DsrRequestStatus.OPEN]: [DsrRequestStatus.IN_PROGRESS, DsrRequestStatus.CANCELLED, DsrRequestStatus.REJECTED],
  [DsrRequestStatus.IN_PROGRESS]: [DsrRequestStatus.COMPLETED, DsrRequestStatus.REJECTED],
  [DsrRequestStatus.COMPLETED]: [],
  [DsrRequestStatus.REJECTED]: [],
  [DsrRequestStatus.CANCELLED]: [],
};

@Injectable()
export class DsrService {
  private readonly logger = new Logger(DsrService.name);

  constructor(private readonly prisma: PrismaService) {}

  async openRequest(input: OpenDsrInput) {
    if (!input.tenantId || input.tenantId === '*') {
      throw new ForbiddenException('tenantId required and may not be "*"');
    }
    if (!input.subjectId) {
      throw new BadRequestException('subjectId required');
    }
    if (!input.requesterId) {
      throw new BadRequestException('requesterId required');
    }
    const created = await this.prisma.dsrRequest.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        status: DsrRequestStatus.OPEN,
        subjectId: input.subjectId,
        subjectKind: input.subjectKind ?? 'user',
        requesterId: input.requesterId,
        reason: input.reason,
      },
    });
    await this.appendAudit(input.tenantId, created.id, input.requesterId, {
      action: DsrAuditAction.OPENED,
      previousState: {},
      newState: { status: DsrRequestStatus.OPEN, type: input.type, subjectId: input.subjectId },
      reason: input.reason,
    });
    return created;
  }

  async startRequest(
    tenantId: string,
    id: string,
    actorId: string,
  ) {
    return this.transition(tenantId, id, actorId, {
      action: DsrAuditAction.STARTED,
      target: DsrRequestStatus.IN_PROGRESS,
      setFields: { startedAt: new Date() },
    });
  }

  async completeRequest(
    tenantId: string,
    id: string,
    actorId: string,
    resolution: Record<string, unknown>,
    reason?: string,
  ) {
    return this.transition(tenantId, id, actorId, {
      action: DsrAuditAction.COMPLETED,
      target: DsrRequestStatus.COMPLETED,
      setFields: { completedAt: new Date(), resolution: resolution as Prisma.InputJsonValue },
      reason,
    });
  }

  async rejectRequest(
    tenantId: string,
    id: string,
    actorId: string,
    reason: string,
  ) {
    return this.transition(tenantId, id, actorId, {
      action: DsrAuditAction.REJECTED,
      target: DsrRequestStatus.REJECTED,
      reason,
    });
  }

  async cancelRequest(
    tenantId: string,
    id: string,
    actorId: string,
    reason?: string,
  ) {
    return this.transition(tenantId, id, actorId, {
      action: DsrAuditAction.CANCELLED,
      target: DsrRequestStatus.CANCELLED,
      setFields: { cancelledAt: new Date() },
      reason,
    });
  }

  async listRequests(
    tenantId: string,
    args: { status?: DsrRequestStatus; type?: DsrRequestType; skip?: number; take?: number } = {},
  ) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId required');
    }
    return this.prisma.dsrRequest.findMany({
      where: {
        tenantId,
        ...(args.status ? { status: args.status } : {}),
        ...(args.type ? { type: args.type } : {}),
      },
      orderBy: { openedAt: 'desc' },
      skip: args.skip,
      take: args.take ?? 50,
    });
  }

  async findById(tenantId: string, id: string) {
    const found = await this.prisma.dsrRequest.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`DSR request ${id} not found`);
    if (found.tenantId !== tenantId) {
      throw new ForbiddenException(
        `DSR request ${id} belongs to a different tenant`,
      );
    }
    return found;
  }

  async listAudit(tenantId: string, id: string) {
    await this.findById(tenantId, id); // tenant check
    return this.prisma.dsrAuditLog.findMany({
      where: { tenantId, dsrId: id },
      orderBy: { occurredAt: 'desc' },
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────

  private async transition(
    tenantId: string,
    id: string,
    actorId: string,
    spec: {
      action: DsrAuditAction;
      target: DsrRequestStatus;
      setFields?: Prisma.DsrRequestUncheckedUpdateInput;
      reason?: string;
    },
  ) {
    const current = await this.findById(tenantId, id);
    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(spec.target)) {
      throw new BadRequestException(
        `invalid transition: ${current.status} -> ${spec.target}`,
      );
    }
    const updated = await this.prisma.dsrRequest.update({
      where: { id },
      data: { status: spec.target, ...(spec.setFields ?? {}) },
    });
    await this.appendAudit(tenantId, id, actorId, {
      action: spec.action,
      previousState: { status: current.status },
      newState: { status: spec.target },
      reason: spec.reason,
    });
    return updated;
  }

  private async appendAudit(
    tenantId: string,
    dsrId: string,
    actorId: string,
    body: {
      action: DsrAuditAction;
      previousState: Record<string, unknown>;
      newState: Record<string, unknown>;
      reason?: string;
    },
  ) {
    await this.prisma.dsrAuditLog.create({
      data: {
        tenantId,
        dsrId,
        actorId,
        action: body.action,
        previousState: body.previousState as Prisma.InputJsonValue,
        newState: body.newState as Prisma.InputJsonValue,
        reason: body.reason,
      },
    });
  }
}
