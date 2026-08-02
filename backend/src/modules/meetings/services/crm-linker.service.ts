/**
 * CRM linker service — maps a meeting to existing CRM entities
 * (account / contact / lead / opportunity / case) and writes the
 * association through Work Runtime (P3).
 *
 * IMPORTANT: per plan rule 3, all mutations go through Work Runtime.
 * This service never writes directly to the CRM tables; it queues a
 * {@link WorkRun} via the runtime and surfaces the run id so the
 * caller can poll / approve.
 *
 * Resolution is tenant-scoped: an entity ID from a foreign tenant
 * returns 404 — no information leakage about existence.
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  WORK_RUNTIME,
  type IWorkRuntime,
} from '../../work-runtime/contracts/work-runtime.interface';
import type { MeetingLink, MeetingTranscript } from '../schemas/meeting.types';

const ALLOWED_ENTITIES: ReadonlyArray<MeetingLink['entityType']> = [
  'account',
  'contact',
  'lead',
  'opportunity',
  'case',
];

@Injectable()
export class CrmLinkerService {
  private readonly logger = new Logger(CrmLinkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(WORK_RUNTIME) private readonly workRuntime: IWorkRuntime,
  ) {}

  /** Returns the resolved link if the entity exists in the tenant. */
  async resolveEntity(
    tenantId: string,
    entityType: MeetingLink['entityType'],
    entityId: string,
  ): Promise<MeetingLink> {
    if (!ALLOWED_ENTITIES.includes(entityType)) {
      throw new BadRequestException(`entityType ${entityType} not allowed`);
    }
    const table =
      entityType === 'account'
        ? 'customer'
        : entityType === 'contact'
          ? 'contact'
          : entityType === 'lead'
            ? 'lead'
            : entityType === 'opportunity'
              ? 'opportunity'
              : 'case';
    // Every CRM entity has a tenantId column. We only allow access
    // when the row's tenantId matches.
    const row = await (
      this.prisma as unknown as Record<
        string,
        { findFirst: (args: unknown) => Promise<{ id: string } | null> }
      >
    )[table]?.findFirst({
      where: { id: entityId, tenantId },
      select: { id: true },
    });
    if (!row)
      throw new NotFoundException(`${entityType} ${entityId} not found`);
    return { entityType, entityId };
  }

  /**
   * Queue a governed WorkRun that links the meeting to the supplied
   * CRM entities. Returns the WorkRun id — caller polls / approves.
   */
  async link(
    tenantId: string,
    actorId: string,
    meeting: MeetingTranscript,
    links: MeetingLink[],
  ): Promise<{ workRunId: string }> {
    if (links.length === 0) throw new BadRequestException('no links supplied');
    for (const link of links) {
      await this.resolveEntity(tenantId, link.entityType, link.entityId);
    }
    const run = await this.workRuntime.createRun({
      tenantId,
      actorId,
      actorType: 'AI_AGENT',
      request: `Link meeting ${meeting.id} to ${links.length} CRM entities`,
    });
    await this.audit.log({
      actor: actorId,
      action: 'meetings.link.requested',
      resource: 'meeting',
      resourceId: meeting.id,
      tenantId,
      details: { workRunId: run.id, links },
    });
    return { workRunId: run.id };
  }
}
