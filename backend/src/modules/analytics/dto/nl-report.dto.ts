import { IsString, MinLength, IsOptional } from 'class-validator';

export class NlReportDto {
  @IsString()
  @MinLength(5)
  query!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'number' | 'string' | 'date';
}

export interface ReportDefinition {
  title: string;
  description: string;
  /** SQL-lite aggregation hint — used for query execution */
  metric: string;
  groupBy: string;
  filters: Record<string, unknown>;
  columns: ReportColumn[];
  chartType: 'bar' | 'line' | 'pie' | 'table';
}
