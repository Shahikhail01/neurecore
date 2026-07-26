// src/modules/assignments/infrastructure/prisma-agent.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IAgentRepository, AgentEntity } from '../domain/ports/agent-repository.port';

@Injectable()
export class PrismaAgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: any): AgentEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role,
      capabilities: (row.capabilities as string[]) ?? [],
      maxConcurrency: row.maxConcurrency,
      availability: row.availability,
      archived: row.archived,
    };
  }

  async findEligible(
    tenantId: string,
    departmentId?: string,
    role?: string,
  ): Promise<AgentEntity[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        isActive: true,
        archived: false,
        availability: 'AVAILABLE',
        ...(departmentId ? { departmentId } : {}),
        ...(role ? { role } : {}),
      },
    });
    return agents.map((a: any) => this.toEntity(a));
  }

  async findById(tenantId: string, id: string): Promise<AgentEntity | null> {
    const row = await this.prisma.agent.findFirst({
      where: { id, tenantId },
    });
    return row ? this.toEntity(row) : null;
  }
}
