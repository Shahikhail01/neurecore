// src/modules/agent-templates/agent-skill-definition.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  AgentSkillDefinition,
  AgentSkillMaxEffect,
  AgentTemplateLifecycleStatus,
  AgentSkillCertificationStatus,
} from '@prisma/client';

/**
 * AgentSkillDefinitionRepository — Prisma-backed CRUD for
 * `AgentSkillDefinition`. Tenant-scoped on every operation.
 */
@Injectable()
export class AgentSkillDefinitionRepository {
  private readonly logger = new Logger(AgentSkillDefinitionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(args: {
    tenantId: string;
    skillKey: string;
    semanticVersion: string;
    inputSchema?: Prisma.JsonValue;
    outputSchema?: Prisma.JsonValue;
    composedOf?: Prisma.JsonValue;
    maxEffect: AgentSkillMaxEffect;
    requiredAuthority: number;
    approvalSensitive: boolean;
    preconditions?: Prisma.JsonValue;
    postconditions?: Prisma.JsonValue;
    timeoutMs: number;
    retryPolicy?: Prisma.JsonValue;
    idempotencyKeyPattern?: string;
    responseEnvelopeMapping?: Prisma.JsonValue;
    testExamples?: Prisma.JsonValue;
  }): Promise<AgentSkillDefinition> {
    return this.prisma.agentSkillDefinition.create({
      data: {
        tenantId: args.tenantId,
        skillKey: args.skillKey,
        semanticVersion: args.semanticVersion ?? '1.0.0',
        inputSchema: (args.inputSchema ?? {}) as Prisma.InputJsonValue,
        outputSchema: (args.outputSchema ?? {}) as Prisma.InputJsonValue,
        composedOf: (args.composedOf ?? []) as Prisma.InputJsonValue,
        maxEffect: args.maxEffect,
        requiredAuthority: args.requiredAuthority,
        approvalSensitive: args.approvalSensitive,
        preconditions: (args.preconditions ?? {}) as Prisma.InputJsonValue,
        postconditions: (args.postconditions ?? {}) as Prisma.InputJsonValue,
        timeoutMs: args.timeoutMs,
        retryPolicy: (args.retryPolicy ?? {}) as Prisma.InputJsonValue,
        idempotencyKeyPattern: args.idempotencyKeyPattern ?? null,
        responseEnvelopeMapping: (args.responseEnvelopeMapping ??
          {}) as Prisma.InputJsonValue,
        testExamples: (args.testExamples ?? []) as Prisma.InputJsonValue,
        lifecycleStatus: 'DRAFT',
        certificationStatus: 'DRAFT',
      },
    });
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<AgentSkillDefinition | null> {
    return this.prisma.agentSkillDefinition.findFirst({
      where: { id, tenantId },
    });
  }

  async getByKeyAndVersion(
    tenantId: string,
    skillKey: string,
    semanticVersion: string,
  ): Promise<AgentSkillDefinition | null> {
    return this.prisma.agentSkillDefinition.findFirst({
      where: { tenantId, skillKey, semanticVersion },
    });
  }

  async list(tenantId: string): Promise<AgentSkillDefinition[]> {
    return this.prisma.agentSkillDefinition.findMany({
      where: { tenantId },
      orderBy: [{ skillKey: 'asc' }, { semanticVersion: 'desc' }],
    });
  }

  async updateLifecycle(
    tenantId: string,
    id: string,
    status: AgentTemplateLifecycleStatus,
  ): Promise<AgentSkillDefinition> {
    const result = await this.prisma.agentSkillDefinition.updateMany({
      where: { id, tenantId },
      data: { lifecycleStatus: status },
    });
    if (result.count === 0) {
      throw new Error('Skill not found or tenant mismatch');
    }
    return this.prisma.agentSkillDefinition.findFirstOrThrow({
      where: { id, tenantId },
    });
  }

  async updateCertification(
    tenantId: string,
    id: string,
    data: {
      certificationStatus: AgentSkillCertificationStatus;
      certifiedAt: Date | null;
      certifiedByActorId: string | null;
      certifiedVersion: string | null;
    },
  ): Promise<AgentSkillDefinition> {
    const result = await this.prisma.agentSkillDefinition.updateMany({
      where: { id, tenantId },
      data,
    });
    if (result.count === 0) {
      throw new Error('Skill not found or tenant mismatch');
    }
    return this.prisma.agentSkillDefinition.findFirstOrThrow({
      where: { id, tenantId },
    });
  }

  async setRollbackOf(
    tenantId: string,
    id: string,
    rollbackOfId: string | null,
  ): Promise<AgentSkillDefinition> {
    const result = await this.prisma.agentSkillDefinition.updateMany({
      where: { id, tenantId },
      data: { rollbackOfId },
    });
    if (result.count === 0) {
      throw new Error('Skill not found or tenant mismatch');
    }
    return this.prisma.agentSkillDefinition.findFirstOrThrow({
      where: { id, tenantId },
    });
  }

  async findReferencedSkills(
    tenantId: string,
    skillKeys: string[],
  ): Promise<AgentSkillDefinition[]> {
    if (skillKeys.length === 0) return [];
    return this.prisma.agentSkillDefinition.findMany({
      where: { tenantId, skillKey: { in: skillKeys } },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.agentSkillDefinition.deleteMany({
      where: { id, tenantId },
    });
    if (result.count === 0) {
      throw new Error('Skill not found or tenant mismatch');
    }
  }
}
