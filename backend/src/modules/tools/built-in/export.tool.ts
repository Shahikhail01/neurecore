/**
 * Export Tools - P1-9 of remaining tools
 * Enables AI agents to export data to CSV, JSON, and other formats
 * For Sales, Finance, Analytics agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for export operations
 * - OCP: Extensible via exporter interfaces
 * - DIP: Depends on abstractions for data export
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

export const ExportActionEnum = z.enum([
  'export_to_csv',
  'export_to_json',
  'export_to_excel',
  'convert_format',
  'batch_export',
  'get_export_status',
]);

export type ExportAction = z.infer<typeof ExportActionEnum>;

export const ExportInputSchema = z.object({
  action: ExportActionEnum.describe('The export action to perform'),
  data: z.any().optional().describe('Data to export'),
  format: z
    .enum(['csv', 'json', 'excel', 'xml', 'pdf'])
    .optional()
    .describe('Export format'),
  filename: z.string().optional().describe('Output filename'),
  options: z
    .object({
      includeHeaders: z.boolean().optional().default(true),
      delimiter: z.string().optional().default(','),
      encoding: z.string().optional().default('utf-8'),
      compression: z.boolean().optional().default(false),
    })
    .optional(),
  sourceId: z.string().optional().describe('Source data ID'),
  exportId: z.string().optional().describe('Export job ID'),
});

export type ExportInput = z.infer<typeof ExportInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type ExportJob = {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  filename: string;
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
};

type ExportJobList = Array<ExportJob>;

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IExporterProvider {
  exportToCSV(
    data: unknown,
    options?: { delimiter?: string; includeHeaders?: boolean },
  ): Promise<{ content: string }>;
  exportToJSON(
    data: unknown,
    options?: { pretty?: boolean },
  ): Promise<{ content: string }>;
  exportToExcel(data: unknown): Promise<{ url: string }>;
  convertFormat(
    data: string,
    from: string,
    to: string,
  ): Promise<{ content: string }>;
  createBatchExport(dataIds: string[], format: string): Promise<ExportJob>;
  getExportStatus(exportId: string): Promise<ExportJob>;
}

// ─────────────────────────────────────────────────────────────
// Mock Exporter Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockExporterProvider implements IExporterProvider {
  private readonly logger = new Logger(MockExporterProvider.name);
  private readonly exports = new Map<string, ExportJob>();

  async exportToCSV(
    data: unknown,
    options?: { delimiter?: string; includeHeaders?: boolean },
  ): Promise<{ content: string }> {
    this.logger.log('Exporting to CSV');
    const delimiter = options?.delimiter || ',';
    const includeHeaders = options?.includeHeaders ?? true;

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { content: '' };
      }

      const headers = includeHeaders
        ? Object.keys(data[0] as object).join(delimiter) + '\n'
        : '';
      const rows = data
        .map((row) => {
          if (typeof row === 'object' && row !== null) {
            return Object.values(row as object)
              .map((v) => {
                const str = String(v ?? '');
                return str.includes(delimiter) || str.includes('"')
                  ? `"${str.replace(/"/g, '""')}"`
                  : str;
              })
              .join(delimiter);
          }
          return String(row);
        })
        .join('\n');

      return { content: headers + rows };
    }

    return { content: String(data) };
  }

  async exportToJSON(
    data: unknown,
    options?: { pretty?: boolean },
  ): Promise<{ content: string }> {
    this.logger.log('Exporting to JSON');
    const pretty = options?.pretty ?? true;
    return {
      content: pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data),
    };
  }

  async exportToExcel(data: unknown): Promise<{ url: string }> {
    this.logger.log('Exporting to Excel');
    const id = 'excel-' + Date.now();
    return { url: '/exports/' + id + '.xlsx' };
  }

  async convertFormat(
    data: string,
    from: string,
    to: string,
  ): Promise<{ content: string }> {
    this.logger.log('Converting from ' + from + ' to ' + to);

    if (from === 'json' && to === 'csv') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const headers = Object.keys(parsed[0]).join(',');
          const rows = parsed
            .map((row) => Object.values(row).join(','))
            .join('\n');
          return { content: headers + '\n' + rows };
        }
      } catch {
        return { content: data };
      }
    }

    return { content: data };
  }

  async createBatchExport(
    dataIds: string[],
    format: string,
  ): Promise<ExportJob> {
    this.logger.log('Creating batch export for ' + dataIds.length + ' items');
    const job: ExportJob = {
      id: 'export-' + Date.now(),
      status: 'completed',
      format: format,
      filename: 'batch-export.' + format,
      downloadUrl: '/exports/batch-' + Date.now() + '.' + format,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    this.exports.set(job.id, job);
    return job;
  }

  async getExportStatus(exportId: string): Promise<ExportJob> {
    this.logger.log('Getting export status: ' + exportId);
    const job = this.exports.get(exportId);
    if (!job) {
      return {
        id: exportId,
        status: 'completed',
        format: 'unknown',
        filename: 'unknown',
        createdAt: new Date().toISOString(),
      };
    }
    return job;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ExportTool extends BaseStructuredTool {
  readonly name = 'export';
  readonly description = 'Export data to CSV, JSON, Excel, and other formats';
  readonly category = ToolCategory.DATA;
  readonly inputSchema = ExportInputSchema;

  private readonly log = new Logger(ExportTool.name);
  private readonly provider: IExporterProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockExporterProvider();
  }

  protected async executeImpl(
    input: ExportInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Export action: ' + input.action);

    try {
      switch (input.action) {
        case 'export_to_csv':
          return await this.handleExportToCSV(input);
        case 'export_to_json':
          return await this.handleExportToJSON(input);
        case 'export_to_excel':
          return await this.handleExportToExcel(input);
        case 'convert_format':
          return await this.handleConvertFormat(input);
        case 'batch_export':
          return await this.handleBatchExport(input);
        case 'get_export_status':
          return await this.handleGetExportStatus(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Export action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleExportToCSV(
    input: ExportInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.data) {
      throw new Error('data is required for export_to_csv action');
    }
    const result = await this.provider.exportToCSV(input.data, {
      delimiter: input.options?.delimiter,
      includeHeaders: input.options?.includeHeaders,
    });
    return {
      success: true,
      data: {
        content: result.content,
        filename: input.filename || 'export.csv',
        mimeType: 'text/csv',
      },
    };
  }

  private async handleExportToJSON(
    input: ExportInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.data) {
      throw new Error('data is required for export_to_json action');
    }
    const options = input.options || {};
    const result = await this.provider.exportToJSON(input.data, {
      pretty: true,
    });
    return {
      success: true,
      data: {
        content: result.content,
        filename: input.filename || 'export.json',
        mimeType: 'application/json',
      },
    };
  }

  private async handleExportToExcel(
    input: ExportInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.data) {
      throw new Error('data is required for export_to_excel action');
    }
    const result = await this.provider.exportToExcel(input.data);
    return {
      success: true,
      data: {
        url: result.url,
        filename: input.filename || 'export.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    };
  }

  private async handleConvertFormat(
    input: ExportInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.data) {
      throw new Error('data is required for convert_format action');
    }
    const fromFormat = input.format || 'json';
    const toFormat = input.options?.compression ? 'csv' : 'json';
    const dataStr =
      typeof input.data === 'string' ? input.data : JSON.stringify(input.data);
    const result = await this.provider.convertFormat(
      dataStr,
      fromFormat,
      toFormat,
    );
    return {
      success: true,
      data: {
        content: result.content,
        from: fromFormat,
        to: toFormat,
      },
    };
  }

  private async handleBatchExport(
    input: ExportInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.sourceId) {
      throw new Error('sourceId is required for batch_export action');
    }
    const format = input.format || 'csv';
    const dataIds = input.sourceId.split(',').map((s) => s.trim());
    const result = await this.provider.createBatchExport(dataIds, format);
    return {
      success: true,
      data: result,
    };
  }

  private async handleGetExportStatus(
    input: ExportInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.exportId) {
      throw new Error('exportId is required for get_export_status action');
    }
    const result = await this.provider.getExportStatus(input.exportId);
    return {
      success: true,
      data: result,
    };
  }
}
