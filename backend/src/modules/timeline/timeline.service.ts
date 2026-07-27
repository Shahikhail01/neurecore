// src/modules/timeline/timeline.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  ActorType,
  TimelineEvent,
  isSupportedEntityType,
} from './timeline.types';

type TimelineRow = Prisma.TimelineEventGetPayload<Record<string, never>>;

export interface TimelineEventInput {
  tenantId: string;
  projectId?: string;
  simulationId?: string;
  occurredAt: Date;
  category:
    | 'OPERATIONAL'
    | 'SUPPLY_CHAIN'
    | 'SECURITY'
    | 'COMPLIANCE'
    | 'FINANCIAL'
    | 'STAKEHOLDER'
    | 'HR'
    | 'WEATHER'
    | 'EXTERNAL'
    | 'AI_ACTION'
    | 'SIMULATION'
    | 'CUSTOM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sourceType:
    | 'HUMAN'
    | 'AI'
    | 'INTEGRATION'
    | 'SERVICE_IDENTITY'
    | 'SIMULATION_CONTROLLER';
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
    if (!isSupportedEntityType(relatedEntityType)) {
      // Defensive: ignore unknown entity types so the gateway cannot be
      // used to dump unrelated rows via the `relatedEntityType` index.
      return [];
    }
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
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return created.id;
  }

  /**
   * Phase 7 (§9.2) — Public read of the unified timeline.
   *
   * Returns events mapped to the canonical TimelineEvent shape, including
   * the title-and-description shorthand used by the unified timeline UI.
   * Designed for the polling fallback when Socket.IO is unavailable.
   */
  async findEntityTimeline(
    entityType: string,
    entityId: string,
    tenantId: string,
    since?: Date,
    limit = 200,
  ): Promise<TimelineEvent[]> {
    if (!isSupportedEntityType(entityType)) {
      return [];
    }

    const owner = await this.verifyEntityOwnership(
      entityType,
      entityId,
      tenantId,
    );
    if (!owner) return [];

    const rows = await this.prisma.timelineEvent.findMany({
      where: {
        tenantId,
        relatedEntityType: entityType,
        relatedEntityId: entityId,
        ...(since ? { occurredAt: { gte: since } } : {}),
      },
      orderBy: { occurredAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });

    return rows.map((row) => this.toPublicEvent(row));
  }

  /**
   * Phase 7 — read recent events for a parent project (used by the
   * project-wide timeline tab + the workspace timeline page).
   */
  async findProjectTimeline(
    projectId: string,
    tenantId: string,
    since?: Date,
    limit = 200,
  ): Promise<TimelineEvent[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!project) return [];

    const rows = await this.prisma.timelineEvent.findMany({
      where: {
        tenantId,
        projectId,
        ...(since ? { occurredAt: { gte: since } } : {}),
      },
      orderBy: { occurredAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });

    return rows.map((row) => this.toPublicEvent(row));
  }

  private async verifyEntityOwnership(
    entityType: string,
    entityId: string,
    tenantId: string,
  ): Promise<boolean> {
    switch (entityType) {
      case 'Initiation':
        return Boolean(
          await this.prisma.enterpriseInitiation.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Project':
        return Boolean(
          await this.prisma.project.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Goal':
        return Boolean(
          await this.prisma.goal.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Task':
        return Boolean(
          await this.prisma.task.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'ExecutionAttempt':
        return Boolean(
          await this.prisma.executionAttempt.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      case 'Review':
        return Boolean(
          await this.prisma.review.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          }),
        );
      default:
        return false;
    }
  }

  private toPublicEvent(row: TimelineRow): TimelineEvent {
    const metadata = this.toMetadata(row.metadata);

    const entityType = (row.relatedEntityType ??
      'Project') as TimelineEvent['entityType'];
    const entityId = row.relatedEntityId ?? row.id;

    const actor = this.resolveActor(row);

    return {
      id: row.id,
      tenantId: row.tenantId,
      entityType,
      entityId,
      eventType: this.normalizeEventType(row.title),
      title: row.title,
      description: row.description,
      actorType: actor.type,
      actorId: actor.id,
      actorName: actor.name,
      severity: row.severity,
      correlationId: row.correlationId ?? null,
      occurredAt: row.occurredAt,
      metadata: {
        ...metadata,
        ...(row.causationId ? { causationId: row.causationId } : {}),
        ...(row.parentEventId ? { parentEventId: row.parentEventId } : {}),
        ...(row.rootEventId ? { rootEventId: row.rootEventId } : {}),
      },
    };
  }

  private toMetadata(
    raw: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  }

  private resolveActor(row: TimelineRow): {
    type: ActorType;
    id: string;
    name: string;
  } {
    if (row.createdByUserId) {
      return {
        type: 'HUMAN',
        id: row.createdByUserId,
        name: row.createdByUserId,
      };
    }
    if (row.createdByAgentId) {
      return {
        type: 'AI_AGENT',
        id: row.createdByAgentId,
        name: row.createdByAgentId,
      };
    }
    // The strictly-one-actor DB constraint guarantees one of the above;
    // fall back to SYSTEM if no actor row is populated (legacy/manual entries).
    return { type: 'SYSTEM', id: 'system', name: 'System' };
  }

  private normalizeEventType(title: string): string {
    // The existing model stores a human-readable title; back-compat
    // mappers turn the title into a stable eventType identifier so the
    // frontend can dispatch on a single canonical vocabulary.
    const upper = title
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    return upper || 'UNKNOWN';
  }
}
