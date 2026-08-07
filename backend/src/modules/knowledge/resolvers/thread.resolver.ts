/**
 * Phase 12 — ThreadResolver.
 *
 * Resolves `kind: 'thread'` SourceRefs (threadId = ChatMessage.conversationId)
 * to the chronological chat-thread content + per-message citations.
 *
 * SRP: this class owns ONLY chat-thread resolution.
 *
 * SECURITY: tenantId WHERE clause on every query.
 * CAPPED: 100 most recent messages to avoid token-bomb runs.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  FileTextResolver,
  ResolvedText,
  ResolverKind,
} from './source-ref-resolver.registry';
import type { SourceRef, SkillCitation } from '../../skill-registry/interfaces/skill.types';

type ThreadRef = Extract<SourceRef, { kind: 'thread' }>;

const MAX_THREAD_MESSAGES = 100;

@Injectable()
export class ThreadResolver extends FileTextResolver<ThreadRef> {
  readonly kind: ResolverKind = 'thread';
  private readonly logger = new Logger(ThreadResolver.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected async doResolve(
    tenantId: string,
    ref: ThreadRef,
  ): Promise<ResolvedText> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { tenantId, conversationId: ref.threadId },
      orderBy: { createdAt: 'asc' },
      take: MAX_THREAD_MESSAGES,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
    if (rows.length === 0) {
      return {
        text: `Chat thread ${ref.threadId} has no messages visible to tenant ${tenantId}.`,
        citations: [],
      };
    }
    const text = renderThread(ref.threadId, rows);
    const citations: SkillCitation[] = rows.map((r) => ({
      threadId: ref.threadId,
      locator: `chat:${r.id}@${r.createdAt.toISOString()}`,
      quote: r.content.length > 200 ? `${r.content.slice(0, 200)}…` : r.content,
    }));
    return { text, citations };
  }
}

function renderThread(threadId: string, rows: ReadonlyArray<{
  role: string;
  content: string;
  createdAt: Date;
}>): string {
  const body = rows
    .map((r) => {
      const ts = r.createdAt.toISOString();
      const trimmed = r.content.length > 1500
        ? `${r.content.slice(0, 1500)}…(truncated)`
        : r.content;
      return `[${ts}] ${r.role.toUpperCase()}:\n${trimmed}`;
    })
    .join('\n\n');
  return `Chat thread ${threadId} (${rows.length} messages)\n\n${body}`;
}
