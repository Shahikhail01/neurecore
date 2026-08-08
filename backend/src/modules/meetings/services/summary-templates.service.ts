/**
 * Phase 16 — SummaryTemplatesService.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2.
 *
 * Closes CR-AI-0402 — "Summary templates (decisions, actions,
 * risks, sentiment)". Provides typed CRUD over a tenant's summary
 * templates + a `pickFor(meetingType)` helper that selects the
 * default template for a meeting type, falling back to a system
 * template when the tenant has no default.
 *
 * SRP — owns ONLY the template catalog + selection.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export class SummaryTemplateForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SummaryTemplateForbiddenError';
  }
}

export interface SummaryTemplateSections {
  readonly decisions: string;
  readonly actions: string;
  readonly risks: string;
  readonly sentiment: string;
}

export interface SummaryTemplate {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly meetingType: string;
  readonly sections: SummaryTemplateSections;
  readonly isDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable()
export class SummaryTemplatesService {
  private readonly logger = new Logger(SummaryTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<ReadonlyArray<SummaryTemplate>> {
    if (!tenantId || tenantId === '*') return [];
    const rows = await this.prisma.meetingSummaryTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map(mapRow);
  }

  async create(
    tenantId: string,
    name: string,
    meetingType: string,
    sections: SummaryTemplateSections,
    isDefault: boolean,
  ): Promise<SummaryTemplate> {
    if (!tenantId || tenantId === '*') {
      throw new SummaryTemplateForbiddenError('tenantId required');
    }
    if (!name || !meetingType) {
      throw new NotFoundException('name and meetingType required');
    }
    const row = await this.prisma.meetingSummaryTemplate.upsert({
      where: { tenantId_name: { tenantId, name } },
      create: {
        tenantId,
        name,
        meetingType,
        sections: sections as never,
        isDefault,
      },
      update: {
        meetingType,
        sections: sections as never,
        isDefault,
      },
    });
    return mapRow(row);
  }

  async pickFor(
    tenantId: string,
    meetingType: string,
  ): Promise<SummaryTemplate> {
    if (!tenantId || tenantId === '*') {
      throw new SummaryTemplateForbiddenError('tenantId required');
    }
    const row = await this.prisma.meetingSummaryTemplate.findFirst({
      where: {
        tenantId,
        meetingType,
        isDefault: true,
      },
    });
    if (row) return mapRow(row);

    // Fallback to system default for the meeting type.
    return systemDefaultFor(meetingType, tenantId);
  }

  /**
   * Phase 16 — renderSkeleton(transcript, templateKey).
   *
   * The legacy `meeting.service.ts` (pre-existing skeleton) calls this
   * to produce a typed `MeetingSummary.sections` shape. We map the
   * skeleton key to a meeting type and emit the default sections.
   *
   * No DB round-trip here; the cache layer in `MeetingService` is
   * responsible for memoising.
   */
  renderSkeleton(
    transcript: { languageCode?: string },
    templateKey: string,
  ): SummaryTemplateSections {
    const type = templateKey;
    return defaultSections(type);
  }

  /**
   * Upserts the four default templates (1:1, discovery, standup,
   * kickoff) for a tenant on first setup.
   */
  async ensureDefaults(tenantId: string): Promise<ReadonlyArray<SummaryTemplate>> {
    if (!tenantId || tenantId === '*') {
      throw new SummaryTemplateForbiddenError('tenantId required');
    }
    const defs: Array<[string, string, SummaryTemplateSections]> = [
      ['1:1', '1to1', defaultSections('1:1')],
      ['Discovery', 'discovery', defaultSections('discovery')],
      ['Standup', 'standup', defaultSections('standup')],
      ['Kickoff', 'kickoff', defaultSections('kickoff')],
    ];
    const out: SummaryTemplate[] = [];
    for (const [name, type, sections] of defs) {
      out.push(await this.create(tenantId, name, type, sections, true));
    }
    return out;
  }

  /**
   * Phase 25 — live editor surface. Update an existing template
   * atomically. The update is tenant-scoped: cross-tenant writes
   * raise `SummaryTemplateForbiddenError`.
   */
  async update(
    tenantId: string,
    templateId: string,
    input: {
      name?: string;
      meetingType?: string;
      sections?: SummaryTemplateSections;
      isDefault?: boolean;
    },
  ): Promise<SummaryTemplate> {
    if (!tenantId || tenantId === '*') {
      throw new SummaryTemplateForbiddenError('tenantId required');
    }
    const owned = await this.prisma.meetingSummaryTemplate.findFirst({
      where: { id: templateId, tenantId },
      select: { id: true },
    });
    if (!owned) {
      throw new NotFoundException(
        `summary template ${templateId} not found in tenant ${tenantId}`,
      );
    }
    const row = await this.prisma.meetingSummaryTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.meetingType !== undefined ? { meetingType: input.meetingType } : {}),
        ...(input.sections !== undefined ? { sections: input.sections as never } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
    return mapRow(row);
  }

  /**
   * Phase 25 — delete a summary template. Used by the live editor
   * when an admin retires a custom template. Refuses to delete
   * the last default for a meeting type (the operator must
   * promote another first).
   */
  async delete(tenantId: string, templateId: string): Promise<{ id: string }> {
    if (!tenantId || tenantId === '*') {
      throw new SummaryTemplateForbiddenError('tenantId required');
    }
    const row = await this.prisma.meetingSummaryTemplate.findFirst({
      where: { id: templateId, tenantId },
      select: { id: true, meetingType: true, isDefault: true },
    });
    if (!row) {
      throw new NotFoundException(
        `summary template ${templateId} not found in tenant ${tenantId}`,
      );
    }
    if (row.isDefault) {
      // ensure another default exists for the same meetingType
      const sibling = await this.prisma.meetingSummaryTemplate.findFirst({
        where: {
          tenantId,
          meetingType: row.meetingType,
          isDefault: true,
          NOT: { id: templateId },
        },
        select: { id: true },
      });
      if (!sibling) {
        throw new SummaryTemplateForbiddenError(
          `cannot delete last default template for meetingType ${row.meetingType}`,
        );
      }
    }
    await this.prisma.meetingSummaryTemplate.delete({ where: { id: templateId } });
    return { id: templateId };
  }
}

function mapRow(r: {
  id: string;
  tenantId: string;
  name: string;
  meetingType: string;
  sections: unknown;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SummaryTemplate {
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    meetingType: r.meetingType,
    sections: normaliseSections(r.sections),
    isDefault: r.isDefault,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function normaliseSections(raw: unknown): SummaryTemplateSections {
  const o = (raw ?? {}) as Record<string, string | undefined>;
  return {
    decisions: o['decisions'] ?? '',
    actions: o['actions'] ?? '',
    risks: o['risks'] ?? '',
    sentiment: o['sentiment'] ?? '',
  };
}

function defaultSections(meetingType: string): SummaryTemplateSections {
  switch (meetingType) {
    case '1to1':
    case '1:1':
      return {
        decisions: 'Decisions taken about the team-member\'s priorities, blockers, and feedback.',
        actions: 'Action items owned by either party with due dates.',
        risks: 'Risks to retention, momentum, or context-switching.',
        sentiment: 'Overall tone of the conversation.',
      };
    case 'discovery':
      return {
        decisions: 'Scope decisions and qualifying questions answered.',
        actions: 'Follow-ups to send, demos to schedule, decisions pending.',
        risks: 'Risks to timeline, budget, fit, or sponsor buy-in.',
        sentiment: 'Customer engagement + openness to next steps.',
      };
    case 'standup':
      return {
        decisions: 'Daily blockers resolved and decisions made.',
        actions: 'Today\'s deliverables and dependencies.',
        risks: 'Cross-team blockers + delivery risk.',
        sentiment: 'Team energy and friction.',
      };
    case 'kickoff':
      return {
        decisions: 'Roles, scope, and timelines agreed.',
        actions: 'First deliverables + review checkpoints.',
        risks: 'Scope creep, resource conflicts, external dependencies.',
        sentiment: 'Stakeholder alignment + commitment.',
      };
    default:
      return {
        decisions: 'Decisions taken during the meeting.',
        actions: 'Action items with owners and due dates.',
        risks: 'Risks raised during the meeting.',
        sentiment: 'Overall meeting tone.',
      };
  }
}

function systemDefaultFor(
  meetingType: string,
  tenantId: string,
): SummaryTemplate {
  const sections = defaultSections(meetingType);
  const id = `system-${meetingType}`;
  return {
    id,
    tenantId,
    name: `${meetingType} (system default)`,
    meetingType,
    sections,
    isDefault: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}
