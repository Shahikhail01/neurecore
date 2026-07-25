// ─── ChatHistoryService ────────────────────────────────────────────────────────
// SRP: Persists chat messages to PostgreSQL; exposes get/clear history APIs.
// DIP: Depends on PrismaService (DB abstraction).
//
// Independent of Hermes (which is agent-execution-scoped). Chat history is a
// user/tenant concern, not an agent concern.
//
// Phase 3.5 (2026-07-20): validate conversationId ownership on
// persistence. A different tenant trying to write to a session it
// doesn't own would be silently accepted by the previous upsert
// (collision on `conversationId` would simply re-use the first
// tenant's row). Now we read the existing session (if any) and
// reject the write when tenantId/userId don't match the caller.

import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

export interface ChatHistoryEntry {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown> | null;
  tokens?: { input: number; output: number; total: number } | null;
  model?: string | null;
  provider?: string | null;
  createdAt: string;
}

export interface GetHistoryParams {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  limit?: number;
}

export interface ClearHistoryParams {
  tenantId: string;
  userId?: string;
  conversationId?: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  /**
   * Persist a single chat message. Auto-creates the session row if needed.
   * Failures are logged but never thrown — chat flow must not break on
   * persistence errors (persistence is observability, not a critical path).
   *
   * @throws ForbiddenException when an existing session belongs to a
   *   different tenant or user. Phase 3.5 — previously silently cross-
   *   polluted history.
   */
  async saveMessage(params: {
    tenantId: string;
    userId: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
    tokens?: { input: number; output: number; total: number };
    model?: string;
    provider?: string;
  }): Promise<ChatHistoryEntry | null> {
    try {
      // Phase 3.5: if a session with this conversationId already
      // exists, verify it belongs to the SAME (tenantId, userId) as
      // the caller. Otherwise an attacker who guesses / fabricates a
      // conversationId would inject messages into another tenant's
      // history.
      const existing = await this.prisma.chatSession.findUnique({
        where: { conversationId: params.conversationId },
        select: { id: true, tenantId: true, userId: true },
      });
      if (
        existing &&
        (existing.tenantId !== params.tenantId ||
          existing.userId !== params.userId)
      ) {
        throw new ForbiddenException({
          code: 'CHAT_CONVERSATION_FORBIDDEN',
          message: 'Conversation is owned by a different tenant or user.',
        });
      }

      const session = await this.prisma.chatSession.upsert({
        where: { conversationId: params.conversationId },
        update: { lastMessageAt: new Date() },
        create: {
          conversationId: params.conversationId,
          tenantId: params.tenantId,
          userId: params.userId,
          lastMessageAt: new Date(),
        },
      });

      const msg = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          conversationId: params.conversationId,
          tenantId: params.tenantId,
          userId: params.userId,
          role: params.role,
          content: params.content,
          ...(params.metadata ? { metadata: params.metadata as object } : {}),
          ...(params.tokens
            ? { tokens: params.tokens as unknown as object }
            : {}),
          ...(params.model ? { model: params.model } : {}),
          ...(params.provider ? { provider: params.provider } : {}),
        },
      });

      // Record metric on success only (already-persisted messages)
      this.metrics?.chatMessagesTotal.inc({ role: params.role, endpoint: 'messages' });
      return this.toEntry(msg);
    } catch (err) {
      // Phase 3.7: distinguish persistence failure (e.g. DB down) from
      // ownership violation. The latter MUST propagate as 403 so the
      // client knows to stop reusing that conversationId.
      if (err instanceof ForbiddenException) {
        throw err;
      }
      this.logger.warn(
        `[chat-history] saveMessage failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async getHistory(params: GetHistoryParams): Promise<{
    data: ChatHistoryEntry[];
    total: number;
  }> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where = {
      tenantId: params.tenantId,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.conversationId
        ? { conversationId: params.conversationId }
        : {}),
    };

    try {
      const [rows, total] = await Promise.all([
        this.prisma.chatMessage.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          take: limit,
        }),
        this.prisma.chatMessage.count({ where }),
      ]);

      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'get', result: 'ok' });
      return { data: rows.map((r) => this.toEntry(r)), total };
    } catch (err) {
      this.logger.warn(
        `[chat-history] getHistory failed: ${(err as Error).message}`,
      );
      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'get', result: 'error' });
      return { data: [], total: 0 };
    }
  }

  /**
   * FIX-DEP-D6 (Round-3 verification, 2026-07-24): list the current
   * tenant+user's chat conversations (sessions) so the FE chat panel can
   * render a sidebar of previous threads. Returns a lightweight summary
   * — id, conversationId, title, lastMessageAt, messageCount — sorted by
   * lastMessageAt desc. Always tenant-scoped.
   */
  async listConversations(params: {
    tenantId: string;
    userId?: string;
    limit?: number;
  }): Promise<{
    data: Array<{
      id: string;
      conversationId: string;
      title: string | null;
      lastMessageAt: string;
      messageCount: number;
    }>;
    total: number;
  }> {
    const limit = Math.min(params.limit ?? 50, 200);
    const where = {
      tenantId: params.tenantId,
      ...(params.userId ? { userId: params.userId } : {}),
    };
    try {
      const [sessions, total] = await Promise.all([
        this.prisma.chatSession.findMany({
          where,
          orderBy: { lastMessageAt: 'desc' },
          take: limit,
        }),
        this.prisma.chatSession.count({ where }),
      ]);
      const ids = sessions.map((s) => s.id);
      const counts = await this.prisma.chatMessage.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: ids } },
        _count: { _all: true },
      });
      const countBySession = new Map(
        counts.map((c) => [c.sessionId, c._count._all]),
      );
      return {
        data: sessions.map((s) => ({
          id: s.id,
          conversationId: s.conversationId,
          title: s.title,
          lastMessageAt: s.lastMessageAt.toISOString(),
          messageCount: countBySession.get(s.id) ?? 0,
        })),
        total,
      };
    } catch (err) {
      this.logger.warn(
        `[chat-history] listConversations failed: ${(err as Error).message}`,
      );
      return { data: [], total: 0 };
    }
  }

  async clearHistory(params: ClearHistoryParams): Promise<{ deleted: number }> {
    const where = {
      tenantId: params.tenantId,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.conversationId
        ? { conversationId: params.conversationId }
        : {}),
    };

    try {
      const result = await this.prisma.chatMessage.deleteMany({ where });
      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'delete', result: 'ok' });
      return { deleted: result.count };
    } catch (err) {
      this.logger.warn(
        `[chat-history] clearHistory failed: ${(err as Error).message}`,
      );
      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'delete', result: 'error' });
      return { deleted: 0 };
    }
  }

  private toEntry(msg: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    metadata: unknown;
    tokens: unknown;
    model: string | null;
    provider: string | null;
    createdAt: Date;
  }): ChatHistoryEntry {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      role: msg.role as ChatHistoryEntry['role'],
      content: msg.content,
      metadata: (msg.metadata as Record<string, unknown> | null) ?? null,
      tokens: (msg.tokens as ChatHistoryEntry['tokens'] | null) ?? null,
      model: msg.model,
      provider: msg.provider,
      createdAt: msg.createdAt.toISOString(),
    };
  }
}
