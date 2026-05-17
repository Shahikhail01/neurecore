// ─── IReportBuilder.ts ───────────────────────────────────────────────────────
// ISP: Report-building contract only. Export is a separate concern.

export type ReportFormat = 'csv' | 'json' | 'pdf';
export type ReportEntityType = 'agents' | 'tasks' | 'workflows' | 'departments' | 'analytics';
export type SortOrder = 'asc' | 'desc';

export interface ReportField {
  key: string;
  label: string;
  formatter?: (value: unknown) => string;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: unknown;
}

export interface ReportSortField {
  field: string;
  order: SortOrder;
}

export interface ReportGroupBy {
  field: string;
  aggregations?: Array<{ field: string; fn: 'count' | 'sum' | 'avg' | 'min' | 'max' }>;
}

export interface Report {
  title: string;
  entity: ReportEntityType;
  fields: ReportField[];
  filters: ReportFilter[];
  data: Record<string, unknown>[];
  metadata: {
    totalRows: number;
    generatedAt: string;
    timeRangeFrom?: string;
    timeRangeTo?: string;
  };
}

export interface IReportBuilder {
  forEntity(entity: ReportEntityType): this;
  selectFields(...fields: ReportField[]): this;
  addFilter(filter: ReportFilter): this;
  sortBy(field: string, order?: SortOrder): this;
  groupByField(config: ReportGroupBy): this;
  setTitle(title: string): this;
  setTimeRange(from: Date, to: Date): this;
  build(): Promise<Report>;
  export(format: ReportFormat): Promise<Blob>;
}

export interface IReportExporter {
  readonly format: ReportFormat;
  export(report: Report): Blob;
}
