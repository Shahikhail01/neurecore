import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from '../events/events.gateway';
import type {
  IMemoryService,
  CreateMemoryInput,
  MemorySearchInput,
} from './interfaces/memory.interface';
import type { MemoryType } from '@prisma/client';

/**
 * MemoryService
 *
 * Responsibility (SRP): Persist, retrieve and search agent memory entries.
 * Embedding generation is delegated to an LLM provider;
 * vector similarity search uses pgvector on the secondary DB (future).
 * For now keyword-based search is used as a fallback.
 */
@Injectable()
export class MemoryService implements IMemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventsGateway,
  ) {}

  async store(input: CreateMemoryInput): Promise<unknown> {
    const embedding = await this.generateEmbedding(input.content);
    const vectorEnabled = this.isVectorSearchEnabled();

    const entry = await this.prisma.memoryEntry.create({
      data: {
        type: input.type,
        content: input.content,
        summary: input.summary,
        importance: input.importance ?? 0.5,
        expiresAt: input.expiresAt,
        metadata: (input.metadata ?? {}) as never,
        embedding: embedding ? JSON.stringify(embedding) : null,
        agentId: input.agentId,
        tenantId: input.tenantId,
      },
    });

    // Persist native pgvector column when feature flag is enabled
    if (vectorEnabled && embedding && entry.id) {
      const vecLiteral = `[${embedding.join(',')}]`;
      await this.prisma.$executeRaw`
        UPDATE memory_entries
        SET embedding_vector = ${vecLiteral}::vector
        WHERE id = ${entry.id}
      `;
    }

    // Emit real-time event if agent is linked
    if (input.agentId) {
      this.events.emitMemoryUpdated(input.tenantId, input.agentId, entry.id);
    }

    return entry;
  }

  async search(input: MemorySearchInput): Promise<unknown[]> {
    const { tenantId, agentId, query, type, limit = 10 } = input;
    const vectorEnabled = this.isVectorSearchEnabled();

    // When pgvector is enabled, use native cosine similarity via <=> operator
    if (vectorEnabled) {
      const queryEmbedding = await this.generateEmbedding(query);
      if (queryEmbedding) {
        const vecLiteral = `[${queryEmbedding.join(',')}]`;
        type VectorRow = {
          id: string;
          content: string;
          summary: string | null;
          importance: number;
        };
        const rows = await this.prisma.$queryRaw<VectorRow[]>`
          SELECT id, content, summary, importance
          FROM memory_entries
          WHERE tenant_id = ${tenantId}
            ${agentId ? this.prisma.$queryRaw`AND agent_id = ${agentId}` : this.prisma.$queryRaw``}
            ${type ? this.prisma.$queryRaw`AND type = ${type}` : this.prisma.$queryRaw``}
            AND embedding_vector IS NOT NULL
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY embedding_vector <=> ${vecLiteral}::vector
          LIMIT ${limit}
        `;
        return rows;
      }
    }

    // Try in-memory cosine similarity using the JSON embedding column
    const queryEmbedding = await this.generateEmbedding(query);

    // Fetch candidate entries (broader for re-ranking)
    const candidates = await this.prisma.memoryEntry.findMany({
      where: {
        tenantId,
        ...(agentId && { agentId }),
        ...(type && { type }),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: queryEmbedding ? limit * 5 : limit, // fetch more for re-ranking
    });

    if (!queryEmbedding || candidates.length === 0) {
      // Keyword fallback
      return this.prisma.memoryEntry.findMany({
        where: {
          tenantId,
          ...(agentId && { agentId }),
          ...(type && { type }),
          content: { contains: query, mode: 'insensitive' },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });
    }

    // Re-rank by cosine similarity
    const scored = candidates
      .filter((e) => e.embedding !== null)
      .map((entry) => {
        try {
          const vec = JSON.parse(entry.embedding as string) as number[];
          const sim = this.cosineSimilarity(queryEmbedding, vec);
          return { entry, score: sim };
        } catch {
          return { entry, score: 0 };
        }
      });

    // Blend similarity with importance score
    scored.sort(
      (a, b) =>
        b.score * 0.7 +
        (b.entry.importance ?? 0) * 0.3 -
        (a.score * 0.7 + (a.entry.importance ?? 0) * 0.3),
    );

    return scored.slice(0, limit).map((s) => s.entry);
  }

  async findByAgent(
    agentId: string,
    tenantId: string,
    limit = 20,
  ): Promise<unknown[]> {
    return this.prisma.memoryEntry.findMany({
      where: {
        agentId,
        tenantId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async purgeExpired(tenantId?: string): Promise<number> {
    const result = await this.prisma.memoryEntry.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        ...(tenantId && { tenantId }),
      },
    });
    this.logger.log(
      `Purged ${result.count} expired memory entries${tenantId ? ` for tenant ${tenantId}` : ''}`,
    );
    return result.count;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const entry = await this.prisma.memoryEntry.findFirst({
      where: { id, tenantId },
    });
    if (!entry)
      throw new (await import('@nestjs/common')).NotFoundException(
        `Memory entry ${id} not found`,
      );
    await this.prisma.memoryEntry.delete({ where: { id } });
  }

  // ───────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────

  /**
   * Feature flag: set ENABLE_VECTOR_SEARCH=true to use pgvector native
   * cosine similarity instead of in-memory cosine similarity over JSON
   * embeddings. Requires the migration.sql to have been applied on the DB.
   */
  private isVectorSearchEnabled(): boolean {
    return this.config.get<string>('ENABLE_VECTOR_SEARCH') === 'true';
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    try {
      const { OpenAIEmbeddings } = await import('@langchain/openai');
      const embeddings = new OpenAIEmbeddings({
        apiKey,
        model: 'text-embedding-3-small',
      });
      const vector = await embeddings.embedQuery(text);
      this.logger.debug(
        `Generated embedding dim=${vector.length} for: ${text.slice(0, 40)}…`,
      );
      return vector;
    } catch (err) {
      this.logger.warn(`Embedding generation failed: ${String(err)}`);
      return null;
    }
  }

  /**
   * Cosine similarity between two vectors.
   * Used for in-memory ranking when pgvector is unavailable.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
  }
}
