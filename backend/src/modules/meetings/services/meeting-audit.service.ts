/**
 * Meeting audit service — correction workflow + version history (P3).
 *
 * Each correction writes:
 *   - an immutable audit log entry (`resource='meeting_correction'`)
 *   - a structured {@link MeetingCorrection} record kept in memory
 *
 * A separate `regenerate` action records the new version and
 * supersedes the prior summary / action set.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { MeetingCorrection } from '../schemas/meeting.types';
import { randomUUID } from 'node:crypto';

@Injectable()
export class MeetingAuditService {
  private readonly logger = new Logger(MeetingAuditService.name);
  private readonly corrections = new Map<string, MeetingCorrection[]>();
  private readonly versions = new Map<string, number>();

  constructor(private readonly audit: AuditService) {}

  async recordCorrection(input: {
    tenantId: string;
    actorId: string;
    meetingId: string;
    field: MeetingCorrection['field'];
    targetId: string;
    before: unknown;
    after: unknown;
    reason: string;
  }): Promise<MeetingCorrection> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new BadRequestException('reason required');
    }
    const correction: MeetingCorrection = {
      id: randomUUID(),
      meetingId: input.meetingId,
      tenantId: input.tenantId,
      field: input.field,
      targetId: input.targetId,
      before: input.before,
      after: input.after,
      correctedBy: input.actorId,
      correctedAt: new Date().toISOString(),
      reason: input.reason,
    };
    const key = this.key(input.tenantId, input.meetingId);
    const list = this.corrections.get(key) ?? [];
    list.push(correction);
    this.corrections.set(key, list);
    await this.audit.log({
      actor: input.actorId,
      action: 'meetings.correction.recorded',
      resource: 'meeting_correction',
      resourceId: correction.id,
      tenantId: input.tenantId,
      details: {
        meetingId: input.meetingId,
        field: input.field,
        reason: input.reason,
      },
    });
    return correction;
  }

  async regenerate(
    tenantId: string,
    actorId: string,
    meetingId: string,
  ): Promise<{ version: number }> {
    const key = this.key(tenantId, meetingId);
    const next = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, next);
    await this.audit.log({
      actor: actorId,
      action: 'meetings.summary.regenerated',
      resource: 'meeting',
      resourceId: meetingId,
      tenantId,
      details: { version: next },
    });
    return { version: next };
  }

  listCorrections(tenantId: string, meetingId: string): MeetingCorrection[] {
    return this.corrections.get(this.key(tenantId, meetingId)) ?? [];
  }

  currentVersion(tenantId: string, meetingId: string): number {
    return this.versions.get(this.key(tenantId, meetingId)) ?? 1;
  }

  private key(tenantId: string, meetingId: string): string {
    return `${tenantId}:${meetingId}`;
  }
}
