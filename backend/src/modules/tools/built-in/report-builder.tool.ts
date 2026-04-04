/**
 * Report Builder Tool - P1-7 of remaining tools
 * Enables AI agents to create custom reports for Analytics, BI Analyst
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for report operations
 * - OCP: Extensible via report provider interfaces
 * - DIP: Depends on abstractions for data sources
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

export const ReportBuilderActionEnum = z.enum([
  'create_report',
  'add_widget',
  'schedule_report',
  'export_report',
  'list_reports',
  'get_report',
  'update_report',
  'delete_report',
]);

export type ReportBuilderAction = z.infer<typeof ReportBuilderActionEnum>;

export const ReportBuilderInputSchema = z.object({
  action: ReportBuilderActionEnum.describe(
    'The report builder action to perform',
  ),
  // For create_report, update_report
  reportId: z.string().optional().describe('Report ID'),
  title: z.string().optional().describe('Report title'),
  description: z.string().optional().describe('Report description'),
  // For add_widget
  widgetType: z
    .enum(['chart', 'table', 'metric', 'text', 'image'])
    .optional()
    .describe('Type of widget to add'),
  widgetConfig: z
    .record(z.unknown())
    .optional()
    .describe('Widget configuration'),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe('Widget position and size'),
  // For schedule_report
  schedule: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      time: z.string(),
      timezone: z.string().optional(),
    })
    .optional()
    .describe('Schedule configuration'),
  recipients: z.array(z.string()).optional().describe('Email recipients'),
  // For export_report
  format: z
    .enum(['pdf', 'csv', 'excel', 'json'])
    .optional()
    .describe('Export format'),
  // For list_reports
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  // For get_report, delete_report
  getReportId: z.string().optional().describe('Report ID'),
});

export type ReportBuilderInput = z.infer<typeof ReportBuilderInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schemas
// ─────────────────────────────────────────────────────────────

export const WidgetSchema = z.object({
  id: z.string(),
  type: z.enum(['chart', 'table', 'metric', 'text', 'image']),
  config: z.record(z.unknown()),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

export const ReportSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  widgets: z.array(WidgetSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  schedule: z
    .object({
      frequency: z.string(),
      time: z.string(),
      timezone: z.string().optional(),
    })
    .optional(),
});

export const ReportBuilderOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  report: ReportSchema.optional(),
  reports: z.array(ReportSchema).optional(),
  exportUrl: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IReportProvider {
  createReport(options: {
    title: string;
    description?: string;
  }): Promise<z.infer<typeof ReportSchema>>;

  updateReport(
    reportId: string,
    options: { title?: string; description?: string },
  ): Promise<z.infer<typeof ReportSchema>>;

  addWidget(
    reportId: string,
    options: {
      type: string;
      config: Record<string, unknown>;
      position?: { x: number; y: number; width: number; height: number };
    },
  ): Promise<z.infer<typeof WidgetSchema>>;

  scheduleReport(
    reportId: string,
    options: {
      frequency: string;
      time: string;
      timezone?: string;
      recipients?: string[];
    },
  ): Promise<{ scheduleId: string }>;

  exportReport(reportId: string, format: string): Promise<{ url: string }>;

  getReport(reportId: string): Promise<z.infer<typeof ReportSchema>>;

  listReports(options: { page: number; limit: number }): Promise<{
    reports: z.infer<typeof ReportSchema>[];
    total: number;
  }>;

  deleteReport(reportId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Mock Report Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockReportProvider implements IReportProvider {
  private readonly logger = new Logger(MockReportProvider.name);
  private reports = new Map<string, z.infer<typeof ReportSchema>>();
  private widgetIdCounter = 1;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const mockReports = [
      {
        id: 'report-1',
        title: 'Sales Performance Q1 2026',
        description: 'Quarterly sales metrics and trends',
        widgets: [
          {
            id: 'w1',
            type: 'chart' as const,
            config: { chartType: 'bar', dataSource: 'sales' },
            position: { x: 0, y: 0, width: 2, height: 1 },
          },
          {
            id: 'w2',
            type: 'metric' as const,
            config: { label: 'Total Revenue', value: 250000 },
            position: { x: 2, y: 0, width: 1, height: 1 },
          },
        ],
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: '2026-04-03T15:30:00Z',
      },
      {
        id: 'report-2',
        title: 'Marketing Campaign Analysis',
        description: 'Marketing campaign performance metrics',
        widgets: [
          {
            id: 'w3',
            type: 'table' as const,
            config: {
              columns: ['Campaign', 'Impressions', 'Clicks'],
              data: [],
            },
            position: { x: 0, y: 0, width: 3, height: 2 },
          },
        ],
        createdAt: '2026-03-28T09:00:00Z',
        updatedAt: '2026-04-02T11:00:00Z',
      },
    ];
    mockReports.forEach((r) => this.reports.set(r.id, r));
  }

  async createReport(options: {
    title: string;
    description?: string;
  }): Promise<z.infer<typeof ReportSchema>> {
    this.logger.log(`Creating report: ${options.title}`);
    const id = `report-${Date.now()}`;
    const report: z.infer<typeof ReportSchema> = {
      id,
      title: options.title,
      description: options.description,
      widgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.reports.set(id, report);
    return report;
  }

  async updateReport(
    reportId: string,
    options: { title?: string; description?: string },
  ): Promise<z.infer<typeof ReportSchema>> {
    this.logger.log(`Updating report: ${reportId}`);
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }
    const updated = {
      ...report,
      ...options,
      updatedAt: new Date().toISOString(),
    };
    this.reports.set(reportId, updated);
    return updated;
  }

  async addWidget(
    reportId: string,
    options: {
      type: string;
      config: Record<string, unknown>;
      position?: { x: number; y: number; width: number; height: number };
    },
  ): Promise<z.infer<typeof WidgetSchema>> {
    this.logger.log(`Adding widget to report: ${reportId}`);
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }
    const widget: z.infer<typeof WidgetSchema> = {
      id: `widget-${this.widgetIdCounter++}`,
      type: options.type as 'chart' | 'table' | 'metric' | 'text' | 'image',
      config: options.config,
      position: options.position || { x: 0, y: 0, width: 1, height: 1 },
    };
    report.widgets.push(widget);
    report.updatedAt = new Date().toISOString();
    this.reports.set(reportId, report);
    return widget;
  }

  async scheduleReport(
    reportId: string,
    options: {
      frequency: string;
      time: string;
      timezone?: string;
      recipients?: string[];
    },
  ): Promise<{ scheduleId: string }> {
    this.logger.log(`Scheduling report: ${reportId}`);
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }
    report.schedule = {
      frequency: options.frequency,
      time: options.time,
      timezone: options.timezone,
    };
    this.reports.set(reportId, report);
    return { scheduleId: `schedule-${Date.now()}` };
  }

  async exportReport(
    reportId: string,
    format: string,
  ): Promise<{ url: string }> {
    this.logger.log(`Exporting report: ${reportId} as ${format}`);
    return { url: `https://storage.example.com/exports/${reportId}.${format}` };
  }

  async getReport(reportId: string): Promise<z.infer<typeof ReportSchema>> {
    this.logger.log(`Getting report: ${reportId}`);
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }
    return report;
  }

  async listReports(options: {
    page: number;
    limit: number;
  }): Promise<{ reports: z.infer<typeof ReportSchema>[]; total: number }> {
    this.logger.log(
      `Listing reports: page ${options.page}, limit ${options.limit}`,
    );
    const reports = Array.from(this.reports.values());
    const total = reports.length;
    const start = (options.page - 1) * options.limit;
    return { reports: reports.slice(start, start + options.limit), total };
  }

  async deleteReport(reportId: string): Promise<void> {
    this.logger.log(`Deleting report: ${reportId}`);
    if (!this.reports.has(reportId)) {
      throw new Error(`Report not found: ${reportId}`);
    }
    this.reports.delete(reportId);
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ReportBuilderTool extends BaseStructuredTool {
  readonly name = 'report_builder';
  readonly description =
    'Create and manage custom reports with widgets, scheduling, and exports';
  readonly category = ToolCategory.DATA;
  readonly inputSchema = ReportBuilderInputSchema;

  private readonly log = new Logger(ReportBuilderTool.name);
  private readonly provider: IReportProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockReportProvider();
  }

  protected async executeImpl(
    input: ReportBuilderInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.logger.log(`Executing Report Builder action: ${input.action}`);

    try {
      switch (input.action) {
        case 'create_report':
          return await this.handleCreateReport(input);
        case 'add_widget':
          return await this.handleAddWidget(input);
        case 'schedule_report':
          return await this.handleScheduleReport(input);
        case 'export_report':
          return await this.handleExportReport(input);
        case 'list_reports':
          return await this.handleListReports(input);
        case 'get_report':
          return await this.handleGetReport(input);
        case 'update_report':
          return await this.handleUpdateReport(input);
        case 'delete_report':
          return await this.handleDeleteReport(input);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(`Report Builder action failed: ${err.message}`, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleCreateReport(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.title) {
      throw new Error('title is required for create_report action');
    }
    const report = await this.provider.createReport({
      title: input.title,
      description: input.description,
    });
    return {
      success: true,
      data: { report, message: 'Report created successfully' },
    };
  }

  private async handleAddWidget(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.reportId || !input.widgetType) {
      throw new Error(
        'reportId and widgetType are required for add_widget action',
      );
    }
    const widget = await this.provider.addWidget(input.reportId, {
      type: input.widgetType,
      config: input.widgetConfig || {},
      position: input.position,
    });
    return {
      success: true,
      data: { widget, message: 'Widget added successfully' },
    };
  }

  private async handleScheduleReport(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.reportId || !input.schedule) {
      throw new Error(
        'reportId and schedule are required for schedule_report action',
      );
    }
    const result = await this.provider.scheduleReport(input.reportId, {
      frequency: input.schedule.frequency,
      time: input.schedule.time,
      timezone: input.schedule.timezone,
      recipients: input.recipients,
    });
    return {
      success: true,
      data: {
        scheduleId: result.scheduleId,
        message: 'Report scheduled successfully',
      },
    };
  }

  private async handleExportReport(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.reportId) {
      throw new Error('reportId is required for export_report action');
    }
    const result = await this.provider.exportReport(
      input.reportId,
      input.format || 'pdf',
    );
    return {
      success: true,
      data: { exportUrl: result.url, message: 'Report exported successfully' },
    };
  }

  private async handleListReports(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.listReports({
      page: input.page || 1,
      limit: input.limit || 20,
    });
    return {
      success: true,
      data: { reports: result.reports, total: result.total },
    };
  }

  private async handleGetReport(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.getReportId) {
      throw new Error('getReportId is required for get_report action');
    }
    const report = await this.provider.getReport(input.getReportId);
    return { success: true, data: { report } };
  }

  private async handleUpdateReport(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.reportId) {
      throw new Error('reportId is required for update_report action');
    }
    const report = await this.provider.updateReport(input.reportId, {
      title: input.title,
      description: input.description,
    });
    return {
      success: true,
      data: { report, message: 'Report updated successfully' },
    };
  }

  private async handleDeleteReport(
    input: ReportBuilderInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.getReportId) {
      throw new Error('getReportId is required for delete_report action');
    }
    await this.provider.deleteReport(input.getReportId);
    return { success: true, data: { message: 'Report deleted successfully' } };
  }
}
