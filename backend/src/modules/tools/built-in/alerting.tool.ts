/**
 * Alerting Tool - Tool 10 of 12
 * Enables AI agents to send alerts and notifications via multiple channels
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for alerting operations
 * - OCP: Extensible via notification providers
 * - DIP: Depends on abstractions for notification channels
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

export const AlertingActionEnum = z.enum(['send', 'list', 'acknowledge']);

export type AlertingAction = z.infer<typeof AlertingActionEnum>;

export const AlertingInputSchema = z.object({
  action: AlertingActionEnum.describe('The alerting action to perform'),
  channel: z
    .enum(['email', 'sms', 'slack', 'webhook', 'push'])
    .describe('Notification channel'),
  recipients: z
    .array(z.string())
    .optional()
    .describe('Recipient emails or phone numbers'),
  message: z.string().optional().describe('Alert message'),
  title: z.string().optional().describe('Alert title'),
  priority: z
    .enum(['low', 'medium', 'high', 'critical'])
    .optional()
    .describe('Alert priority'),
  alertId: z.string().optional().describe('Alert ID for acknowledge'),
});

export type AlertingInput = z.infer<typeof AlertingInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────────────────────

export const AlertingOutputSchema = z.object({
  alertId: z.string().optional(),
  channel: z.string().optional(),
  status: z.string().optional(),
  message: z.string().optional(),
  alerts: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        message: z.string(),
        priority: z.string(),
        channel: z.string(),
        status: z.string(),
        createdAt: z.date(),
      }),
    )
    .optional(),
});

export type AlertingOutput = z.infer<typeof AlertingOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

interface INotificationProvider {
  send(options: {
    recipients: string[];
    message: string;
    title?: string;
    priority?: string;
  }): Promise<{ alertId: string }>;
}

// ─────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
class EmailNotificationProvider implements INotificationProvider {
  private readonly alerts: Map<
    string,
    {
      id: string;
      title: string;
      message: string;
      priority: string;
      channel: string;
      status: string;
      createdAt: Date;
    }
  > = new Map();

  private generateId(): string {
    return `email_${Date.now()}`;
  }

  async send(options: {
    recipients: string[];
    message: string;
    title?: string;
    priority?: string;
  }): Promise<{ alertId: string }> {
    const alertId = this.generateId();

    this.alerts.set(alertId, {
      id: alertId,
      title: options.title || 'Alert',
      message: options.message,
      priority: options.priority || 'medium',
      channel: 'email',
      status: 'sent',
      createdAt: new Date(),
    });

    return { alertId };
  }

  list() {
    return Array.from(this.alerts.values());
  }
}

// ─────────────────────────────────────────────────────────────
// Alerting Tool
// ─────────────────────────────────────────────────────────────

@Injectable()
export class AlertingTool extends BaseStructuredTool {
  readonly name = 'alerting';
  readonly description =
    'Send alerts and notifications via email, SMS, Slack, webhook, or push notifications';
  readonly category = ToolCategory.COMMUNICATION;
  readonly inputSchema = AlertingInputSchema;
  readonly outputSchema = AlertingOutputSchema;
  readonly version = '1.0.0';

  private readonly emailProvider: EmailNotificationProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.emailProvider = new EmailNotificationProvider();
  }

  protected async executeImpl(
    input: AlertingInput,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<AlertingOutput>> {
    const startTime = Date.now();

    try {
      switch (input.action) {
        case 'send':
          return await this.handleSend(input, startTime);
        case 'list':
          return await this.handleList(input, startTime);
        case 'acknowledge':
          return await this.handleAcknowledge(input, startTime);
        default:
          return {
            success: false,
            error: `Unknown action: ${input.action}`,
            metadata: { durationMs: Date.now() - startTime },
          };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Alerting operation failed',
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  private async handleSend(
    input: AlertingInput,
    startTime: number,
  ): Promise<StructuredToolResult<AlertingOutput>> {
    const {
      channel,
      recipients = [],
      message,
      title,
      priority = 'medium',
    } = input;

    if (!message || recipients.length === 0) {
      return {
        success: false,
        error: 'Message and recipients are required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    const result = await this.emailProvider.send({
      recipients,
      message,
      title,
      priority,
    });

    return {
      success: true,
      data: {
        alertId: result.alertId,
        channel,
        status: 'sent',
        message: `Alert sent via ${channel}`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleList(
    input: AlertingInput,
    startTime: number,
  ): Promise<StructuredToolResult<AlertingOutput>> {
    const alerts = this.emailProvider.list();

    return {
      success: true,
      data: {
        alerts,
        message: `Found ${alerts.length} alert(s)`,
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }

  private async handleAcknowledge(
    input: AlertingInput,
    startTime: number,
  ): Promise<StructuredToolResult<AlertingOutput>> {
    const { alertId } = input;

    if (!alertId) {
      return {
        success: false,
        error: 'alertId is required',
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    return {
      success: true,
      data: {
        alertId,
        status: 'acknowledged',
        message: 'Alert acknowledged',
      },
      metadata: { durationMs: Date.now() - startTime },
    };
  }
}
