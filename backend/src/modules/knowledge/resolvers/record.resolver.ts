/**
 * Phase 12 — RecordResolver.
 *
 * Resolves `kind: 'record'` SourceRefs (recordType + recordId) to the
 * tenant-scoped textual content + citations.
 *
 * SRP: this class owns ONLY the record resolution surface.
 *
 * SECURITY: `recordId` is treated as a path identifier; the
 * `tenantId` WHERE clause ensures cross-tenant access always throws.
 * Unknown recordType is rejected with a typed error rather than
 * returning partial content.
 *
 * Supported record types: `customer`, `project`, `deal`, `quote`, `task`.
 * Future types add a case to `resolveFor()` — keep this extension
 * strictly local (no behaviour duplication elsewhere).
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  FileTextResolver,
  ResolvedText,
  ResolverKind,
} from './source-ref-resolver.registry';
import type { SourceRef, SkillCitation } from '../../skill-registry/interfaces/skill.types';

type RecordRef = Extract<SourceRef, { kind: 'record' }>;

@Injectable()
export class RecordResolver extends FileTextResolver<RecordRef> {
  readonly kind: ResolverKind = 'record';
  private readonly logger = new Logger(RecordResolver.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected async doResolve(
    tenantId: string,
    ref: RecordRef,
  ): Promise<ResolvedText> {
    switch (ref.recordType) {
      case 'customer':
        return this.resolveCustomer(tenantId, ref.recordId);
      case 'project':
        return this.resolveProject(tenantId, ref.recordId);
      case 'deal':
        return this.resolveDeal(tenantId, ref.recordId);
      case 'quote':
        return this.resolveQuote(tenantId, ref.recordId);
      case 'task':
        return this.resolveTask(tenantId, ref.recordId);
      default:
        throw new NotFoundException(
          `recordType=${ref.recordType} is not resolvable; add a case to RecordResolver.resolveFor()`,
        );
    }
  }

  private async resolveCustomer(tenantId: string, recordId: string): Promise<ResolvedText> {
    const row = await this.prisma.customer.findFirst({
      where: { id: recordId, tenantId },
      select: {
        id: true,
        name: true,
        industry: true,
        primaryEmail: true,
        primaryPhone: true,
        lifecycleStage: true,
        financialSubType: true,
        riskRating: true,
        status: true,
      },
    });
    if (!row) throw new NotFoundException(`customer ${recordId} not found`);
    const text = renderRow('Customer', row);
    return {
      text,
      citations: [
        {
          recordType: 'Customer',
          recordId: row.id,
          locator: `customer:${row.id}`,
          quote: row.name,
        },
      ],
    };
  }

  private async resolveProject(tenantId: string, recordId: string): Promise<ResolvedText> {
    const row = await this.prisma.project.findFirst({
      where: { id: recordId, tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        industry: true,
        customer: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException(`project ${recordId} not found`);
    const text = renderRow('Project', { ...row, customerName: row.customer?.name });
    const citations: SkillCitation[] = [
      {
        recordType: 'Project',
        recordId: row.id,
        locator: `project:${row.id}`,
        quote: row.name,
      },
    ];
    return { text, citations };
  }

  private async resolveDeal(tenantId: string, recordId: string): Promise<ResolvedText> {
    const row = await this.prisma.deal.findFirst({
      where: { id: recordId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        stage: true,
        amount: true,
        currency: true,
        probability: true,
        customer: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException(`deal ${recordId} not found`);
    const text = renderRow('Deal', { ...row, customerName: row.customer?.name });
    return {
      text,
      citations: [
        {
          recordType: 'Deal',
          recordId: row.id,
          locator: `deal:${row.id}`,
          quote: row.name,
        },
      ],
    };
  }

  private async resolveQuote(tenantId: string, recordId: string): Promise<ResolvedText> {
    const row = await this.prisma.quote.findFirst({
      where: { id: recordId, tenantId },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        total: true,
        currency: true,
        dealId: true,
      },
    });
    if (!row) throw new NotFoundException(`quote ${recordId} not found`);
    const text = renderRow('Quote', row);
    return {
      text,
      citations: [
        {
          recordType: 'Quote',
          recordId: row.id,
          locator: `quote:${row.quoteNumber}`,
          quote: `quote ${row.quoteNumber} (status=${row.status})`,
        },
      ],
    };
  }

  private async resolveTask(tenantId: string, recordId: string): Promise<ResolvedText> {
    const row = await this.prisma.task.findFirst({
      where: { id: recordId, tenantId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
      },
    });
    if (!row) throw new NotFoundException(`task ${recordId} not found`);
    const text = renderRow('Task', row);
    return {
      text,
      citations: [
        {
          recordType: 'Task',
          recordId: row.id,
          locator: `task:${row.id}`,
          quote: row.title,
        },
      ],
    };
  }
}

/**
 * Render a flat record to markdown-ish text. Single source of truth
 * for the resolver text shape — kept here, not in a utility file, to
 * keep the resolver's "I own this output" SRP clean.
 */
function renderRow(label: string, row: Record<string, unknown>): string {
  const entries = Object.entries(row).filter(
    ([, v]) => v !== null && v !== undefined && String(v).length > 0,
  );
  const body = entries
    .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n');
  return `${label}\n${body}`;
}
