/**
 * OpenClaw Gateway Service
 *
 * Handles communication with OpenClaw-enabled AI agents.
 * Supports request/response pattern with automatic retry and tracing.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type {
  OpenClawConfig,
  AgentMessage,
  AgentResponse,
} from './ai-gateway.module';
import { LangSmithTracingService } from './langsmith-tracing.service';

/**
 * Simple per-tenant token bucket for outbound rate limiting.
 * SRP: rate-limit logic is encapsulated here, not in sendMessage().
 */
interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

@Injectable()
export class OpenClawGatewayService {
  private readonly logger = new Logger(OpenClawGatewayService.name);

  /**
   * Per-tenant rate-limit state. Process-scoped (acceptable for single-instance).
   * OCP: this Map is the only change needed to swap in a distributed store later.
   */
  private readonly rateBuckets = new Map<string, TokenBucket>();

  constructor(
    @Inject('OPENCLAW_CONFIG') private readonly config: OpenClawConfig,
    private readonly tracingService: LangSmithTracingService,
  ) {}

  // ─── Rate limiting ────────────────────────────────────────────────────────

  /**
   * Consume one token for the given tenant.
   * Returns false if the tenant is over the rate limit.
   */
  private consumeRateToken(tenantId: string): boolean {
    const limitRps = this.config.rateLimitRps ?? 10;
    const nowMs = Date.now();
    let bucket = this.rateBuckets.get(tenantId);

    if (!bucket) {
      bucket = { tokens: limitRps, lastRefillMs: nowMs };
      this.rateBuckets.set(tenantId, bucket);
    }

    // Token refill based on elapsed time
    const elapsedSec = (nowMs - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(limitRps, bucket.tokens + elapsedSec * limitRps);
    bucket.lastRefillMs = nowMs;

    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /**
   * Send a message to a user via OpenClaw (outbound channel adapter).
   *
   * Security:
   *  - isConfigured() guard prevents calls when key is absent.
   *  - Per-tenant rate limiting rejects if over OPENCLAW_RATE_LIMIT_RPS.
   *  - Error messages do NOT include the raw response body (no data leakage).
   *  - Audit log line written for every attempt (success or failure).
   *
   * SRP: this method only handles the transport; all AI logic is upstream.
   */
  async sendMessage(
    agentId: string,
    action: string,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
    tenantId?: string,
  ): Promise<AgentResponse> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'OpenClaw gateway not configured — OPENCLAW_API_KEY is not set',
      );
      return { success: false, error: 'OpenClaw gateway not configured' };
    }

    // Rate limit check (per-tenant when tenantId is provided)
    const rateKey = tenantId ?? 'global';
    if (!this.consumeRateToken(rateKey)) {
      this.logger.warn(
        `OpenClaw outbound rate limit exceeded for tenant=${rateKey}`,
      );
      return { success: false, error: 'Rate limit exceeded' };
    }

    const traceId = uuidv4();
    const message: AgentMessage = {
      id: uuidv4(),
      agentId,
      action,
      payload,
      metadata: {
        ...metadata,
        traceId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const span = this.tracingService.startSpan({
      name: `openclaw.${action}`,
      metadata: {
        agentId,
        traceId,
        messageId: message.id,
      },
    });

    const auditStart = Date.now();
    try {
      const response = await this.executeWithRetry(message, span?.id);

      this.tracingService.endSpan(span?.id, {
        success: true,
        metadata: { responseSize: JSON.stringify(response).length },
      });

      // AUDIT: structured log — never log apiKey or response body
      this.logger.log(
        `[AUDIT] openclaw.sendMessage action=${action} agentId=${agentId} ` +
          `tenantId=${tenantId ?? 'n/a'} traceId=${traceId} ` +
          `status=SUCCESS durationMs=${Date.now() - auditStart}`,
      );

      return { success: true, data: response, traceId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.tracingService.endSpan(span?.id, {
        success: false,
        error: errorMessage,
      });

      // AUDIT: log failure details server-side; never surface raw body to callers
      this.logger.error(
        `[AUDIT] openclaw.sendMessage action=${action} agentId=${agentId} ` +
          `tenantId=${tenantId ?? 'n/a'} traceId=${traceId} ` +
          `status=FAILED durationMs=${Date.now() - auditStart} error=${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
        traceId,
      };
    }
  }

  /**
   * Stream responses from an AI agent
   */
  async *streamMessage(
    agentId: string,
    action: string,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): AsyncGenerator<AgentResponse> {
    const traceId = uuidv4();
    const message: AgentMessage = {
      id: uuidv4(),
      agentId,
      action,
      payload,
      metadata: {
        ...metadata,
        traceId,
        stream: true,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const span = this.tracingService.startSpan({
      name: `openclaw.${action}.stream`,
      metadata: {
        agentId,
        traceId,
        messageId: message.id,
      },
    });

    try {
      const response = await fetch(
        `${this.config.endpoint}/agents/${agentId}/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
            'X-Trace-Id': traceId,
          },
          body: JSON.stringify(message),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenClaw API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { success: true, data: null, traceId };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield {
                success: true,
                data: parsed,
                traceId,
              };
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      this.tracingService.endSpan(span?.id, { success: true });
      yield { success: true, data: null, traceId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.tracingService.endSpan(span?.id, {
        success: false,
        error: errorMessage,
      });
      yield { success: false, error: errorMessage, traceId };
    }
  }

  /**
   * Execute request with automatic retry
   */
  private async executeWithRetry(
    message: AgentMessage,
    parentTraceId?: string,
  ): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'X-Trace-Id':
            parentTraceId ?? (message.metadata?.traceId as string) ?? '',
        };

        const response = await fetch(
          `${this.config.endpoint}/agents/${message.agentId}/messages`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(message),
            signal: AbortSignal.timeout(this.config.timeout),
          },
        );

        if (!response.ok) {
          // Read body for server-side logging only — NEVER include raw body in thrown errors
          const errorBody = await response.text().catch(() => '');
          this.logger.warn(
            `OpenClaw HTTP ${response.status} (attempt ${attempt + 1}): ${errorBody.slice(0, 200)}`,
          );
          throw new Error(`OpenClaw request failed (HTTP ${response.status})`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (error instanceof TypeError && error.message.includes('abort')) {
          throw lastError;
        }

        this.logger.warn(
          `OpenClaw request failed (attempt ${attempt + 1}/${this.config.retryAttempts}): ${lastError.message}`,
        );

        // Exponential backoff
        if (attempt < this.config.retryAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );
        }
      }
    }

    throw lastError ?? new Error('OpenClaw request failed after retries');
  }

  /**
   * Check if OpenClaw gateway is configured
   */
  isConfigured(): boolean {
    return this.config.apiKey.length > 0;
  }
}
