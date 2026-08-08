/**
 * Phase 25 — CrmLinkerService.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2 + P25 upgrade.
 *
 * Closes CR-AI-0404 — "CRM linkage + governed follow-up writes".
 *
 * Phase 25 upgrade: write-back to live CRM records. The service
 * already linked a transcript to a CRM row. It now also appends
 * the meeting-derived touchpoint to `customer_touchpoint_events`
 * (idempotent on `(tenantId, channelKind, externalId)`) so the
 * downstream pipeline (cases, lifecycle, sales agent) sees the
 * meeting event as a live CRM signal.
 *
 * SOLID:
 *   - SRP — owns ONLY the linkage + write-back. Approval gating
 *     is the operator's call (the meeting notes do NOT auto-mutate
 *     `Deal.amount` or `Deal.stage`; those stay operator-driven).
 *   - DIP — depends only on injected `PrismaService` and the
 *     `AuditService` seam for evidence. No HTTP, no LLM, no
 *     global state.
 *
 * SECURITY — tenant scope enforced at every Prisma call. The
 * `tenantScopedOwnerCheck` is the structural guard: cross-tenant
 * record references are rejected with `CrmLinkerForbiddenError`.
 */

import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ExtractedActionItem } from './action-extractor.service';

export class CrmLinkerForbiddenError extends ForbiddenException {
  constructor(message: string) {
    super(message);
    this.name = 'CrmLinkerForbiddenError';
  }
}

export type CrmRecordType =
  | 'account'
  | 'contact'
  | 'lead'
  | 'opportunity'
  | 'case';

export interface LinkInput {
  readonly tenantId: string;
  readonly transcriptId: string;
  readonly recordType: CrmRecordType;
  readonly recordId: string;
}

export interface PersistActionInput {
  readonly tenantId: string;
  readonly transcriptId: string;
  readonly items: ReadonlyArray<ExtractedActionItem | {
    readonly description: string;
    readonly ownerUserId?: string | null;
    readonly ownerHint?: string | null;
    readonly dueDate?: string | null;
    readonly confidencePercent?: number;
    readonly ambiguousOwner?: boolean;
  }>;
}

export interface WriteBackInput {
  readonly tenantId: string;
  readonly transcriptId: string;
  readonly channelKind: string;
  readonly subject: string;
  readonly body?: string;
  readonly occurredAt: Date;
  readonly tags?: ReadonlyArray<string>;
}

export interface WriteBackResult {
  readonly touchpointId: string;
  readonly idempotent: boolean;
}

const SUPPORTED_TYPES = new Set<CrmRecordType>([
  'account',
  'contact',
  'lead',
  'opportunity',
  'case',
]);

@Injectable()
export class CrmLinkerService {
  private readonly logger = new Logger(CrmLinkerService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async link(input: LinkInput): Promise<{ transcriptId: string }> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new CrmLinkerForbiddenError('tenantId required');
    }
    if (!SUPPORTED_TYPES.has(input.recordType)) {
      throw new CrmLinkerForbiddenError(
        `unsupported recordType ${input.recordType}`,
      );
    }

    const transcript = await this.prisma.meetingTranscript.findFirst({
      where: { tenantId: input.tenantId, id: input.transcriptId },
      select: { id: true },
    });
    if (!transcript) {
      throw new NotFoundException(
        `transcript ${input.transcriptId} not found in tenant ${input.tenantId}`,
      );
    }

    const owned = await this.tenantScopedOwnerCheck(
      input.tenantId,
      input.recordType,
      input.recordId,
    );
    if (!owned) {
      throw new CrmLinkerForbiddenError(
        `${input.recordType}:${input.recordId} does not belong to tenant ${input.tenantId}`,
      );
    }

    await this.prisma.meetingTranscript.update({
      where: { id: input.transcriptId },
      data: {
        linkedRecordType: input.recordType,
        linkedRecordId: input.recordId,
        status: 'LINKED',
      },
    });
    return { transcriptId: input.transcriptId };
  }

  async linkLegacy(
    tenantId: string,
    actorId: string,
    transcript: { id: string },
    links: ReadonlyArray<{ recordType: string; recordId: string }>,
  ): Promise<{ workRunId: string }> {
    if (!tenantId || tenantId === '*') {
      throw new CrmLinkerForbiddenError('tenantId required');
    }
    if (!actorId) {
      throw new CrmLinkerForbiddenError('actorId required');
    }
    void actorId;
    for (const l of links) {
      if (!SUPPORTED_TYPES.has(l.recordType as CrmRecordType)) continue;
      await this.link({
        tenantId,
        transcriptId: transcript.id,
        recordType: l.recordType as CrmRecordType,
        recordId: l.recordId,
      });
    }
    return { workRunId: `link_${transcript.id}_${Date.now()}` };
  }

  async persistActionItems(
    input: PersistActionInput,
  ): Promise<{ writtenIds: ReadonlyArray<string> }> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new CrmLinkerForbiddenError('tenantId required');
    }
    if (input.items.length === 0) return { writtenIds: [] };

    const ids: string[] = [];
    for (const item of input.items) {
      const row = await this.prisma.meetingActionItem.create({
        data: {
          tenantId: input.tenantId,
          transcriptId: input.transcriptId,
          description: item.description,
          ownerUserId: item.ownerUserId ?? null,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          confidencePercent: item.confidencePercent ?? 0,
          status: 'PENDING',
          ambiguousOwner: item.ambiguousOwner ?? false,
        },
        select: { id: true },
      });
      ids.push(row.id);
    }
    return { writtenIds: ids };
  }

  /**
   * Phase 25 — write-back to live CRM records. Appends a row to
   * `customer_touchpoint_events` keyed by
   * `(tenantId, channelKind, externalId=transcriptId)` so the
   * downstream pipeline (lifecycle, sales agent) sees the meeting
   * event as a touchpoint.
   *
   * Idempotent: replays of the same transcript touchpoint return
   * the existing row with `idempotent=true`.
   */
  async writeBack(input: WriteBackInput): Promise<WriteBackResult> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new CrmLinkerForbiddenError('tenantId required');
    }
    const transcript = await this.prisma.meetingTranscript.findFirst({
      where: { tenantId: input.tenantId, id: input.transcriptId },
      select: {
        id: true,
        linkedRecordType: true,
        linkedRecordId: true,
      },
    });
    if (!transcript) {
      throw new NotFoundException(
        `transcript ${input.transcriptId} not found in tenant ${input.tenantId}`,
      );
    }
    // Determine the customer id from the linked record.
    const customerId = await this.resolveCustomerId(
      input.tenantId,
      transcript.linkedRecordType as CrmRecordType | null,
      transcript.linkedRecordId,
    );
    if (!customerId) {
      // No linked record — the write-back is rejected with a
      // typed error so the operator links the transcript first.
      throw new CrmLinkerForbiddenError(
        `transcript ${input.transcriptId} has no linked CRM record; call link() before writeBack()`,
      );
    }
    const existing = await this.prisma.customerTouchpointEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        channelKind: input.channelKind,
        externalId: input.transcriptId,
      },
      select: { id: true },
    });
    if (existing) {
      return { touchpointId: existing.id, idempotent: true };
    }
    const created = await this.prisma.customerTouchpointEvent.create({
      data: {
        tenantId: input.tenantId,
        customerId,
        channelKind: input.channelKind,
        externalId: input.transcriptId,
        payload: {
          subject: input.subject,
          body: input.body ?? '',
          transcriptId: input.transcriptId,
          tags: [...(input.tags ?? [])],
        },
        occurredAt: input.occurredAt,
        tags: [...(input.tags ?? [])],
      },
      select: { id: true },
    });
    return { touchpointId: created.id, idempotent: false };
  }

  private async resolveCustomerId(
    tenantId: string,
    recordType: CrmRecordType | null,
    recordId: string | null,
  ): Promise<string | null> {
    if (!recordType || !recordId) return null;
    switch (recordType) {
      case 'account': {
        const c = await this.prisma.customer.findFirst({
          where: { id: recordId, tenantId },
          select: { id: true },
        });
        return c?.id ?? null;
      }
      case 'contact': {
        const c = await this.prisma.customerContact.findFirst({
          where: { id: recordId, customer: { tenantId } },
          select: { customerId: true },
        });
        return c?.customerId ?? null;
      }
      case 'opportunity': {
        const d = await this.prisma.deal.findFirst({
          where: { id: recordId, tenantId, deletedAt: null },
          select: { customerId: true },
        });
        return d?.customerId ?? null;
      }
      case 'lead':
      case 'case':
        return null;
      default:
        return null;
    }
  }

  private async tenantScopedOwnerCheck(
    tenantId: string,
    recordType: CrmRecordType,
    recordId: string,
  ): Promise<boolean> {
    switch (recordType) {
      case 'account': {
        const r = await this.prisma.customer.findFirst({
          where: { id: recordId, tenantId },
          select: { id: true },
        });
        return Boolean(r);
      }
      case 'contact': {
        const r = await this.prisma.customerContact.findFirst({
          where: { id: recordId, customer: { tenantId } },
          select: { id: true },
        });
        return Boolean(r);
      }
      case 'lead': {
        return false;
      }
      case 'opportunity': {
        const r = await this.prisma.deal.findFirst({
          where: { id: recordId, tenantId, deletedAt: null },
          select: { id: true },
        });
        return Boolean(r);
      }
      case 'case': {
        const any = this.prisma as unknown as {
          case?: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
        };
        if (typeof any.case?.findFirst !== 'function') return false;
        const r = await any.case.findFirst({
          where: { id: recordId, tenantId },
          select: { id: true },
        });
        return Boolean(r);
      }
      default:
        return false;
    }
  }
}
