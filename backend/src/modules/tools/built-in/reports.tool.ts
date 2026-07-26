/**
 * ReportsTool — Phase D (Weeks 17-20)
 *
 * Generates narrative + data-visualization reports from NeureCore data, then
 * optionally exports them as HTML (UI-renderable + browser-print-to-PDF) or
 * uploads to Google Drive as a Doc (which can be exported to PDF by Drive).
 *
 * Actions:
 *   action='generate' → pull data from Prisma + assemble HTML report
 *   action='export_pdf' → Drive-native PDF export via Google Drive export API
 *
 * Report types supported:
 *   'task_summary'        → status/priority breakdown + overdue list
 *   'cost_summary'        → per-department / per-agent / per-project cost rollups
 *   'agent_workload'      → active agents + their task counts
 *   'pipeline_overview'   → tasks grouped by status + recent completions
 *
 * Why HTML (not raw PDF):
 *   - No PDF library is installed in the backend (intentional — keeps deps light)
 *   - HTML is renderable in the agent chat UI directly
 *   - Browser print-to-PDF gives a clean PDF without server overhead
 *   - When Google is connected, we upload to Drive and use the Drive export API
 *     to download the doc as PDF — Google's native path, no extra deps.
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { ToolDataAccessService } from '../tool-data-access.service';
import { GoogleDriveService } from '../../integrations/google/google-drive.service';

export const ReportInputSchema = z.object({
  action: z.enum(['generate', 'export_pdf']).describe('Report action'),

  // generate
  type: z
    .enum(['task_summary', 'cost_summary', 'agent_workload', 'pipeline_overview'])
    .describe('Report type (generate, required)'),
  title: z.string().optional().describe('Custom report title (generate, defaults to type)'),
  narrative: z
    .string()
    .optional()
    .describe(
      "Optional AI-written narrative section. The agent's own LLM should supply this " +
        'after reviewing the tool result; it gets injected into the HTML.',
    ),
  days: z
    .number()
    .int()
    .positive()
    .max(365)
    .optional()
    .describe('Lookback window in days (generate, default 30)'),

  // export_pdf
  fileId: z.string().optional().describe('Drive file ID to export as PDF (export_pdf, required)'),
  saveToDrive: z
    .boolean()
    .optional()
    .describe('Also save the HTML report to Drive (generate, default true)'),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

export const ReportOutputSchema = z.object({
  action: z.string(),
  type: z.string().optional(),
  title: z.string().optional(),
  html: z.string().optional(),
  htmlLength: z.number().optional(),
  data: z.record(z.unknown()).optional(),
  fileId: z.string().optional(),
  webViewLink: z.string().optional(),
  pdfBase64: z.string().optional(),
  pdfSize: z.number().optional(),
  generatedAt: z.string().optional(),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

@Injectable()
export class ReportsTool extends BaseStructuredTool {
  readonly name = 'reports';
  readonly description =
    'Generate data-driven reports from NeureCore (tasks, costs, agents, pipeline). ' +
    "action='generate' returns an HTML report with charts + a placeholder for AI narrative. " +
    "action='export_pdf' converts an existing Drive doc to PDF via Google's export API. " +
    "Report types: 'task_summary', 'cost_summary', 'agent_workload', 'pipeline_overview'. " +
    "After generating, the agent can pass the narrative back to 'documents' tool to save, " +
    "or directly email via the 'email' tool.";
  readonly category = ToolCategory.API;
  readonly inputSchema = ReportInputSchema;
  readonly outputSchema = ReportOutputSchema;
  readonly requiredPermissions = ['reports:read'];

  constructor(
    private readonly data: ToolDataAccessService,
    private readonly drive: GoogleDriveService,
  ) {
    super();
  }

  protected async executeImpl(
    input: ReportInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<ReportOutput>> {
    const tenantId = context?.tenantId;
    const agentId = context?.agentId;
    if (!tenantId) return { success: false, error: 'Tenant context required' };

    try {
      switch (input.action) {
        case 'generate':
          return await this.generate(tenantId, agentId, input);
        case 'export_pdf':
          return await this.exportPdf(tenantId, input);
        default:
          return { success: false, error: `Unknown action: ${String(input.action)}` };
      }
    } catch (error) {
      this.logger.error(`ReportsTool [${input.action}] failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report operation failed',
      };
    }
  }

  // ─── generate ───────────────────────────────────────────────────────────

  private async generate(
    tenantId: string,
    agentId: string | undefined,
    input: ReportInput,
  ): Promise<StructuredToolResult<ReportOutput>> {
    const days = input.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const title = input.title ?? defaultTitle(input.type);
    const narrative = input.narrative ?? '';

    let data: Record<string, unknown> = {};
    switch (input.type) {
      case 'task_summary':
        data = await this.collectTaskSummary(tenantId, since);
        break;
      case 'cost_summary':
        data = await this.collectCostSummary(tenantId, since);
        break;
      case 'agent_workload':
        data = await this.collectAgentWorkload(tenantId, agentId);
        break;
      case 'pipeline_overview':
        data = await this.collectPipelineOverview(tenantId, since);
        break;
    }

    const html = this.renderHtml({
      title,
      type: input.type,
      days,
      data,
      narrative,
      generatedAt: new Date().toISOString(),
    });

    let fileId: string | undefined;
    let webViewLink: string | undefined;
    if (input.saveToDrive !== false) {
      try {
        const parentId = await this.resolveReportsFolder(tenantId, agentId);
        const file = await this.drive.createFile(tenantId, {
          name: `${title} — ${new Date().toISOString().slice(0, 10)}.html`,
          content: html,
          mimeType: 'text/html',
          parentId,
        });
        fileId = file.id;
        webViewLink = file.webViewLink;
      } catch (err) {
        // Drive upload is best-effort — return HTML even if Drive isn't connected
        this.logger.warn(`Report saved to HTML but Drive upload failed: ${(err as Error).message}`);
      }
    }

    return {
      success: true,
      data: {
        action: 'generate',
        type: input.type,
        title,
        html,
        htmlLength: html.length,
        data,
        fileId,
        webViewLink,
        generatedAt: new Date().toISOString(),
      },
      metadata: { model: 'reports-tool-v1' },
    };
  }

  // ─── export_pdf (Drive-native) ──────────────────────────────────────────

  private async exportPdf(
    tenantId: string,
    input: ReportInput,
  ): Promise<StructuredToolResult<ReportOutput>> {
    if (!input.fileId) return { success: false, error: 'export_pdf requires fileId' };

    const accessToken = await this.drive.getAccessToken(tenantId);
    if (!accessToken) return { success: false, error: 'Google is not connected' };

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${input.fileId}/export?mimeType=application/pdf`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return { success: false, error: `Drive PDF export failed: ${res.status} ${err}` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      success: true,
      data: {
        action: 'export_pdf',
        fileId: input.fileId,
        pdfBase64: buffer.toString('base64'),
        pdfSize: buffer.length,
      },
      metadata: { model: 'reports-tool-v1' },
    };
  }

  // ─── data collectors ────────────────────────────────────────────────────

  private async collectTaskSummary(tenantId: string, since: Date) {
    const [byStatus, byPriority, overdue, recentlyCompleted] = await Promise.all([
      this.data.task.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.data.task.groupBy({
        by: ['priority'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.data.task.findMany({
        where: {
          tenantId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          scheduledAt: { lt: new Date() },
        },
        select: { id: true, title: true, priority: true, scheduledAt: true },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
      this.data.task.findMany({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: since } },
        select: { id: true, title: true, completedAt: true, priority: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
    ]);
    return { byStatus, byPriority, overdue, recentlyCompleted };
  }

  private async collectCostSummary(tenantId: string, since: Date) {
    const [total, byDepartment, byAgent] = await Promise.all([
      this.data.costRecord.aggregate({
        where: { tenantId, windowStart: { gte: since } },
        _sum: { costCents: true },
        _count: { _all: true },
      }),
      this.data.costRecord.groupBy({
        by: ['departmentId'],
        where: { tenantId, windowStart: { gte: since }, departmentId: { not: null } },
        _sum: { costCents: true },
        _count: { _all: true },
      }),
      this.data.costRecord.groupBy({
        by: ['agentId'],
        where: { tenantId, windowStart: { gte: since }, agentId: { not: null } },
        _sum: { costCents: true },
        _count: { _all: true },
        orderBy: { _sum: { costCents: 'desc' } },
        take: 10,
      }),
    ]);
    return { total, byDepartment, byAgent };
  }

  private async collectAgentWorkload(tenantId: string, agentId?: string) {
    const agents = await this.data.agent.findMany({
      where: {
        tenantId,
        ...(agentId ? { id: agentId } : {}),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        status: true,
        tasks: {
          where: { status: { in: ['PENDING', 'QUEUED', 'RUNNING'] } },
          select: { id: true, priority: true },
        },
      },
    });
    return {
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        activeTasks: a.tasks.length,
        criticalTasks: a.tasks.filter((t) => t.priority === 'CRITICAL').length,
      })),
    };
  }

  private async collectPipelineOverview(tenantId: string, since: Date) {
    const [byStatus, recent, topPerformers] = await Promise.all([
      this.data.task.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.data.task.findMany({
        where: { tenantId, createdAt: { gte: since } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.data.task.groupBy({
        by: ['agentId'],
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { agentId: 'desc' } },
        take: 5,
      }),
    ]);
    return { byStatus, recent, topPerformers };
  }

  // ─── HTML rendering ─────────────────────────────────────────────────────

  private renderHtml(args: {
    title: string;
    type: string;
    days: number;
    data: Record<string, unknown>;
    narrative: string;
    generatedAt: string;
  }): string {
    const sections: string[] = [];

    sections.push(`<h1>${escapeHtml(args.title)}</h1>`);
    sections.push(
      `<p class="meta">Generated ${args.generatedAt} · Window: last ${args.days} days · Report type: ${args.type}</p>`,
    );

    if (args.narrative) {
      sections.push(`<section class="narrative"><h2>Executive Summary</h2><div>${args.narrative}</div></section>`);
    }

    sections.push('<section class="data"><h2>Data</h2>');
    sections.push(renderData(args.type, args.data));
    sections.push('</section>');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(args.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111; max-width: 900px; margin: 32px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .meta { color: #6b7280; font-size: 13px; margin-top: 0; }
  .narrative { background: #f9fafb; padding: 16px 20px; border-left: 3px solid #4f46e5; border-radius: 4px; margin-top: 16px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 14px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  .bar { display: inline-block; height: 14px; background: #4f46e5; vertical-align: middle; margin-right: 6px; border-radius: 2px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pill-high { background: #fee2e2; color: #991b1b; }
  .pill-med  { background: #fef3c7; color: #92400e; }
  .pill-low  { background: #dcfce7; color: #166534; }
  ul { padding-left: 20px; }
  li { margin: 4px 0; }
</style>
</head><body>
${sections.join('\n')}
</body></html>`;
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private async resolveReportsFolder(
    tenantId: string,
    agentId: string | undefined,
  ): Promise<string> {
    if (!agentId) {
      const root = await this.drive.ensureRootFolder(tenantId);
      return root.id;
    }
    const agent = await this.data.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, tenantId: true },
    });
    if (!agent || agent.tenantId !== tenantId) {
      throw new Error(`Agent ${agentId} not found for tenant ${tenantId}`);
    }
    const folders = await this.drive.setupAgentFolders(tenantId, agent.id, agent.name);
    return folders.subfolders.Reports;
  }
}

// ─── pure helpers (module-private) ─────────────────────────────────────────

function defaultTitle(type: string): string {
  switch (type) {
    case 'task_summary':
      return 'Task Summary Report';
    case 'cost_summary':
      return 'Cost Summary Report';
    case 'agent_workload':
      return 'Agent Workload Report';
    case 'pipeline_overview':
      return 'Pipeline Overview Report';
    default:
      return 'NeureCore Report';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function priorityPill(p: string): string {
  const cls = p === 'CRITICAL' ? 'pill-high' : p === 'HIGH' ? 'pill-med' : 'pill-low';
  return `<span class="pill ${cls}">${escapeHtml(p)}</span>`;
}

function renderData(type: string, data: Record<string, unknown>): string {
  const parts: string[] = [];

  if (type === 'task_summary') {
    const d = data as {
      byStatus: Array<{ status: string; _count: { _all: number } }>;
      byPriority: Array<{ priority: string; _count: { _all: number } }>;
      overdue: Array<{ id: string; title: string; priority: string; scheduledAt: Date }>;
      recentlyCompleted: Array<{ id: string; title: string; priority: string; completedAt: Date }>;
    };
    parts.push('<h3>By Status</h3>');
    parts.push(renderTable(['Status', 'Count'], d.byStatus.map((r) => [r.status, String(r._count._all)])));
    parts.push('<h3>By Priority</h3>');
    parts.push(renderTable(['Priority', 'Count'], d.byPriority.map((r) => [r.priority, String(r._count._all)])));
    parts.push('<h3>Overdue</h3>');
    parts.push(
      renderTable(
        ['Title', 'Priority', 'Due'],
        d.overdue.map((r) => [
          escapeHtml(r.title),
          priorityPill(r.priority),
          new Date(r.scheduledAt).toISOString().slice(0, 10),
        ]),
      ),
    );
    parts.push('<h3>Recently Completed</h3>');
    parts.push(
      renderTable(
        ['Title', 'Priority', 'Completed'],
        d.recentlyCompleted.map((r) => [
          escapeHtml(r.title),
          priorityPill(r.priority),
          r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : '',
        ]),
      ),
    );
  } else if (type === 'cost_summary') {
    const d = data as {
      total: { _sum: { costCents: bigint | null }; _count: { _all: number } } | null;
      byDepartment: Array<{ departmentId: string; _sum: { costCents: bigint | null }; _count: { _all: number } }>;
      byAgent: Array<{ agentId: string; _sum: { costCents: bigint | null }; _count: { _all: number } }>;
    };
    const totalCents = Number(d.total?._sum.costCents ?? 0);
    parts.push(`<p><strong>Total cost:</strong> $${(totalCents / 100).toFixed(2)} across ${d.total?._count._all ?? 0} records.</p>`);
    parts.push('<h3>By Department</h3>');
    parts.push(renderTable(['Department', 'Cost (USD)', 'Records'], d.byDepartment.map((r) => [r.departmentId ?? '—', `$${(Number(r._sum.costCents ?? 0) / 100).toFixed(2)}`, String(r._count._all)])));
    parts.push('<h3>Top 10 Agents by Cost</h3>');
    parts.push(renderTable(['Agent', 'Cost (USD)', 'Records'], d.byAgent.map((r) => [r.agentId ?? '—', `$${(Number(r._sum.costCents ?? 0) / 100).toFixed(2)}`, String(r._count._all)])));
  } else if (type === 'agent_workload') {
    const d = data as {
      agents: Array<{ id: string; name: string; status: string; activeTasks: number; criticalTasks: number }>;
    };
    const max = Math.max(1, ...d.agents.map((a) => a.activeTasks));
    parts.push('<ul>');
    for (const a of d.agents) {
      const w = Math.round((a.activeTasks / max) * 240);
      parts.push(
        `<li><span class="bar" style="width:${w}px"></span><strong>${escapeHtml(a.name)}</strong> — ${a.activeTasks} active (${a.criticalTasks} critical) [${a.status}]</li>`,
      );
    }
    parts.push('</ul>');
  } else if (type === 'pipeline_overview') {
    const d = data as {
      byStatus: Array<{ status: string; _count: { _all: number } }>;
      recent: Array<{ id: string; title: string; status: string; priority: string; createdAt: Date; completedAt: Date | null }>;
      topPerformers: Array<{ agentId: string; _count: { _all: number } }>;
    };
    parts.push('<h3>Pipeline by Stage</h3>');
    parts.push(renderTable(['Stage', 'Count'], d.byStatus.map((r) => [r.status, String(r._count._all)])));
    parts.push('<h3>Recent Tasks</h3>');
    parts.push(
      renderTable(
        ['Title', 'Status', 'Priority', 'Created', 'Completed'],
        d.recent.map((r) => [
          escapeHtml(r.title),
          r.status,
          priorityPill(r.priority),
          new Date(r.createdAt).toISOString().slice(0, 10),
          r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : '',
        ]),
      ),
    );
    parts.push('<h3>Top Performers (completed in window)</h3>');
    parts.push(renderTable(['Agent', 'Completed'], d.topPerformers.map((r) => [r.agentId ?? '—', String(r._count._all)])));
  }

  return parts.join('\n');
}

function renderTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '<p><em>No data.</em></p>';
  const ths = headers.map((h) => `<th>${h}</th>`).join('');
  const trs = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}