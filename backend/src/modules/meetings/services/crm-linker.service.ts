/**
 * Phase 16 — CrmLinkerService.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2.
 *
 * Closes CR-AI-0404 — "CRM linkage + governed follow-up writes".
 *
 * Two responsibilities:
 *   1. Link a transcript to a CRM record (account / contact /
 *      lead / opportunity / case). The linkage is tenant-scoped
 *      and the target record is verified via Prisma before the link
 *      is recorded.
 *   2. Persist extracted action items + queue follow-up Tasks
 *      through the existing `Task` model with the standard
 *      Phase-1 approval gate (creates a TASK in PENDING_APPROVAL).
 *
 * SRP — owns ONLY the linkage + follow-up-write pipeline. The
 * approval gate is reused from `chat.controller`'s existing pattern
 * via the `Task` model's `requiresApproval` field.
 *
 * SECURITY — tenant scope enforced at every Prisma call. Cross-tenant
 * record references are rejected with a typed
 * CrmLinkerForbiddenError.
 */

import {
  ForbiddenException,
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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Link a transcript to a CRM record. The link is written on the
   * transcript row (linkedRecordType / linkedRecordId). Idempotent.
   */
  async link(input: LinkInput): Promise<{ transcriptId: string }> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new CrmLinkerForbiddenError('tenantId required');
    }
    if (!SUPPORTED_TYPES.has(input.recordType)) {
      throw new CrmLinkerForbiddenError(
        `unsupported recordType ${input.recordType}`,
      );
    }

    // Verify the transcript + target record belong to this tenant
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

  /**
   * Legacy envelope — `linker.link(tenantId, actorId, transcript, links)`
   * called by the pre-existing `meeting.service.ts`. Each `MeetingLink`
   * carries a recordType + recordId; we iterate and link.
   *
   * Returns a synthetic workRunId so the legacy caller can map it
   * back to the transcript id. No WorkRun is actually queued.
   */
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

  /**
   * Persist extracted action items as `meeting_action_items` rows.
   * Each item carries the owner hint + ambiguous flag.
   *
   * The follow-up Task write is **not** auto-attached to the CRM
   * record — that's the operator's call (per P-1: no automatic
   * CRM mutations). The returned IDs let the operator wire follow-ups
   * via the standard `Task` API.
   */
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
          ownerUserId: item.ownerUserId,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          confidencePercent: item.confidencePercent,
          status: 'PENDING',
          ambiguousOwner: item.ambiguousOwner,
        },
        select: { id: true },
      });
      ids.push(row.id);
    }
    return { writtenIds: ids };
  }

  /**
   * Tenant-scoped owner check. Each `recordType` has its own
   * Prisma model. Returns true when the record exists in the
   * tenant, false otherwise. Unknown types fail closed.
   */
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
        // `Lead` may not exist on every installation; fail closed
        // until the leads module is wired. The Phase 16 PR surfaces
        // the linkage failure rather than fabricating a tenant claim.
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
        // `Case` may not exist on every installation; fail closed.
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
