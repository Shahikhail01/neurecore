/**
 * ChatSseService — Server-Sent Events driver for `POST /chat/stream`.
 *
 * Wire format (one event per line, two-line blocks):
 *
 *   event: delta
 *   data: {"text":"Hello! "}
 *
 *   event: delta
 *   data: {"text":"I'm Hermes. "}
 *
 *   event: done
 *   data: {"conversationId":"conv_xxx","tokens":{"input":10,"output":50,"total":60}}
 *
 * Heuristic heartbeat: 20 s between events keeps proxies from closing the
 * connection. Connection is terminated on client disconnect (close listener)
 * or after `done`.
 *
 * Phase 3.4 (2026-07-20): never emit a `delta` event with empty `text`
 * — the front-end renders an empty bubble for it. Empty deltas arrive
 * when the gateway flushed only a think-block, when the user sent an
 * action through stream(), or when the chat service is mid-cleanup.
 *
 * Phase 3.9 (2026-07-20): classify errors so the client doesn't leak
 * provider details or 503 pages. Maps known errors to stable, public-
 * safe messages keyed by `code`.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import type { SendChatMessageDto } from './dto/chat.dto';
import { AiGatewayError } from '../ai-gateway/domain/errors';

const HEARTBEAT_MS = 20_000;

@Injectable()
export class ChatSseService {
  private readonly logger = new Logger(ChatSseService.name);

  constructor(private readonly chat: ChatService) {}

  async stream(
    dto: SendChatMessageDto,
    tenantIdFromJwt: string | undefined,
    userIdFromJwt: string | undefined,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
    const conversationId = dto.conversationId ?? `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const heartbeat = setInterval(() => {
      if (closed) return;
      res.write(': heartbeat\n\n');
    }, HEARTBEAT_MS);

    const onClose = () => {
      closed = true;
      clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        /* ignore */
      }
    };
    res.on('close', onClose);

    const writeEvent = (event: string, data: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const start = Date.now();
    try {
      for await (const chunk of this.chat.stream(dto, tenantIdFromJwt, userIdFromJwt)) {
        if (closed) break;
        // Phase 3.4: skip empty deltas — the FE renders them as
        // empty bubbles that confuse users. The terminal `done` chunk
        // always carries `delta: ''` and is handled below.
        if (chunk.done) {
          writeEvent('done', {
            conversationId,
            tokens: { input: 0, output: 0, total: 0 },
            durationMs: Date.now() - start,
          });
          continue;
        }
        if (chunk.delta.length === 0) continue;
        // Phase 9: forward the response envelope as a sibling of `text`
        // in the SSE delta payload. Strictly additive — old clients
        // that only read `text` ignore the new field; new clients
        // (EnvelopeRenderer) consume it. Absent envelope ⇒ legacy
        // rendering path (no envelope → FE renderer falls back).
        // Phase 2: also forward the deterministic routing decision
        // (`route`) so observability / debugging clients can show which
        // rule fired. Missing `route` ⇒ legacy clients are unaffected.
        writeEvent('delta', {
          text: chunk.delta,
          ...(chunk.envelope ? { envelope: chunk.envelope } : {}),
          ...((chunk as { route?: unknown }).route
            ? { route: (chunk as { route?: unknown }).route }
            : {}),
        });
      }
    } catch (err) {
      // Phase 3.9: classify the error and emit a stable, public-safe
      // message. We log the FULL error server-side for debugging but
      // only the code + a generic hint over the wire.
      const classified = classifyChatError(err);
      this.logger.error(
        `chat SSE failed: code=${classified.code} message=${classified.publicMessage} cause=${(err as Error).message}`,
      );
      writeEvent('error', {
        code: classified.code,
        message: classified.publicMessage,
      });
    } finally {
      clearInterval(heartbeat);
      onClose();
    }
  }
}

interface ClassifiedError {
  code: string;
  publicMessage: string;
}

function classifyChatError(err: unknown): ClassifiedError {
  if (err instanceof AiGatewayError) {
    if (err.code === 'AI_GATEWAY_UNCONFIGURED') {
      return {
        code: 'CHAT_UNCONFIGURED',
        publicMessage:
          'The AI assistant is not configured for this tenant yet. ' +
          'Please contact your administrator.',
      };
    }
    if (err.code === 'AI_GATEWAY_TIMEOUT') {
      return {
        code: 'CHAT_TIMEOUT',
        publicMessage: 'The AI assistant took too long. Please try again.',
      };
    }
    if (err.code === 'AI_GATEWAY_RATE_LIMIT') {
      return {
        code: 'CHAT_RATE_LIMIT',
        publicMessage: 'Rate limit reached. Please try again in a moment.',
      };
    }
    if (err.code === 'AI_GATEWAY_AUTH') {
      return {
        code: 'CHAT_AUTH',
        publicMessage: 'The AI provider rejected the request. Please contact your administrator.',
      };
    }
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return { code: 'CHAT_TIMEOUT', publicMessage: 'The AI assistant took too long. Please try again.' };
  }
  if (msg.includes('csrf') || msg.includes('forbidden')) {
    return { code: 'CHAT_FORBIDDEN', publicMessage: 'Session expired. Please refresh and try again.' };
  }
  if (msg.includes('conversation_forbidden')) {
    return { code: 'CHAT_CONVERSATION_FORBIDDEN', publicMessage: 'Cannot write to that conversation.' };
  }
  return {
    code: 'CHAT_INTERNAL',
    publicMessage: 'Something went wrong. Our team has been notified.',
  };
}
