import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ReportDefinition } from '../dto/nl-report.dto';

/**
 * NlReportService — Phase 4.2 sub-A
 *
 * Parses a natural language query, maps it to a ReportDefinition, then runs
 * the aggregation against Prisma and returns both the definition + rows.
 *
 * SRP : owns NL→definition mapping and query execution, delegates nothing.
 * OCP : REPORT_PATTERNS can be extended without touching execution logic.
 * DIP : depends on PrismaService abstraction.
 *
 * NOTE: NL parsing is keyword-based (no external LLM) as the Sub-A scaffold.
 *       Swap patternToDefinition() for an LLM call in Sub-B when required.
 */
@Injectable()
export class NlReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(
    query: string,
    tenantId?: string,
  ): Promise<{
    definition: ReportDefinition;
    rows: Record<string, unknown>[];
  }> {
    const definition = this.patternToDefinition(query.toLowerCase().trim());
    const rows = await this.runQuery(definition, tenantId);
    return { definition, rows };
  }

  // ─── Pattern matcher ──────────────────────────────────────────────────────

  private patternToDefinition(q: string): ReportDefinition {
    if (this.matches(q, ['cost', 'spend', 'expense', 'price'])) {
      return {
        title: 'Cost Breakdown',
        description: 'Total spend grouped by agent',
        metric: 'costRecords',
        groupBy: 'agentId',
        filters: {},
        columns: [
          { key: 'agentId', label: 'Agent', type: 'string' },
          { key: 'total', label: 'Total Cost', type: 'number' },
        ],
        chartType: 'bar',
      };
    }

    if (this.matches(q, ['task', 'completion', 'completed', 'done'])) {
      return {
        title: 'Task Completion Rate',
        description: 'Tasks grouped by status',
        metric: 'tasks',
        groupBy: 'status',
        filters: {},
        columns: [
          { key: 'status', label: 'Status', type: 'string' },
          { key: 'count', label: 'Count', type: 'number' },
        ],
        chartType: 'pie',
      };
    }

    if (this.matches(q, ['agent', 'performance', 'active', 'agents'])) {
      return {
        title: 'Agent Activity',
        description: 'Number of agents by type',
        metric: 'agents',
        groupBy: 'type',
        filters: {},
        columns: [
          { key: 'type', label: 'Type', type: 'string' },
          { key: 'count', label: 'Count', type: 'number' },
        ],
        chartType: 'bar',
      };
    }

    if (this.matches(q, ['goal', 'goals', 'objective', 'progress'])) {
      return {
        title: 'Goal Progress',
        description: 'Goals grouped by status',
        metric: 'goals',
        groupBy: 'status',
        filters: {},
        columns: [
          { key: 'status', label: 'Status', type: 'string' },
          { key: 'count', label: 'Count', type: 'number' },
        ],
        chartType: 'pie',
      };
    }

    // Default: agent summary
    return {
      title: 'Agent Summary',
      description: `Custom report for: "${q}"`,
      metric: 'agents',
      groupBy: 'type',
      filters: {},
      columns: [
        { key: 'type', label: 'Type', type: 'string' },
        { key: 'count', label: 'Count', type: 'number' },
      ],
      chartType: 'table',
    };
  }

  private matches(query: string, keywords: string[]): boolean {
    return keywords.some((kw) => query.includes(kw));
  }

  // ─── Query runner ─────────────────────────────────────────────────────────

  private async runQuery(
    def: ReportDefinition,
    tenantId?: string,
  ): Promise<Record<string, unknown>[]> {
    const where = tenantId ? { tenantId } : {};

    switch (def.metric) {
      case 'costRecords': {
        const records = await this.prisma.costRecord.groupBy({
          by: ['agentId'],
          where,
          _sum: { costCents: true },
        });
        return records.map((r) => ({
          agentId: r.agentId ?? 'unknown',
          total: Number(r._sum?.costCents ?? 0),
        }));
      }

      case 'tasks': {
        const records = await this.prisma.task.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        });
        return records.map((r) => ({ status: r.status, count: r._count.id }));
      }

      case 'goals': {
        const records = await this.prisma.goal.groupBy({
          by: ['status'],
          where: tenantId ? { tenantId } : {},
          _count: { id: true },
        });
        return records.map((r) => ({ status: r.status, count: r._count.id }));
      }

      case 'agents':
      default: {
        const records = await this.prisma.agent.groupBy({
          by: ['type'],
          where,
          _count: { id: true },
        });
        return records.map((r) => ({ type: r.type, count: r._count.id }));
      }
    }
  }
}
