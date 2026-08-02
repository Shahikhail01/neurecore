/**
 * HTTP LLM Transport
 *
 * The ONLY `fetch()` implementation in the entire codebase. Reused by
 * the gateway for every model/provider combination, including
 * streaming. All error normalisation happens here so the rest of the
 * gateway can branch on error classes only.
 *
 * SOLID: SRP — this class is responsible for HTTP I/O against an
 * OpenAI-compatible endpoint. Nothing else.
 * SOLID: LSP — exposes a uniform `invoke() / stream()` contract that
 * Anthropic, OpenAI, MiniMax, DeepSeek, MiMo all satisfy because they
 * share the OpenAI chat-completions shape.
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { Capability } from '../domain/capabilities';
import {
  AiGatewayAuthError,
  AiGatewayContextLengthError,
  AiGatewayError,
  AiGatewayProviderError,
  AiGatewayRateLimitError,
  AiGatewayTimeoutError,
  AiGatewayUnconfiguredError,
} from '../domain/errors';
import type { ChatMessage, LLMStreamChunk, LLMUsage } from '../domain/types';
import { SseStreamParser } from './sse-stream-parser';

const usAGE_SCHEMA = z
  .object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  })
  .partial();

const CHOICE_SCHEMA = z.object({
  index: z.number().int().optional(),
  message: z
    .object({
      role: z.string().optional(),
      content: z.string().nullable().optional(),
      tool_calls: z
        .array(
          z.object({
            id: z.string(),
            type: z.literal('function'),
            function: z.object({
              name: z.string(),
              arguments: z.string(),
            }),
          }),
        )
        .optional(),
    })
    .optional(),
  // OpenAI streams include `finish_reason: null` for every non-final
  // chunk and `finish_reason: "stop"` (or similar) on the last one.
  // Make it nullable so streaming chunks parse instead of failing.
  finish_reason: z.string().nullable().optional(),
  delta: z
    .object({
      role: z.string().optional(),
      content: z.string().nullable().optional(),
      tool_calls: z
        .array(
          z.object({
            index: z.number().int().optional(),
            id: z.string().optional(),
            type: z.string().optional(),
            function: z
              .object({
                name: z.string().optional(),
                arguments: z.string().optional(),
              })
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const CHAT_COMPLETIONS_SCHEMA = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(CHOICE_SCHEMA),
  usage: usAGE_SCHEMA.optional(),
});

export interface InvokeHttpRequest {
  url: string;
  apiKey: string;
  model: string;
  capability: Capability;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  sourceModule?: string;
  tools?: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: unknown };
  }>;
  responseFormatJson?: boolean;
  timeoutMs: number;
}

@Injectable()
export class HttpLlmTransport {
  private readonly logger = new Logger(HttpLlmTransport.name);
  private readonly sseParser = new SseStreamParser();

  async invoke(req: InvokeHttpRequest): Promise<{
    content: string;
    toolCalls: Array<{ id: string; name: string; arguments: unknown }>;
    usage: LLMUsage;
    finishReason: string;
    rawModel: string;
  }> {
    if (!req.apiKey) {
      throw new AiGatewayUnconfiguredError('(api key missing at runtime)');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs);
    const signal = mergeSignals(controller.signal, req.signal);
    const body = buildRequestBody(req);
    let response: Response;
    try {
      response = await fetch(req.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw normaliseFetchError(err, req.timeoutMs);
    }
    clearTimeout(timeout);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw normaliseHttpError(response.status, text, response.headers);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (err) {
      throw new AiGatewayProviderError(
        `Invalid JSON from provider (${req.model})`,
        err,
      );
    }
    const parsed = CHAT_COMPLETIONS_SCHEMA.safeParse(payload);
    if (!parsed.success) {
      throw new AiGatewayProviderError(
        `Provider response shape mismatch (${req.model})`,
        parsed.error,
      );
    }
    const data = parsed.data;
    const choice = data.choices[0];
    const usage: LLMUsage = {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      totalTokens:
        data.usage?.total_tokens ??
        (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
    };
    const toolCalls = (choice?.message?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeJsonParse(tc.function.arguments),
    }));
    return {
      content: choice?.message?.content ?? '',
      toolCalls,
      usage,
      finishReason: choice?.finish_reason ?? 'stop',
      rawModel: data.model ?? req.model,
    };
  }

  async *stream(req: InvokeHttpRequest): AsyncGenerator<LLMStreamChunk> {
    if (!req.apiKey) {
      throw new AiGatewayUnconfiguredError('(api key missing at runtime)');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs);
    const signal = mergeSignals(controller.signal, req.signal);
    const body = buildRequestBody({ ...req, stream: true });
    let response: Response;
    try {
      response = await fetch(req.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.apiKey}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw normaliseFetchError(err, req.timeoutMs);
    }
    clearTimeout(timeout);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw normaliseHttpError(response.status, text, response.headers);
    }
    if (!response.body) {
      throw new AiGatewayProviderError('Provider returned empty stream body');
    }
    let finalUsage: LLMUsage | undefined;
    let finalModel = req.model;
    const providerSlug = extractProviderSlug(req.url);
    try {
      for await (const ev of this.sseParser.parse(response.body)) {
        if (ev.done) {
          yield {
            delta: '',
            done: true,
            ...(finalUsage ? { usage: finalUsage } : {}),
            model: finalModel,
            provider: providerSlug,
          };
          return;
        }
        const obj = ev.data as Record<string, unknown> | null;
        if (!obj) continue;
        const m = obj['model'];
        if (typeof m === 'string') finalModel = m;
        const u = obj['usage'];
        if (u && typeof u === 'object') {
          const parsed = usAGE_SCHEMA.safeParse(u);
          if (parsed.success) {
            finalUsage = {
              inputTokens: parsed.data.prompt_tokens ?? 0,
              outputTokens: parsed.data.completion_tokens ?? 0,
              totalTokens:
                parsed.data.total_tokens ??
                (parsed.data.prompt_tokens ?? 0) +
                  (parsed.data.completion_tokens ?? 0),
            };
          }
        }
        const choices = obj['choices'];
        if (!Array.isArray(choices)) continue;
        for (const c of choices) {
          const parsedChoice = CHOICE_SCHEMA.safeParse(c);
          if (!parsedChoice.success) continue;
          const delta = parsedChoice.data.delta;
          if (delta?.content) {
            yield {
              delta: delta.content,
              done: false,
              model: finalModel,
              provider: providerSlug,
            };
          }
        }
      }
      yield {
        delta: '',
        done: true,
        ...(finalUsage ? { usage: finalUsage } : {}),
        model: finalModel,
        provider: providerSlug,
      };
    } finally {
      // No-op: SseStreamParser already releases the reader.
    }
  }
}

function buildRequestBody(
  req: InvokeHttpRequest & { stream?: boolean },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature,
    max_tokens: req.maxTokens,
  };
  if (req.stream) body['stream'] = true;
  if (req.tools && req.tools.length > 0) {
    body['tools'] = req.tools;
    // When the planner specifically requests a tool be invoked, force-call it.
    // Without this, smaller LLMs reply in prose ("I cannot do that") instead of
    // producing a tool_call, which the user perceives as "tool broken". Legacy
    // /chat/messages prose path is unaffected (no `tools` is sent on that path).
    //
    // PHASE-9 GATEWAY FIX (2026-08-01): DeepSeek's API rejects
    // `tool_choice=required` for chat models in thinking mode with HTTP 400
    // "Thinking mode does not support this tool_choice". We fall back to
    // `auto` for DeepSeek providers; the planner's system prompt still
    // strongly directs tool use. OpenAI/MiniMax providers keep `required`
    // because they support it.
    const providerSlug = extractProviderSlug(req.url);
    const isPlanner = req.sourceModule === 'agent-graph.planner';
    if (providerSlug === 'deepseek') {
      body['tool_choice'] = 'auto';
    } else {
      body['tool_choice'] = isPlanner ? 'required' : 'auto';
    }
  }
  if (req.responseFormatJson) {
    body['response_format'] = { type: 'json_object' };
  }
  return body;
}

function normaliseFetchError(err: unknown, timeoutMs: number): AiGatewayError {
  if (err instanceof AiGatewayError) return err;
  if (err instanceof Error && /aborted|abort/i.test(err.message)) {
    return new AiGatewayTimeoutError(
      `Request aborted after ${timeoutMs}ms`,
      err,
    );
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    return new AiGatewayTimeoutError(
      `Request timed out after ${timeoutMs}ms`,
      err,
    );
  }
  return new AiGatewayProviderError(
    `Network error: ${err instanceof Error ? err.message : String(err)}`,
    err,
  );
}

function normaliseHttpError(
  status: number,
  text: string,
  headers: Headers,
): AiGatewayError {
  if (status === 401 || status === 403) {
    return new AiGatewayAuthError(`Provider auth failed: ${status} ${text}`);
  }
  if (status === 429) {
    const retryAfterHeader = headers.get('retry-after');
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : undefined;
    return new AiGatewayRateLimitError(
      `Provider rate limited: ${status} ${text}`,
      Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    );
  }
  if (status === 400 && /context.?length|max.?tokens|too.?long/i.test(text)) {
    return new AiGatewayContextLengthError(
      `Context length exceeded: ${text.slice(0, 200)}`,
    );
  }
  return new AiGatewayProviderError(
    `Provider error ${status}: ${text.slice(0, 500)}`,
  );
}

function mergeSignals(
  primary: AbortSignal,
  secondary?: AbortSignal,
): AbortSignal {
  if (!secondary) return primary;
  const combined = new AbortController();
  const onAbort = (): void => {
    combined.abort();
  };
  primary.addEventListener('abort', onAbort, { once: true });
  secondary.addEventListener('abort', onAbort, { once: true });
  return combined.signal;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Extract a human-readable provider slug from a URL.
 * e.g. "https://api.minimaxi.com/v1/chat/completions" → "minimaxi"
 */
function extractProviderSlug(url: string): string {
  try {
    const host = new URL(url).hostname;
    // Take the first subdomain segment before the TLD
    const parts = host.split('.');
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch {
    return url;
  }
}
