// src/modules/agent-templates/agent-template-version.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  AgentTemplateLifecycleStatus,
  AgentSkillMaxEffect,
  AgentTemplateVersion,
} from '@prisma/client';

/**
 * AgentTemplateVersionRepository — Prisma-backed CRUD for
 * `AgentTemplateVersion`. Every read/write is tenant-scoped.
 *
 * SRP: only handles persistence of AgentTemplateVersion rows.
 * Business transitions live in AgentTemplateLifecycleService.
 */
@Injectable()
export class AgentTemplateVersionRepository {
  private readonly logger = new Logger(AgentTemplateVersionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async createVersion(args: {
    tenantId: string;
    agentTemplateId: string;
    version: string;
    definition: Prisma.JsonValue;
    composedSkillRefs: string[];
    maxEffect: AgentSkillMaxEffect;
    authorityCeiling: number;
    escalationActorId?: string;
    budgetLimit?: Prisma.JsonValue;
    rateLimits?: Prisma.JsonValue;
    channelBindings?: Prisma.JsonValue;
    approvalPolicyRefs?: string[];
    evaluationMinScore?: number;
    evaluationDatasetId?: string;
  }): Promise<AgentTemplateVersion> {
    return this.prisma.agentTemplateVersion.create({
      data: {
        tenantId: args.tenantId,
        agentTemplateId: args.agentTemplateId,
        version: args.version,
        definition: (args.definition ?? {}) as Prisma.InputJsonValue,
        composedSkillRefs: (args.composedSkillRefs ??
          []) as unknown as Prisma.InputJsonValue,
        maxEffect: args.maxEffect,
        authorityCeiling: args.authorityCeiling,
        escalationActorId: args.escalationActorId ?? null,
        budgetLimit: (args.budgetLimit ?? null) as Prisma.InputJsonValue,
        rateLimits: (args.rateLimits ?? null) as Prisma.InputJsonValue,
        channelBindings: (args.channelBindings ??
          []) as unknown as Prisma.InputJsonValue,
        approvalPolicyRefs: args.approvalPolicyRefs ?? [],
        evaluationMinScore: args.evaluationMinScore ?? null,
        evaluationDatasetId: args.evaluationDatasetId ?? null,
        lifecycleStatus: 'DRAFT',
        certificationStatus: 'DRAFT',
      },
    });
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<AgentTemplateVersion | null> {
    return this.prisma.agentTemplateVersion.findFirst({
      where: { id, tenantId },
    });
  }

  async getByVersion(
    tenantId: string,
    agentTemplateId: string,
    version: string,
  ): Promise<AgentTemplateVersion | null> {
    return this.prisma.agentTemplateVersion.findFirst({
      where: { tenantId, agentTemplateId, version },
    });
  }

  /**
   * The current ACTIVE version for a template, if any. Used as the
   * rollback target by default.
   */
  async getCurrent(
    tenantId: string,
    agentTemplateId: string,
  ): Promise<AgentTemplateVersion | null> {
    return this.prisma.agentTemplateVersion.findFirst({
      where: {
        tenantId,
        agentTemplateId,
        lifecycleStatus: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listHistory(
    tenantId: string,
    agentTemplateId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<AgentTemplateVersion[]> {
    return this.prisma.agentTemplateVersion.findMany({
      where: { tenantId, agentTemplateId },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 50,
      skip: opts?.offset ?? 0,
    });
  }

  /**
   * Mark an existing version as superseded by another version. Used when
   * a newer version becomes ACTIVE.
   */
  async supersede(args: {
    tenantId: string;
    agentTemplateId: string;
    version: string;
    supersededByVersionId: string;
  }): Promise<AgentTemplateVersion> {
    return this.prisma.agentTemplateVersion.update({
      where: {
        tenantId_agentTemplateId_version: {
          tenantId: args.tenantId,
          agentTemplateId: args.agentTemplateId,
          version: args.version,
        },
      },
      data: { supersededByVersionId: args.supersededByVersionId },
    });
  }

  async updateLifecycle(
    tenantId: string,
    id: string,
    status: AgentTemplateLifecycleStatus,
  ): Promise<AgentTemplateVersion> {
    const updated = await this.prisma.agentTemplateVersion.updateMany({
      where: { id, tenantId },
      data: { lifecycleStatus: status },
    });
    if (updated.count === 0) {
      throw new Error('Version not found or tenant mismatch');
    }
    const fresh = await this.prisma.agentTemplateVersion.findFirstOrThrow({
      where: { id, tenantId },
    });
    return fresh;
  }

  async updateCertification(
    tenantId: string,
    id: string,
    data: {
      certificationStatus: 'DRAFT' | 'CERTIFIED' | 'DEPRECATED' | 'RETIRED';
      certifiedAt: Date | null;
      certifiedByActorId: string | null;
    },
  ): Promise<AgentTemplateVersion> {
    const updated = await this.prisma.agentTemplateVersion.updateMany({
      where: { id, tenantId },
      data,
    });
    if (updated.count === 0) {
      throw new Error('Version not found or tenant mismatch');
    }
    const fresh = await this.prisma.agentTemplateVersion.findFirstOrThrow({
      where: { id, tenantId },
    });
    return fresh;
  }
}
