/**
 * System Monitor Tool - P2-5 of remaining tools
 * Enables AI agents to monitor system health and metrics
 * For IT, System Monitor agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for system monitoring operations
 * - OCP: Extensible via monitoring provider interfaces
 * - DIP: Depends on abstractions for monitoring providers
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

export const SystemMonitorActionEnum = z.enum([
  'get_system_status',
  'get_metrics',
  'check_health',
  'get_alerts',
  'get_performance_data',
  'list_services',
]);

export type SystemMonitorAction = z.infer<typeof SystemMonitorActionEnum>;

export const SystemMonitorInputSchema = z.object({
  action: SystemMonitorActionEnum.describe(
    'The system monitor action to perform',
  ),
  systemId: z.string().optional().describe('System ID to monitor'),
  metricType: z
    .enum(['cpu', 'memory', 'disk', 'network', 'processes', 'custom'])
    .optional()
    .describe('Type of metrics to retrieve'),
  timeRange: z
    .enum(['1m', '5m', '15m', '1h', '6h', '24h', '7d'])
    .optional()
    .default('5m')
    .describe('Time range for metrics'),
  serviceName: z.string().optional().describe('Service name'),
  severity: z
    .enum(['critical', 'warning', 'info'])
    .optional()
    .describe('Alert severity filter'),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type SystemMonitorInput = z.infer<typeof SystemMonitorInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type SystemStatus = {
  systemId: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  lastCheck: string;
  components: Array<{
    name: string;
    status: string;
    health: number;
  }>;
};

type MetricsData = {
  metric: string;
  values: Array<{ timestamp: number; value: number }>;
  unit: string;
  currentValue: number;
  average: number;
  peak: number;
};

type HealthCheck = {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  responseTime: number;
  details: string;
  checkedAt: string;
};

type Alert = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
};

type PerformanceData = {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    in: number;
    out: number;
  };
};

type ServiceInfo = {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  cpu: number;
  memory: number;
  restarts: number;
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface ISystemMonitorProvider {
  getSystemStatus(systemId?: string): Promise<SystemStatus>;
  getMetrics(
    systemId: string,
    metricType: string,
    timeRange: string,
  ): Promise<MetricsData[]>;
  checkHealth(systemId: string): Promise<HealthCheck[]>;
  getAlerts(systemId?: string, severity?: string): Promise<Alert[]>;
  getPerformanceData(systemId: string): Promise<PerformanceData>;
  listServices(systemId: string): Promise<ServiceInfo[]>;
}

// ─────────────────────────────────────────────────────────────
// Mock System Monitor Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockSystemMonitorProvider implements ISystemMonitorProvider {
  private readonly logger = new Logger(MockSystemMonitorProvider.name);

  async getSystemStatus(systemId?: string): Promise<SystemStatus> {
    this.logger.log('Getting system status: ' + (systemId || 'default'));

    return {
      systemId: systemId || 'system-1',
      status: 'healthy',
      uptime: Math.floor(Math.random() * 86400000) + 3600000,
      lastCheck: new Date().toISOString(),
      components: [
        { name: 'API Server', status: 'running', health: 95 },
        { name: 'Database', status: 'running', health: 98 },
        { name: 'Cache', status: 'running', health: 92 },
        { name: 'Queue', status: 'running', health: 90 },
      ],
    };
  }

  async getMetrics(
    systemId: string,
    metricType: string,
    timeRange: string,
  ): Promise<MetricsData[]> {
    this.logger.log('Getting metrics: ' + metricType + ' for ' + timeRange);

    const points = this.getPointsForTimeRange(timeRange);
    const baseValue =
      metricType === 'cpu' ? 45 : metricType === 'memory' ? 60 : 30;

    const values: Array<{ timestamp: number; value: number }> = [];
    let currentTime = Date.now() - this.getMsForTimeRange(timeRange);

    for (let i = 0; i < points; i++) {
      values.push({
        timestamp: currentTime,
        value: baseValue + (Math.random() - 0.5) * 20,
      });
      currentTime += this.getMsForTimeRange(timeRange) / points;
    }

    const numericValues = values.map((v) => v.value);

    return [
      {
        metric: metricType,
        values,
        unit: '%',
        currentValue: numericValues[numericValues.length - 1],
        average:
          numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        peak: Math.max(...numericValues),
      },
    ];
  }

  private getPointsForTimeRange(timeRange: string): number {
    const points: Record<string, number> = {
      '1m': 10,
      '5m': 30,
      '15m': 45,
      '1h': 60,
      '6h': 72,
      '24h': 96,
      '7d': 168,
    };
    return points[timeRange] || 30;
  }

  private getMsForTimeRange(timeRange: string): number {
    const ms: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000,
    };
    return ms[timeRange] || 300000;
  }

  async checkHealth(systemId: string): Promise<HealthCheck[]> {
    this.logger.log('Checking health for: ' + systemId);

    return [
      {
        component: 'API Server',
        status: 'pass',
        responseTime: Math.floor(Math.random() * 100) + 20,
        details: 'All endpoints responding',
        checkedAt: new Date().toISOString(),
      },
      {
        component: 'Database',
        status: 'pass',
        responseTime: Math.floor(Math.random() * 50) + 10,
        details: 'Queries executing normally',
        checkedAt: new Date().toISOString(),
      },
    ];
  }

  async getAlerts(systemId?: string, severity?: string): Promise<Alert[]> {
    this.logger.log('Getting alerts');

    return [
      {
        id: 'alert-1',
        severity: 'warning',
        message: 'High memory usage detected',
        source: 'system-monitor',
        timestamp: new Date().toISOString(),
        acknowledged: false,
      },
    ];
  }

  async getPerformanceData(systemId: string): Promise<PerformanceData> {
    this.logger.log('Getting performance data for: ' + systemId);

    return {
      cpu: {
        usage: 45 + Math.random() * 30,
        cores: 8,
      },
      memory: {
        used: 8 + Math.random() * 4,
        total: 16,
        percentage: 50 + Math.random() * 30,
      },
      disk: {
        used: 250 + Math.random() * 100,
        total: 500,
        percentage: 50 + Math.random() * 20,
      },
      network: {
        in: Math.random() * 100,
        out: Math.random() * 50,
      },
    };
  }

  async listServices(systemId: string): Promise<ServiceInfo[]> {
    this.logger.log('Listing services for: ' + systemId);

    return [
      {
        name: 'api-server',
        status: 'running',
        uptime: Math.floor(Math.random() * 86400000),
        cpu: 15 + Math.random() * 20,
        memory: 500 + Math.random() * 300,
        restarts: 0,
      },
      {
        name: 'worker',
        status: 'running',
        uptime: Math.floor(Math.random() * 86400000),
        cpu: 30 + Math.random() * 40,
        memory: 200 + Math.random() * 200,
        restarts: Math.floor(Math.random() * 3),
      },
    ];
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class SystemMonitorTool extends BaseStructuredTool {
  readonly name = 'system_monitor';
  readonly description =
    'Monitor system health, get metrics, check services, and manage alerts';
  readonly category = ToolCategory.MONITORING;
  readonly inputSchema = SystemMonitorInputSchema;

  private readonly log = new Logger(SystemMonitorTool.name);
  private readonly provider: ISystemMonitorProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockSystemMonitorProvider();
  }

  protected async executeImpl(
    input: SystemMonitorInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing System Monitor action: ' + input.action);

    try {
      switch (input.action) {
        case 'get_system_status':
          return await this.handleGetSystemStatus(input);
        case 'get_metrics':
          return await this.handleGetMetrics(input);
        case 'check_health':
          return await this.handleCheckHealth(input);
        case 'get_alerts':
          return await this.handleGetAlerts(input);
        case 'get_performance_data':
          return await this.handleGetPerformanceData(input);
        case 'list_services':
          return await this.handleListServices(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('System Monitor action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleGetSystemStatus(
    input: SystemMonitorInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.getSystemStatus(input.systemId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetMetrics(
    input: SystemMonitorInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.systemId || !input.metricType) {
      throw new Error(
        'systemId and metricType are required for get_metrics action',
      );
    }

    const result = await this.provider.getMetrics(
      input.systemId,
      input.metricType,
      input.timeRange || '5m',
    );

    return {
      success: true,
      data: { metrics: result },
    };
  }

  private async handleCheckHealth(
    input: SystemMonitorInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.systemId) {
      throw new Error('systemId is required for check_health action');
    }

    const result = await this.provider.checkHealth(input.systemId);

    return {
      success: true,
      data: { healthChecks: result },
    };
  }

  private async handleGetAlerts(
    input: SystemMonitorInput,
  ): Promise<StructuredToolResult<unknown>> {
    const result = await this.provider.getAlerts(
      input.systemId,
      input.severity,
    );

    return {
      success: true,
      data: { alerts: result, count: result.length },
    };
  }

  private async handleGetPerformanceData(
    input: SystemMonitorInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.systemId) {
      throw new Error('systemId is required for get_performance_data action');
    }

    const result = await this.provider.getPerformanceData(input.systemId);

    return {
      success: true,
      data: result,
    };
  }

  private async handleListServices(
    input: SystemMonitorInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.systemId) {
      throw new Error('systemId is required for list_services action');
    }

    const result = await this.provider.listServices(input.systemId);

    return {
      success: true,
      data: { services: result, count: result.length },
    };
  }
}
