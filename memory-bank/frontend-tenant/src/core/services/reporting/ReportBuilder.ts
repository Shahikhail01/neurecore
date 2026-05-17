// ─── ReportBuilder.ts ────────────────────────────────────────────────────────
// OCP closed: Add new entity types / exporters without modifying this class.
// Builder pattern: fluent API, immutable config accumulation.
// SRP: Only builds report data structures and delegates export to exporters.
// DIP: Fetches data via singleton repositories (injected via constructor).

import type {
  IReportBuilder,
  IReportExporter,
  Report,
  ReportEntityType,
  ReportField,
  ReportFilter,
  ReportFormat,
  ReportGroupBy,
  ReportSortField,
} from "@/core/services/reporting/interfaces/IReportBuilder";
import type { QueryParams } from "@/core/repositories/interfaces/IRepository";
import { agentRepository } from "@/core/repositories/AgentRepository";
import { taskRepository } from "@/core/repositories/TaskRepository";
import { workflowRepository } from "@/core/repositories/WorkflowRepository";
import { departmentRepository } from "@/core/repositories/DepartmentRepository";
import { csvExporter } from "@/core/services/reporting/exporters/CsvExporter";
import { jsonExporter } from "@/core/services/reporting/exporters/JsonExporter";

const EXPORTERS: Record<ReportFormat, IReportExporter> = {
  csv: csvExporter,
  json: jsonExporter,
  pdf: jsonExporter, // PDF falls back to JSON until a pdf lib is added
};

export class ReportBuilder implements IReportBuilder {
  private _entity: ReportEntityType = "tasks";
  private _title = "Report";
  private _fields: ReportField[] = [];
  private _filters: ReportFilter[] = [];
  private _sort: ReportSortField[] = [];
  private _groupBy: ReportGroupBy[] = [];
  private _from?: Date;
  private _to?: Date;

  forEntity(entity: ReportEntityType): this {
    this._entity = entity;
    return this;
  }

  setTitle(title: string): this {
    this._title = title;
    return this;
  }

  selectFields(...fields: ReportField[]): this {
    this._fields.push(...fields);
    return this;
  }

  addFilter(filter: ReportFilter): this {
    this._filters.push(filter);
    return this;
  }

  sortBy(field: string, order: "asc" | "desc" = "asc"): this {
    this._sort.push({ field, order });
    return this;
  }

  groupByField(config: ReportGroupBy): this {
    this._groupBy.push(config);
    return this;
  }

  setTimeRange(from: Date, to: Date): this {
    this._from = from;
    this._to = to;
    return this;
  }

  async build(): Promise<Report> {
    const raw = await this._fetchData();
    const filtered = this._applyFilters(raw);
    const sorted = this._applySort(filtered);

    // Use specified fields or auto-generate from first row keys
    const fields =
      this._fields.length > 0
        ? this._fields
        : Object.keys(sorted[0] ?? {}).map((k) => ({ key: k, label: k }));

    return {
      title: this._title,
      entity: this._entity,
      fields,
      filters: this._filters,
      data: sorted,
      metadata: {
        totalRows: sorted.length,
        generatedAt: new Date().toISOString(),
        timeRangeFrom: this._from?.toISOString(),
        timeRangeTo: this._to?.toISOString(),
      },
    };
  }

  async export(format: ReportFormat): Promise<Blob> {
    const report = await this.build();
    const exporter = EXPORTERS[format] ?? csvExporter;
    return exporter.export(report);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async _fetchData(): Promise<Record<string, unknown>[]> {
    const query: QueryParams = { limit: 500 };
    if (this._from) query.from = this._from.toISOString();
    if (this._to) query.to = this._to.toISOString();

    const loaders: Record<
      ReportEntityType,
      () => Promise<Record<string, unknown>[]>
    > = {
      agents: async () => {
        const { items } = await agentRepository.findAll(query);
        return items as unknown as Record<string, unknown>[];
      },
      tasks: async () => {
        const { items } = await taskRepository.findAll(query);
        return items as unknown as Record<string, unknown>[];
      },
      workflows: async () => {
        const { items } = await workflowRepository.findAll(query);
        return items as unknown as Record<string, unknown>[];
      },
      departments: async () => {
        const { items } = await departmentRepository.findAll(query);
        return items as unknown as Record<string, unknown>[];
      },
      analytics: async () => [], // analytics data fetched directly from AnalyticsService
    };

    return loaders[this._entity]?.() ?? [];
  }

  private _applyFilters(
    data: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    return data.filter((row) =>
      this._filters.every((f) => {
        const val = row[f.field];
        switch (f.operator) {
          case "eq":
            return val === f.value;
          case "neq":
            return val !== f.value;
          case "gt":
            return (val as number) > (f.value as number);
          case "gte":
            return (val as number) >= (f.value as number);
          case "lt":
            return (val as number) < (f.value as number);
          case "lte":
            return (val as number) <= (f.value as number);
          case "contains":
            return String(val)
              .toLowerCase()
              .includes(String(f.value).toLowerCase());
          case "in":
            return (
              Array.isArray(f.value) && (f.value as unknown[]).includes(val)
            );
          default:
            return true;
        }
      }),
    );
  }

  private _applySort(
    data: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    if (!this._sort.length) return data;
    return [...data].sort((a, b) => {
      for (const sortCfg of this._sort) {
        const aVal = String(a[sortCfg.field] ?? "");
        const bVal = String(b[sortCfg.field] ?? "");
        const cmp = aVal.localeCompare(bVal);
        if (cmp !== 0) return sortCfg.order === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }
}

/** Factory – create a fresh builder per report */
export function createReportBuilder(): ReportBuilder {
  return new ReportBuilder();
}

/**
 * Pre-built report templates.
 * OCP: new templates added here without modifying ReportBuilder.
 */
export const REPORT_TEMPLATES = {
  agentPerformance: () =>
    createReportBuilder()
      .forEntity("agents")
      .setTitle("Agent Performance Report")
      .selectFields(
        { key: "name", label: "Agent Name" },
        { key: "status", label: "Status" },
        {
          key: "performance.successRate",
          label: "Success Rate (%)",
          formatter: (v) => `${v}%`,
        },
        { key: "performance.tasksCompleted", label: "Tasks Completed" },
        { key: "performance.avgTaskDuration", label: "Avg Duration (s)" },
        { key: "departmentName", label: "Department" },
      )
      .sortBy("performance.successRate", "desc"),

  taskSummary: () =>
    createReportBuilder()
      .forEntity("tasks")
      .setTitle("Task Summary Report")
      .selectFields(
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
        { key: "agentName", label: "Assigned Agent" },
        { key: "dueAt", label: "Due Date" },
        { key: "createdAt", label: "Created" },
      )
      .sortBy("createdAt", "desc"),

  workflowActivity: () =>
    createReportBuilder()
      .forEntity("workflows")
      .setTitle("Workflow Activity Report")
      .selectFields(
        { key: "name", label: "Workflow Name" },
        { key: "status", label: "Status" },
        { key: "executionCount", label: "Executions" },
        {
          key: "successRate",
          label: "Success Rate (%)",
          formatter: (v) => `${v}%`,
        },
        { key: "lastExecutedAt", label: "Last Executed" },
      )
      .sortBy("executionCount", "desc"),
} as const;
