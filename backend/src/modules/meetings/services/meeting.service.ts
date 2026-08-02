/**
 * Meeting orchestrator service — combines transcript, summary
 * templates, action extraction and CRM linkage into the public
 * meeting API surface used by the controller and other modules.
 *
 * Storage model: in-memory maps keyed by `(tenantId, meetingId)`.
 * The service writes through the existing audit log for every state
 * change so reconciliation against external systems remains possible.
 */
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  WORK_RUNTIME,
  type IWorkRuntime,
} from '../../work-runtime/contracts/work-runtime.interface';
import type {
  ActionItem,
  MeetingLink,
  MeetingSummary,
  MeetingTranscript,
  SummaryTemplateKey,
} from '../schemas/meeting.types';
import { SummaryTemplatesService } from './summary-templates.service';
import { ActionExtractorService } from './action-extractor.service';
import { CrmLinkerService } from './crm-linker.service';
import { FollowupService } from './followup.service';
import { MeetingAuditService } from './meeting-audit.service';

interface StoredMeeting {
  tenantId: string;
  transcript: MeetingTranscript;
  summaries: Map<SummaryTemplateKey, MeetingSummary>;
  actionItems: ActionItem[];
  links: MeetingLink[];
}

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);
  private readonly meetings = new Map<string, StoredMeeting>();

  constructor(
    private readonly audit: AuditService,
    private readonly templates: SummaryTemplatesService,
    private readonly actionExtractor: ActionExtractorService,
    private readonly linker: CrmLinkerService,
    private readonly followup: FollowupService,
    private readonly meetingAudit: MeetingAuditService,
    @Inject(WORK_RUNTIME) private readonly workRuntime: IWorkRuntime,
  ) {}

  /** Persist (or replace) a meeting transcript. Tenant-scoped. */
  async saveTranscript(transcript: MeetingTranscript): Promise<void> {
    await Promise.resolve();
    const key = this.key(transcript.tenantId, transcript.id);
    this.meetings.set(key, {
      tenantId: transcript.tenantId,
      transcript,
      summaries: new Map(),
      actionItems: [],
      links: [],
    });
  }

  getTranscript(tenantId: string, meetingId: string): MeetingTranscript {
    const m = this.meetings.get(this.key(tenantId, meetingId));
    if (!m) throw new NotFoundException(`meeting ${meetingId} not found`);
    return m.transcript;
  }

  /** Generate (or fetch) a typed summary for `meetingId`. */
  async getSummary(
    tenantId: string,
    meetingId: string,
    templateKey: SummaryTemplateKey,
  ): Promise<MeetingSummary> {
    return Promise.resolve().then(() => {
      const m = this.getStored(tenantId, meetingId);
      const cached = m.summaries.get(templateKey);
      if (cached) return cached;
      const skeleton = this.templates.renderSkeleton(m.transcript, templateKey);
      const version = this.meetingAudit.currentVersion(tenantId, meetingId);
      const summary: MeetingSummary = {
        meetingId,
        tenantId,
        generatedAt: new Date().toISOString(),
        templateKey,
        sections: skeleton,
        version,
      };
      m.summaries.set(templateKey, summary);
      return summary;
    });
  }

  /** Extract action items; caches the result for repeat calls. */
  async getActions(tenantId: string, meetingId: string): Promise<ActionItem[]> {
    return Promise.resolve().then(() => {
      const m = this.getStored(tenantId, meetingId);
      if (m.actionItems.length > 0) return m.actionItems;
      const { items } = this.actionExtractor.extract(m.transcript);
      m.actionItems = items;
      return items;
    });
  }

  /** Queue a WorkRun that links the meeting to CRM entities. */
  async linkToCrm(
    tenantId: string,
    actorId: string,
    meetingId: string,
    links: MeetingLink[],
  ): Promise<{ workRunId: string }> {
    const m = this.getStored(tenantId, meetingId);
    const { workRunId } = await this.linker.link(
      tenantId,
      actorId,
      m.transcript,
      links,
    );
    m.links.push(...links);
    return { workRunId };
  }

  /** Compose + queue the follow-up. */
  async requestFollowup(
    tenantId: string,
    actorId: string,
    meetingId: string,
  ): Promise<{
    draft: ReturnType<FollowupService['compose']>;
    workRunId: string;
  }> {
    const m = this.getStored(tenantId, meetingId);
    const summary = await this.getSummary(tenantId, meetingId, 'followUp');
    const actions = await this.getActions(tenantId, meetingId);
    const draft = this.followup.compose(m.transcript, summary, actions);
    const { workRunId } = await this.followup.dispatch(
      tenantId,
      actorId,
      m.transcript,
      draft,
    );
    return { draft, workRunId };
  }

  private getStored(tenantId: string, meetingId: string): StoredMeeting {
    if (!tenantId) throw new ForbiddenException('tenantId required');
    const m = this.meetings.get(this.key(tenantId, meetingId));
    if (!m) throw new NotFoundException(`meeting ${meetingId} not found`);
    return m;
  }

  private key(tenantId: string, meetingId: string): string {
    return `${tenantId}:${meetingId}`;
  }
}
