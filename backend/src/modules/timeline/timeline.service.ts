// src/modules/timeline/timeline.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface TimelineEventInput {
  tenantId: string;
  projectId?: string;
  simulationId?: string;
  occurredAt: Date;
  category: 'OPERATIONAL' | 'SUPPLY_CHAIN' | 'SECURITY' | 'COMPLIANCE' | 'FINANCIAL' | 'STAKEHOLDER' | 'HR' | 'WEATHER' | 'EXTERNAL' | 'AI_ACTION' | 'SIMULATION' | 'CUSTOM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceType: 'HUMAN' | 'AI' | 'INTEGRATION' | 'SERVICE_IDENTITY' | 'SIMULATION_CONTROLLER';
  sourceId?: string;
  title: string;
  description: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  correlationId?: string;
  causationId?: string;
  parentEventId?: string;
  rootEventId?: string;
  createdByUserId?: string;
  createdByAgentId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async findSince(
    since: Date,
    relatedEntityType: string,
    relatedEntityId: string,
    tenantId: string,
  ): Promise<any[]> {
    return this.prisma.timelineEvent.findMany({
      where: {
        tenantId,
        relatedEntityType,
        relatedEntityId,
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async findByProject(
    projectId: string,
    tenantId: string,
    limit = 100,
  ): Promise<any[]> {
    return this.prisma.timelineEvent.findMany({
      where: { tenantId, projectId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }

  async record(event: TimelineEventInput): Promise<string> {
    const created = await this.prisma.timelineEvent.create({
      data: {
        tenantId: event.tenantId,
        projectId: event.projectId,
        simulationId: event.simulationId,
        occurredAt: event.occurredAt,
        category: event.category,
        severity: event.severity,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        title: event.title,
        description: event.description,
        relatedEntityType: event.relatedEntityType,
        relatedEntityId: event.relatedEntityId,
        correlationId: event.correlationId,
        causationId: event.causationId,
        parentEventId: event.parentEventId,
        rootEventId: event.rootEventId,
        createdByUserId: event.createdByUserId,
        createdByAgentId: event.createdByAgentId,
        metadata: (event.metadata ?? {}) as any,
      },
    });
    return created.id;
  }
}
