/**
 * LangSmith Tracing Service
 *
 * Provides observability for AI agent services using LangSmith SDK.
 * Enables tracing of LLM calls, tool executions, and agent workflows.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Span representation for tracing
 */
export interface Span {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  metadata: Record<string, unknown>;
  parentId?: string;
  success?: boolean;
  error?: string;
}

/**
 * LangSmith configuration
 */
export interface LangSmithConfig {
  apiKey: string;
  project: string;
  endpoint: string;
  enabled: boolean;
}

/**
 * LangSmith tracing event types
 */
export type LangSmithEvent = {
  type: 'start' | 'end' | 'error' | 'event';
  timestamp: number;
  data: unknown;
  name?: string;
};

@Injectable()
export class LangSmithTracingService {
  private readonly logger = new Logger(LangSmithTracingService.name);
  private readonly config: LangSmithConfig;
  private readonly activeSpans: Map<string, Span> = new Map();
  private readonly traceBuffer: LangSmithEvent[] = [];
  private flushTimeout?: NodeJS.Timeout;

  constructor(private readonly configService?: ConfigService) {
    const cfgGet =
      configService && typeof (configService as any).get === 'function'
        ? (key: string) => (configService as any).get(key) as string | undefined
        : (key: string) => process.env[key];

    this.config = {
      apiKey: (cfgGet('LANGSMITH_API_KEY') as string) ?? '',
      project: (cfgGet('LANGSMITH_PROJECT') as string) ?? 'neurecore',
      endpoint:
        (cfgGet('LANGSMITH_ENDPOINT') as string) ??
        'https://api.smith.langchain.com',
      enabled:
        (cfgGet('LANGSMITH_TRACING_ENABLED') as unknown as boolean) ?? false,
    };

    if (this.config.enabled && this.config.apiKey) {
      this.logger.log(
        `LangSmith tracing enabled for project: ${this.config.project}`,
      );
    } else {
      this.logger.log('LangSmith tracing disabled');
    }
  }

  /**
   * Start a new trace span
   */
  startSpan(params: {
    name: string;
    metadata?: Record<string, unknown>;
    parentId?: string;
  }): Span | null {
    if (!this.config.enabled) {
      return null;
    }

    const span: Span = {
      id: uuidv4(),
      name: params.name,
      startTime: Date.now(),
      metadata: params.metadata ?? {},
      parentId: params.parentId,
    };

    this.activeSpans.set(span.id, span);
    this.emitEvent({ type: 'start', timestamp: span.startTime, data: span });

    this.logger.debug(`Started span: ${span.name} (${span.id})`);

    return span;
  }

  /**
   * End a span and record its completion
   */
  endSpan(
    spanId: string | undefined,
    params?: {
      success?: boolean;
      error?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    if (!spanId || !this.config.enabled) {
      return;
    }

    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Span not found: ${spanId}`);
      return;
    }

    span.endTime = Date.now();
    span.success = params?.success ?? true;
    span.error = params?.error;
    span.metadata = { ...span.metadata, ...params?.metadata };

    this.activeSpans.delete(spanId);
    this.emitEvent({ type: 'end', timestamp: span.endTime, data: span });

    this.logger.debug(
      `Ended span: ${span.name} (${span.id}) - ${span.success ? 'success' : 'failed'}`,
    );
  }

  /**
   * Record a custom event within a span
   */
  recordEvent(
    spanId: string | undefined,
    eventName: string,
    data: Record<string, unknown>,
  ): void {
    if (!spanId || !this.config.enabled) {
      return;
    }

    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Cannot record event - span not found: ${spanId}`);
      return;
    }

    const event: LangSmithEvent = {
      type: 'event',
      name: eventName,
      timestamp: Date.now(),
      data,
    };

    this.emitEvent(event);
    this.logger.debug(
      `Recorded event "${eventName}" for span: ${span.name} (${span.id})`,
    );
  }

  /**
   * Create a child span under a parent
   */
  startChildSpan(
    parentId: string | undefined,
    name: string,
    metadata?: Record<string, unknown>,
  ): Span | null {
    if (!this.config.enabled) {
      return null;
    }

    const parent = parentId ? this.activeSpans.get(parentId) : undefined;

    return this.startSpan({
      name,
      metadata,
      parentId: parent?.id,
    });
  }

  /**
   * Wrap an async operation with tracing
   */
  async trace<T>(
    name: string,
    fn: (span: Span | null) => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const span = this.startSpan({ name, metadata });

    try {
      const result = await fn(span);
      this.endSpan(span?.id, { success: true });
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.endSpan(span?.id, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Flush any buffered traces to LangSmith
   */
  async flush(): Promise<void> {
    if (this.traceBuffer.length === 0) {
      return;
    }

    const events = [...this.traceBuffer];
    this.traceBuffer.length = 0;

    if (!this.config.apiKey) {
      return;
    }

    try {
      await this.sendToLangSmith(events);
      this.logger.debug(`Flushed ${events.length} trace events to LangSmith`);
    } catch (error) {
      this.logger.error(
        `Failed to flush traces: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Re-buffer on failure
      this.traceBuffer.push(...events);
    }
  }

  /**
   * Get all active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Check if tracing is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Emit an event to the buffer
   */
  private emitEvent(event: LangSmithEvent): void {
    this.traceBuffer.push(event);

    // Auto-flush if buffer gets too large
    if (this.traceBuffer.length >= 100) {
      this.scheduleFlush();
    }
  }

  /**
   * Schedule a flush to debounce rapid events
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      return;
    }

    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = undefined;
      this.flush().catch((err) => {
        this.logger.error(`Scheduled flush failed: ${err}`);
      });
    }, 1000);
  }

  /**
   * Send events to LangSmith API via the official langsmith SDK.
   *
   * Uses dynamic import to keep startup cost zero when tracing is disabled.
   * Failures are intentionally swallowed — tracing must never crash the agent.
   */
  private async sendToLangSmith(events: LangSmithEvent[]): Promise<void> {
    if (!this.config.apiKey || events.length === 0) {
      return;
    }

    try {
      const { Client } = await import('langsmith');
      const client = new Client({
        apiUrl: this.config.endpoint,
        apiKey: this.config.apiKey,
      });

      for (const event of events) {
        if (event.type === 'start') {
          await client.createRun({
            name: (event.name as string) ?? 'unnamed',
            run_type: 'chain',
            inputs: (event.data as Record<string, unknown>) ?? {},
            project_name: this.config.project,
          });
        }
      }

      this.logger.debug(
        `Sent ${events.length} trace event(s) to LangSmith project '${this.config.project}'`,
      );
    } catch (error) {
      // Non-fatal — log and continue
      this.logger.warn(
        `LangSmith send failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
