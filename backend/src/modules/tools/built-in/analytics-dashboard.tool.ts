/**
 * Analytics Dashboard Tool - P0-1 of remaining tools
 * Enables AI agents to query metrics, create charts, and manage dashboards
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for analytics operations
 * - OCP: Extensible via metric providers
 * - DIP: Depends on abstractions for data sources
 */

import { Injectable } from '@nestjs/common';
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

export const AnalyticsDashboardActionEnum = z.enum([
  'query_metrics',
  'create_chart',
  'export_dashboard',
  'set_alert',
  'list_dashboards',
  'get_dashboard',
]);

export type AnalyticsDashboardAction = z.infer<
  typeof AnalyticsDashboardActionEnum
>;

export const AnalyticsDashboardInputSchema = z.object({
  action: AnalyticsDashboardActionEnum.describe(
    'The analytics action to perform',
  ),
  metricType: z
    .enum([
      'revenue',
      'tasks_completed',
      'agent_usage',
      'user_activity',
      'conversions',
      'cost',
      'custom',
    ])
    .optional()
    .describe('Type of metric to query'),
  timeRange: z
    .enum(['today', 'week', 'month', 'quarter', 'year', 'custom'])
    .optional()
    .describe('Time range for metrics'),
  startDate: z
    .string()
    .optional()
    .describe('Start date for custom time range (ISO)'),
  endDate: z
    .string()
    .optional()
    .describe('End date for custom time range (ISO)'),
  chartType: z
    .enum(['line', 'bar', 'pie', 'area', 'scatter', 'table'])
    .optional()
    .describe('Type of chart to create'),
  chartTitle: z.string().optional().describe('Title for the chart'),
  dataSource: z.string().optional().describe('Data source for chart'),
  dashboardId: z.string().optional().describe('Dashboard ID for export'),
  exportFormat: z
    .enum(['pdf', 'csv', 'json', 'png'])
    .optional()
    .describe('Export format'),
  alertCondition: z
    .object({
      metric: z.string(),
      operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
      threshold: z.number(),
      channel: z.enum(['email', 'slack', 'sms']),
    })
    .optional()
    .describe('Alert condition to set'),
  filters: z
    .record(z.string(), z.string())
    .optional()
    .describe('Filters for metrics'),
});

export type AnalyticsDashboardInput = z.infer<
  typeof AnalyticsDashboardInputSchema
>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

export const MetricDataSchema = z.object({
  label: z.string(),
  value: z.number(),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  timestamp: z.date().optional(),
});

export const ChartDataSchema = z.object({
  chartId: z.string(),
  title: z.string(),
  type: z.string(),
  data: z.array(MetricDataSchema),
  createdAt: z.date(),
});

export const DashboardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  charts: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AlertSchema = z.object({
  id: z.string(),
  metric: z.string(),
  condition: z.string(),
  threshold: z.number(),
  status: z.enum(['active', 'paused', 'triggered']),
  createdAt: z.date(),
});

export const AnalyticsDashboardOutputSchema = z.object({
  action: z.string(),
  metrics: z.array(MetricDataSchema).optional(),
  chart: ChartDataSchema.optional(),
  dashboard: DashboardSchema.optional(),
  dashboards: z.array(DashboardSchema).optional(),
  alert: AlertSchema.optional(),
  exportUrl: z.string().optional(),
  message: z.string().optional(),
});

export type AnalyticsDashboardOutput = z.infer<
  typeof AnalyticsDashboardOutputSchema
>;

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

interface IMetricProvider {
  queryMetrics(options: {
    metricType: string;
    timeRange: string;
    startDate?: string;
    endDate?: string;
    filters?: Record<string, string>;
  }): Promise<z.infer<typeof MetricDataSchema>[]>;
}

interface IChartProvider {
  createChart(options: {
    type: string;
    title: string;
    data: z.infer<typeof MetricDataSchema>[];
    dataSource?: string;
  }): Promise<z.infer<typeof ChartDataSchema>>;
}

interface IDashboardProvider {
  listDashboards(): Promise<z.infer<typeof DashboardSchema>[]>;
  getDashboard(id: string): Promise<z.infer<typeof DashboardSchema>>;
  exportDashboard(id: string, format: string): Promise<{ url: string }>;
}

interface IAlertProvider {
  setAlert(options: {
    metric: string;
    operator: string;
    threshold: number;
    channel: string;
  }): Promise<z.infer<typeof AlertSchema>>;
}

// ─────────────────────────────────────────────────────────────
// Implementations
// ─────────────────────────────────────────────────────────────

@Injectable()
class DatabaseMetricProvider implements IMetricProvider {
  // Simulated database metrics - in production, query from database
  private generateMetricData(
    metricType: string,
    timeRange: string,
  ): z.infer<typeof MetricDataSchema>[] {
    const now = new Date();
    const data: z.infer<typeof MetricDataSchema>[] = [];

    switch (timeRange) {
      case 'today':
        for (let i = 0; i < 24; i++) {
          data.push({
            label: `${i}:00`,
            value: Math.floor(Math.random() * 100) + 50,
            change:
              Math.random() > 0.5 ? Math.random() * 20 : -Math.random() * 20,
            changePercent: Math.random() * 10 - 5,
            timestamp: new Date(now.getTime() - (23 - i) * 3600000),
          });
        }
        break;
      case 'week':
        for (let i = 0; i < 7; i++) {
          data.push({
            label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
            value: Math.floor(Math.random() * 1000) + 500,
            change:
              Math.random() > 0.5 ? Math.random() * 200 : -Math.random() * 200,
            changePercent: Math.random() * 20 - 10,
            timestamp: new Date(now.getTime() - (6 - i) * 86400000),
          });
        }
        break;
      case 'month':
        for (let i = 0; i < 30; i++) {
          data.push({
            label: `Day ${i + 1}`,
            value: Math.floor(Math.random() * 5000) + 1000,
            change:
              Math.random() > 0.5 ? Math.random() * 500 : -Math.random() * 500,
            changePercent: Math.random() * 15 - 7.5,
            timestamp: new Date(now.getTime() - (29 - i) * 86400000),
          });
        }
        break;
      default:
        for (let i = 0; i < 12; i++) {
          data.push({
            label: [
              'Jan',
              'Feb',
              'Mar',
              'Apr',
              'May',
              'Jun',
              'Jul',
              'Aug',
              'Sep',
              'Oct',
              'Nov',
              'Dec',
            ][i],
            value: Math.floor(Math.random() * 50000) + 10000,
            change:
              Math.random() > 0.5
                ? Math.random() * 5000
                : -Math.random() * 5000,
            changePercent: Math.random() * 20 - 10,
            timestamp: new Date(now.getFullYear(), i, 1),
          });
        }
    }

    return data;
  }

  async queryMetrics(options: {
    metricType: string;
    timeRange: string;
    startDate?: string;
    endDate?: string;
    filters?: Record<string, string>;
  }): Promise<z.infer<typeof MetricDataSchema>[]> {
    return this.generateMetricData(options.metricType, options.timeRange);
  }
}

@Injectable()
class MockChartProvider implements IChartProvider {
  private charts: Map<string, z.infer<typeof ChartDataSchema>> = new Map();

  async createChart(options: {
    type: string;
    title: string;
    data: z.infer<typeof MetricDataSchema>[];
    dataSource?: string;
  }): Promise<z.infer<typeof ChartDataSchema>> {
    const chartId = `chart_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const chart: z.infer<typeof ChartDataSchema> = {
      chartId,
      title: options.title,
      type: options.type,
      data: options.data,
      createdAt: new Date(),
    };
    this.charts.set(chartId, chart);
    return chart;
  }
}

@Injectable()
class MockDashboardProvider implements IDashboardProvider {
  private dashboards: z.infer<typeof DashboardSchema>[] = [
    {
      id: 'dash_1',
      name: 'Sales Overview',
      description: 'Sales metrics and KPIs',
      charts: ['chart_1', 'chart_2'],
      createdAt: new Date(Date.now() - 30 * 86400000),
      updatedAt: new Date(),
    },
    {
      id: 'dash_2',
      name: 'Agent Performance',
      description: 'AI agent usage and performance',
      charts: ['chart_3', 'chart_4'],
      createdAt: new Date(Date.now() - 15 * 86400000),
      updatedAt: new Date(),
    },
    {
      id: 'dash_3',
      name: 'Finance Dashboard',
      description: 'Revenue and cost tracking',
      charts: ['chart_5'],
      createdAt: new Date(Date.now() - 7 * 86400000),
      updatedAt: new Date(),
    },
  ];

  async listDashboards(): Promise<z.infer<typeof DashboardSchema>[]> {
    return this.dashboards;
  }

  async getDashboard(id: string): Promise<z.infer<typeof DashboardSchema>> {
    const dashboard = this.dashboards.find((d) => d.id === id);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${id}`);
    }
    return dashboard;
  }

  async exportDashboard(id: string, format: string): Promise<{ url: string }> {
    const dashboard = this.dashboards.find((d) => d.id === id);
    if (!dashboard) {
      throw new Error(`Dashboard not found: ${id}`);
    }
    return {
      url: `https://api.neurecore.com/exports/${id}.${format}`,
    };
  }
}

@Injectable()
class MockAlertProvider implements IAlertProvider {
  private alerts: z.infer<typeof AlertSchema>[] = [];

  async setAlert(options: {
    metric: string;
    operator: string;
    threshold: number;
    channel: string;
  }): Promise<z.infer<typeof AlertSchema>> {
    const alert: z.infer<typeof AlertSchema> = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      metric: options.metric,
      condition: `${options.metric} ${options.operator} ${options.threshold}`,
      threshold: options.threshold,
      status: 'active',
      createdAt: new Date(),
    };
    this.alerts.push(alert);
    return alert;
  }
}

// ─────────────────────────────────────────────────────────────
// Main Tool
// ─────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsDashboardTool extends BaseStructuredTool {
  readonly name = 'analytics_dashboard';
  readonly description =
    'Query metrics, create charts, manage dashboards, and set alerts for analytics. Use for dashboards, reporting, and performance monitoring across Marketing, Sales, Product, HR, and Finance departments.';
  readonly category = ToolCategory.DATA;
  readonly inputSchema = AnalyticsDashboardInputSchema;

  private readonly metricProvider: IMetricProvider;
  private readonly chartProvider: IChartProvider;
  private readonly dashboardProvider: IDashboardProvider;
  private readonly alertProvider: IAlertProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.metricProvider = new DatabaseMetricProvider();
    this.chartProvider = new MockChartProvider();
    this.dashboardProvider = new MockDashboardProvider();
    this.alertProvider = new MockAlertProvider();
  }

  protected async executeImpl(
    input: AnalyticsDashboardInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<unknown>> {
    const startTime = Date.now();
    const { action } = input;

    try {
      switch (action) {
        case 'query_metrics':
          return await this.handleQueryMetrics(input, startTime);
        case 'create_chart':
          return await this.handleCreateChart(input, startTime);
        case 'export_dashboard':
          return await this.handleExportDashboard(input, startTime);
        case 'set_alert':
          return await this.handleSetAlert(input, startTime);
        case 'list_dashboards':
          return await this.handleListDashboards(startTime);
        case 'get_dashboard':
          return await this.handleGetDashboard(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      this.logger.error(`Analytics dashboard action ${action} failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleQueryMetrics(
    input: AnalyticsDashboardInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const {
      metricType = 'custom',
      timeRange = 'month',
      startDate,
      endDate,
      filters,
    } = input;

    const metrics = await this.metricProvider.queryMetrics({
      metricType,
      timeRange,
      startDate,
      endDate,
      filters,
    });

    return {
      success: true,
      data: {
        action: 'query_metrics',
        metrics,
        message: `Retrieved ${metrics.length} metric data points for ${metricType}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleCreateChart(
    input: AnalyticsDashboardInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const {
      chartType = 'bar',
      chartTitle = 'Chart',
      metricType = 'custom',
      timeRange = 'month',
    } = input;

    // First get the data
    const metrics = await this.metricProvider.queryMetrics({
      metricType,
      timeRange,
    });

    // Then create the chart
    const chart = await this.chartProvider.createChart({
      type: chartType,
      title: chartTitle,
      data: metrics,
      dataSource: input.dataSource,
    });

    return {
      success: true,
      data: {
        action: 'create_chart',
        chart,
        message: `Chart "${chartTitle}" created successfully`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleExportDashboard(
    input: AnalyticsDashboardInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { dashboardId, exportFormat = 'pdf' } = input;

    if (!dashboardId) {
      return {
        success: false,
        error: 'dashboardId is required for export',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const exportUrl = await this.dashboardProvider.exportDashboard(
      dashboardId,
      exportFormat,
    );

    return {
      success: true,
      data: {
        action: 'export_dashboard',
        exportUrl: exportUrl.url,
        message: `Dashboard exported as ${exportFormat}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleSetAlert(
    input: AnalyticsDashboardInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { alertCondition } = input;

    if (!alertCondition) {
      return {
        success: false,
        error: 'alertCondition is required to set an alert',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const alert = await this.alertProvider.setAlert({
      metric: alertCondition.metric,
      operator: alertCondition.operator,
      threshold: alertCondition.threshold,
      channel: alertCondition.channel,
    });

    return {
      success: true,
      data: {
        action: 'set_alert',
        alert,
        message: `Alert set for ${alertCondition.metric} ${alertCondition.operator} ${alertCondition.threshold}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleListDashboards(
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const dashboards = await this.dashboardProvider.listDashboards();

    return {
      success: true,
      data: {
        action: 'list_dashboards',
        dashboards,
        message: `Retrieved ${dashboards.length} dashboards`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleGetDashboard(
    input: AnalyticsDashboardInput,
    startTime: number,
  ): Promise<StructuredToolResult<unknown>> {
    const { dashboardId } = input;

    if (!dashboardId) {
      return {
        success: false,
        error: 'dashboardId is required to get dashboard',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const dashboard = await this.dashboardProvider.getDashboard(dashboardId);

    return {
      success: true,
      data: {
        action: 'get_dashboard',
        dashboard,
        message: `Retrieved dashboard: ${dashboard.name}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}
