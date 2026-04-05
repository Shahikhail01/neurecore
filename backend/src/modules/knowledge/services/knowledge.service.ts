import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { KnowledgeSourceType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  AddDocumentDto,
  CreateKnowledgeSpaceDto,
} from '../dto/knowledge.dto';

/**
 * KnowledgeService
 * SRP: manages knowledge spaces and document ingestion only.
 * OCP: document chunking / embedding pipeline can be added by extension.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Spaces ──────────────────────────────────────────────────────────────

  async createSpace(tenantId: string, dto: CreateKnowledgeSpaceDto) {
    return this.prisma.knowledgeSpace.create({
      data: {
        name: dto.name,
        description: dto.description,
        tenantId,
        departmentId: dto.departmentId,
      },
    });
  }

  async listSpaces(tenantId: string) {
    return this.prisma.knowledgeSpace.findMany({
      where: { tenantId },
      include: { _count: { select: { documents: true, agents: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSpace(id: string, tenantId: string) {
    const space = await this.prisma.knowledgeSpace.findFirst({
      where: { id, tenantId },
      include: { documents: true },
    });
    if (!space) throw new NotFoundException(`KnowledgeSpace ${id} not found`);
    return space;
  }

  async deleteSpace(id: string, tenantId: string): Promise<void> {
    await this.assertSpaceOwnership(id, tenantId);
    await this.prisma.knowledgeSpace.delete({ where: { id } });
    this.logger.log(`KnowledgeSpace ${id} deleted from tenant ${tenantId}`);
  }

  // ─── Documents ───────────────────────────────────────────────────────────

  async addDocument(spaceId: string, tenantId: string, dto: AddDocumentDto) {
    await this.assertSpaceOwnership(spaceId, tenantId);
    return this.prisma.knowledgeDocument.create({
      data: {
        spaceId,
        title: dto.title,
        content: dto.content,
        sourceType: dto.sourceType ?? KnowledgeSourceType.MANUAL,
        sourceUrl: dto.sourceUrl,
      },
    });
  }

  /**
   * Full-text search across documents in all spaces the tenant owns.
   * Uses Postgres ILIKE — replace with pgvector ANN when embedding is enabled.
   */
  async searchDocuments(tenantId: string, query: string, limit = 10) {
    const spaces = await this.prisma.knowledgeSpace.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const spaceIds = spaces.map((s) => s.id);
    if (!spaceIds.length) return [];

    return this.prisma.knowledgeDocument.findMany({
      where: {
        spaceId: { in: spaceIds },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Agent access ─────────────────────────────────────────────────────────

  async grantAgentAccess(spaceId: string, tenantId: string, agentId: string) {
    await this.assertSpaceOwnership(spaceId, tenantId);
    try {
      return await this.prisma.agentKnowledgeAccess.create({
        data: { agentId, spaceId },
      });
    } catch {
      throw new ConflictException(
        `Agent ${agentId} already has access to space ${spaceId}`,
      );
    }
  }

  async revokeAgentAccess(
    spaceId: string,
    tenantId: string,
    agentId: string,
  ): Promise<void> {
    await this.assertSpaceOwnership(spaceId, tenantId);
    await this.prisma.agentKnowledgeAccess.deleteMany({
      where: { agentId, spaceId },
    });
  }

  async listAgentsWithAccess(spaceId: string, tenantId: string) {
    await this.assertSpaceOwnership(spaceId, tenantId);
    return this.prisma.agentKnowledgeAccess.findMany({
      where: { spaceId },
      include: {
        agent: { select: { id: true, name: true, type: true, status: true } },
      },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertSpaceOwnership(
    id: string,
    tenantId: string,
  ): Promise<void> {
    const space = await this.prisma.knowledgeSpace.findFirst({
      where: { id, tenantId },
    });
    if (!space) throw new NotFoundException(`KnowledgeSpace ${id} not found`);
  }
}
