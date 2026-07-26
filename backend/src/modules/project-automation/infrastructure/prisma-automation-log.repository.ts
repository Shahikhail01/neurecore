// src/modules/project-automation/infrastructure/prisma-automation-log.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IAutomationLogRepository,
  AutomationLogEntry,
  CreateAutomationLogInput,
} from '../domain/ports/automation-repository.port';
import { AutomationEventType } from '@prisma/client';

@Injectable()
export class PrismaAutomationLogRepository implements IAutomationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: any): AutomationLogEntry | null {
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.projectId,
      event: row.event,
      status: row.status,
      triggeredBy: row.triggeredBy,
      error: row.error,
      createdAt: row.createdAt,
    };
  }

  async findCompletedForProject(
    tenantId: string,
    projectId: string,
    event: AutomationEventType,
  ): Promise<AutomationLogEntry | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });
    if (!project) return null;

    const row = await this.prisma.projectAutomationLog.findFirst({
      where: { projectId, event, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
    return this.toEntity(row);
  }

  async create(
    input: CreateAutomationLogInput,
    tx?: any,
  ): Promise<AutomationLogEntry> {
    const client = tx ?? this.prisma;
    const row = await client.projectAutomationLog.create({
      data: {
        projectId: input.projectId,
        event: input.event,
        status: input.status,
        triggeredBy: input.triggeredBy,
        error: input.error,
      },
    });
    return this.toEntity(row)!;
  }
}
