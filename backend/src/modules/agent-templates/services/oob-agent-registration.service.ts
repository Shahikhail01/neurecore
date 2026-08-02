/**
 * OobAgentRegistrationService — Phase 4 P4
 *
 * SRP: Registers every CR-AI-050x OOTB agent (UNIVERSAL, PRODUCTIVITY,
 * SALES, MARKETING, SERVICE, KNOWLEDGE) as a public AgentTemplate
 * plus an initial ACTIVE AgentTemplateVersion.
 *
 * OCP: New OOTB agents are added by appending to the OOB_AGENTS
 * registry — no engine or pool is added.
 *
 * DIP: Persistence goes through PrismaService. No new database access
 * path is introduced.
 *
 * Tenant isolation: Seeded templates carry `tenantId = null` and
 * `isPublic = true` and are surfaced to every tenant via the existing
 * `tenantVisibleTemplateWhere` filter. Version rows live under a
 * dedicated platform-host tenant (OOB_PLATFORM_TENANT_ID) because the
 * `AgentTemplateVersion.tenantId` column is required by the schema;
 * the pool/list code path resolves the visible template first and the
 * version lookup is keyed off `(agentTemplateId, version)` — not by
 * tenant scoping at the row level. The platform-host tenant is
 * provisioned by the seed script (`seed-oob-agents.cjs`) and is never
 * used as a tenant context for end-user business operations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  OOB_AGENTS,
  OOB_AGENT_INDEX,
  type OotbAgentDefinition,
} from '../instances';
import { OOB_PLATFORM_TENANT_ID } from '../oob-platform.constants';

export interface OobAgentRegistrationResult {
  readonly stableId: string;
  readonly templateId: string;
  readonly versionId: string;
  readonly status: 'CREATED' | 'UNCHANGED';
}

@Injectable()
export class OobAgentRegistrationService {
  private readonly logger = new Logger(OobAgentRegistrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerAll(): Promise<OobAgentRegistrationResult[]> {
    const out: OobAgentRegistrationResult[] = [];
    for (const agent of OOB_AGENTS) {
      out.push(await this.registerOne(agent));
    }
    return out;
  }

  async registerByStableId(
    stableId: string,
  ): Promise<OobAgentRegistrationResult> {
    const agent = OOB_AGENT_INDEX[stableId];
    if (!agent) {
      throw new Error(`Unknown OOB agent stableId=${stableId}`);
    }
    return this.registerOne(agent);
  }

  async activate(stableId: string, actorId: string): Promise<void> {
    const agent = OOB_AGENT_INDEX[stableId];
    if (!agent) {
      throw new Error(`Unknown OOB agent stableId=${stableId}`);
    }
    const template = await this.findTemplate(agent);
    if (!template) {
      const reg = await this.registerOne(agent);
      await this.activateVersion(reg.versionId, actorId, agent);
      return;
    }
    const version = await this.prisma.agentTemplateVersion.findFirst({
      where: {
        tenantId: OOB_PLATFORM_TENANT_ID,
        agentTemplateId: template.id,
        version: agent.version,
      },
    });
    if (!version) {
      const reg = await this.registerOne(agent);
      await this.activateVersion(reg.versionId, actorId, agent);
      return;
    }
    if (version.lifecycleStatus === 'ACTIVE') {
      return;
    }
    await this.activateVersion(version.id, actorId, agent);
  }

  private async activateVersion(
    versionId: string,
    actorId: string,
    agent: OotbAgentDefinition,
  ): Promise<void> {
    await this.prisma.agentTemplateVersion.update({
      where: { id: versionId },
      data: {
        lifecycleStatus: 'ACTIVE',
        certificationStatus: 'CERTIFIED',
        certifiedAt: new Date(),
        certifiedByActorId: actorId,
      },
    });
    await this.prisma.agentLifecycleAuditLog.create({
      data: {
        tenantId: OOB_PLATFORM_TENANT_ID,
        actorId,
        action: 'ACTIVATE_OOB',
        subjectType: 'TEMPLATE',
        subjectId: agent.stableId,
        previousState: { lifecycleStatus: 'DRAFT' },
        newState: {
          lifecycleStatus: 'ACTIVE',
          version: agent.version,
          killSwitchFlagKey: agent.killSwitch.flagKey,
        },
        reason: `Seeded OOB agent ${agent.stableId}@${agent.version} marked ACTIVE`,
      },
    });
  }

  private async registerOne(
    agent: OotbAgentDefinition,
  ): Promise<OobAgentRegistrationResult> {
    const existing = await this.prisma.agentTemplate.findFirst({
      where: {
        tenantId: null,
        name: agent.stableId,
        isPublic: true,
      },
    });

    const config = this.buildConfig(agent);

    const template =
      existing ??
      (await this.prisma.agentTemplate.create({
        data: {
          tenantId: null,
          name: agent.stableId,
          description: agent.purpose,
          type: this.mapAgentType(agent.type),
          model: 'gpt-4o-mini',
          systemPrompt: `You are ${agent.stableId} (${agent.type}). ${agent.purpose}`,
          instructions: agent.purpose,
          permissions: [] as string[] as unknown as Prisma.InputJsonValue,
          config: config as unknown as Prisma.InputJsonValue,
          isPublic: true,
          version: agent.version,
          enabled: true,
        },
      }));

    const version = await this.prisma.agentTemplateVersion.findFirst({
      where: {
        tenantId: OOB_PLATFORM_TENANT_ID,
        agentTemplateId: template.id,
        version: agent.version,
      },
    });

    if (version) {
      return {
        stableId: agent.stableId,
        templateId: template.id,
        versionId: version.id,
        status: 'UNCHANGED',
      };
    }

    const created = await this.prisma.agentTemplateVersion.create({
      data: {
        tenantId: OOB_PLATFORM_TENANT_ID,
        agentTemplateId: template.id,
        version: agent.version,
        definition: {
          purpose: agent.purpose,
          supportedIntents: [...agent.supportedIntents],
          unsupportedIntents: [...agent.unsupportedIntents],
          skills: agent.skills.map((s) => ({
            skillKey: s.skillKey,
            semanticVersion: s.semanticVersion,
            description: s.description,
          })),
          dataSources: [...agent.dataSources],
          toolCeiling: agent.toolCeiling,
          approvalPolicy: agent.approvalPolicy,
          escalationOwner: agent.escalationOwner,
          evaluationSet: agent.evaluationSet.map((t) => ({
            id: t.id,
            intent: t.intent,
            input: t.input,
            expectedOutcome: t.expectedOutcome,
            qualityThreshold: t.qualityThreshold,
          })),
          budget: agent.budget,
          channels: [...agent.channels],
          lifecycle: agent.lifecycle,
          slo: agent.slo,
          killSwitch: agent.killSwitch,
          parBaselineId: agent.stableId,
        } as unknown as Prisma.InputJsonValue,
        composedSkillRefs: agent.skills.map(
          (s) => `${s.skillKey}@${s.semanticVersion}`,
        ) as unknown as Prisma.InputJsonValue,
        maxEffect: 'READ',
        authorityCeiling: 0,
        escalationActorId: null,
        budgetLimit: {
          dailyTokens: agent.budget.dailyTokens,
          dailyCostCents: agent.budget.dailyCostCents,
        } as unknown as Prisma.InputJsonValue,
        rateLimits: {} as unknown as Prisma.InputJsonValue,
        channelBindings: agent.channels as unknown as Prisma.InputJsonValue,
        approvalPolicyRefs: [],
        evaluationMinScore: Math.min(
          ...agent.evaluationSet.map((t) => t.qualityThreshold),
        ),
        evaluationDatasetId: null,
        lifecycleStatus: 'DRAFT',
        certificationStatus: 'DRAFT',
      },
    });

    await this.prisma.agentLifecycleAuditLog.create({
      data: {
        tenantId: OOB_PLATFORM_TENANT_ID,
        actorId: 'system:oob-seed',
        action: 'CREATE_OOB_VERSION',
        subjectType: 'TEMPLATE',
        subjectId: agent.stableId,
        previousState: {},
        newState: {
          version: agent.version,
          lifecycleStatus: 'DRAFT',
        },
        reason: `Seeded OOB agent ${agent.stableId}@${agent.version}`,
      },
    });

    return {
      stableId: agent.stableId,
      templateId: template.id,
      versionId: created.id,
      status: 'CREATED',
    };
  }

  private async findTemplate(agent: OotbAgentDefinition) {
    return this.prisma.agentTemplate.findFirst({
      where: {
        tenantId: null,
        name: agent.stableId,
        isPublic: true,
      },
    });
  }

  private mapAgentType(
    type: OotbAgentDefinition['type'],
  ): 'EXECUTIVE' | 'CORE' | 'FUNCTIONAL' | 'META' {
    switch (type) {
      case 'UNIVERSAL':
        return 'CORE';
      case 'PRODUCTIVITY':
      case 'SALES':
      case 'MARKETING':
      case 'SERVICE':
      case 'KNOWLEDGE':
        return 'FUNCTIONAL';
      default:
        return 'FUNCTIONAL';
    }
  }

  private buildConfig(agent: OotbAgentDefinition): Record<string, unknown> {
    return {
      parBaselineId: agent.stableId,
      type: agent.type,
      supportedIntents: [...agent.supportedIntents],
      unsupportedIntents: [...agent.unsupportedIntents],
      dataSources: [...agent.dataSources],
      toolCeiling: agent.toolCeiling,
      approvalPolicy: agent.approvalPolicy,
      escalationOwner: agent.escalationOwner,
      channels: [...agent.channels],
      budget: agent.budget,
      slo: agent.slo,
      killSwitch: agent.killSwitch,
      lifecycle: agent.lifecycle,
      evaluationSet: agent.evaluationSet.map((t) => ({
        id: t.id,
        intent: t.intent,
        qualityThreshold: t.qualityThreshold,
      })),
    };
  }
}
