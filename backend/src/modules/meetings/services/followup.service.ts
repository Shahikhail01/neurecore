/**
 * Follow-up draft service — composes email + calendar event drafts
 * from a meeting summary and queued action items (P3).
 *
 * Like {@link CrmLinkerService}, all writes go through Work Runtime.
 * The service itself is pure: it returns a draft preview the UI can
 * show to the user before they approve the governed execution.
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  WORK_RUNTIME,
  type IWorkRuntime,
} from '../../work-runtime/contracts/work-runtime.interface';
import type {
  ActionItem,
  FollowUpDraft,
  MeetingSummary,
  MeetingTranscript,
} from '../schemas/meeting.types';

@Injectable()
export class FollowupService {
  private readonly logger = new Logger(FollowupService.name);

  constructor(
    private readonly audit: AuditService,
    @Inject(WORK_RUNTIME) private readonly workRuntime: IWorkRuntime,
  ) {}

  /** Compose a draft preview from transcript + summary + action items. */
  compose(
    transcript: MeetingTranscript,
    summary: MeetingSummary,
    actionItems: ActionItem[],
  ): FollowUpDraft {
    if (!transcript) throw new BadRequestException('transcript required');
    const unresolved = actionItems.filter(
      (a) => a.ownerStatus === 'unresolved',
    );
    const resolved = actionItems.filter((a) => a.ownerStatus === 'resolved');

    const emailBody = [
      `Subject: ${transcript.title}`,
      '',
      'Hi team,',
      '',
      `Thanks for joining the meeting on ${transcript.startedAt.slice(0, 10)}. ` +
        `Below is a quick recap and the agreed next steps.`,
      '',
      '--- Recap ---',
      ...summary.sections.flatMap((s) => [
        `${s.title}:`,
        ...s.bullets.map((b) => `  - ${b}`),
        '',
      ]),
      '--- Action Items ---',
      ...resolved.map(
        (a) =>
          `  - [${a.ownerDisplayName ?? 'unassigned'}] ${a.text}${a.dueDate ? ` (by ${a.dueDate})` : ''}`,
      ),
      ...(unresolved.length
        ? [
            '',
            'Unresolved (please confirm owner):',
            ...unresolved.map((a) => `  - ${a.text}`),
          ]
        : []),
    ].join('\n');

    const startAt = new Date(
      new Date(transcript.endedAt).getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    const calendarEvent = {
      title: `Follow-up: ${transcript.title}`,
      description: `Recap and action items from meeting ${transcript.id}.`,
      startAt,
      durationMinutes: 30,
      attendees: transcript.participants
        .filter((p) => p.resolutionStatus === 'resolved')
        .map((p) => p.rawId),
    };

    return {
      email: { subject: `Follow-up: ${transcript.title}`, body: emailBody },
      calendarEvent,
    };
  }

  /**
   * Queue a WorkRun that sends the email and creates the calendar
   * event. Returns the work run id for caller polling / approval.
   */
  async dispatch(
    tenantId: string,
    actorId: string,
    meeting: MeetingTranscript,
    draft: FollowUpDraft,
  ): Promise<{ workRunId: string }> {
    const run = await this.workRuntime.createRun({
      tenantId,
      actorId,
      actorType: 'AI_AGENT',
      request: `Send follow-up + calendar event for meeting ${meeting.id}`,
    });
    await this.audit.log({
      actor: actorId,
      action: 'meetings.followup.requested',
      resource: 'meeting',
      resourceId: meeting.id,
      tenantId,
      details: { workRunId: run.id, subject: draft.email.subject },
    });
    return { workRunId: run.id };
  }
}
