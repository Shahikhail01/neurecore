/**
 * AgentsPoolService — manages the AI Employees Pool (Pool #1).
 *
 * Phase 10 — Admin Business Composition.
 *
 * Reuses the existing `AgentTemplate` Prisma model.
 * Adds the `enabled` pool-level flag + a specialized toggleEnabled method.
 * Layered transparently on the abstract PoolService (Template Method pattern).
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentTemplate, AgentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PoolListOptions } from '../../common/pool/pool.types';
import {
  PoolModelConfig,
  PoolService,
} from '../../common/pool/pool.service';
import { certifiedPlatformTemplateWhere } from '../agent-templates/agent-template-certification';
import type { CreateAgentsPoolDto } from './dto/create-agents-pool.dto';
import type { UpdateAgentsPoolDto } from './dto/update-agents-pool.dto';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import type {
  PersistedSandboxRun,
  SandboxAgentTemplateDto,
  SandboxAgentTemplateResult,
  SandboxRunComparison,
} from './dto/sandbox-agent-template.dto';

@Injectable()
export class AgentsPoolService extends PoolService<
  AgentTemplate,
  CreateAgentsPoolDto,
  UpdateAgentsPoolDto
> {
  protected readonly uniqueKey: 'id' | 'slug' | 'key' = 'id';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {
    super();
  }

  protected get config(): PoolModelConfig<
    AgentTemplate,
    CreateAgentsPoolDto,
    UpdateAgentsPoolDto
  > {
    return {
      delegate: this.prismaService.agentTemplate as unknown as PoolModelConfig<
        AgentTemplate,
        CreateAgentsPoolDto,
        UpdateAgentsPoolDto
      >['delegate'],
      defaultSortBy: 'updatedAt',
      useSoftDelete: false,
      buildWhere: (opts: PoolListOptions): Prisma.AgentTemplateWhereInput => {
        const where: Prisma.AgentTemplateWhereInput =
          certifiedPlatformTemplateWhere();
        if (opts.status && opts.status !== 'ALL') {
          const upper = opts.status.toUpperCase();
          if (Object.values(AgentType).includes(upper as AgentType)) {
            where.type = upper as AgentType;
          } else if (upper === 'ENABLED') {
            where.enabled = true;
          } else if (upper === 'DISABLED') {
            where.enabled = false;
          }
          // Unknown status strings are silently ignored — admins see all
          // entries rather than a 400 (matches the 'ALL' UI convention).
        }
        if (opts.search) {
          where.OR = [
            { name: { contains: opts.search, mode: 'insensitive' } },
            { description: { contains: opts.search, mode: 'insensitive' } },
          ];
        }
        return where;
      },
      buildOrderBy: (opts: PoolListOptions) => {
        const key = opts.sortBy ?? 'updatedAt';
        const dir = opts.sortDir ?? 'desc';
        return { [key]: dir };
      },
    };
  }

  /** Phase 10 — Pool-level enable/disable toggle. */
  async toggleEnabled(id: string, enabled: boolean): Promise<AgentTemplate> {
    const existing = await this.prismaService.agentTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Agent template ${id} not found`);
    return this.prismaService.agentTemplate.update({
      where: { id },
      data: { enabled },
    });
  }

  /** Phase 10 — duplicate a template for safe cloning. */
  async duplicate(id: string, overrides?: { name?: string }): Promise<AgentTemplate> {
    const original = await this.prismaService.agentTemplate.findUnique({ where: { id } });
    if (!original) throw new NotFoundException(`Agent template ${id} not found`);

    const { id: _id, createdAt: _c, updatedAt: _u, name, ...rest } = original;
    return this.prismaService.agentTemplate.create({
      data: {
        ...rest,
        name: overrides?.name ?? `${name} (copy)`,
        version: '1.0.0',
        enabled: true,
      } as Prisma.AgentTemplateUncheckedCreateInput,
    });
  }

  async sandboxRun(
    id: string,
    dto: SandboxAgentTemplateDto,
    actorId?: string,
  ): Promise<SandboxAgentTemplateResult> {
    const template = await this.prismaService.agentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Agent template ${id} not found`);

    const config = (template.config ?? {}) as Record<string, unknown>;
    const authorityLevel =
      typeof config.authorityLevel === 'string' ? config.authorityLevel : 'RECOMMEND';
    const memoryPolicy =
      typeof config.memoryPolicy === 'string' ? config.memoryPolicy : 'TASK';
    const channels = Array.isArray(config.channels)
      ? config.channels.filter((item): item is string => typeof item === 'string')
      : [];
    const allowedTools = Array.isArray(config.allowedTools)
      ? config.allowedTools.filter((item): item is string => typeof item === 'string')
      : [];
    const blockedTools = Array.isArray(config.blockedTools)
      ? config.blockedTools.filter((item): item is string => typeof item === 'string')
      : [];
    const knowledgeSources = [
      ...(Array.isArray(config.knowledgeSources)
        ? config.knowledgeSources.filter((item): item is string => typeof item === 'string')
        : []),
      ...(dto.knowledgeSources ?? []),
    ];

    const warnings: string[] = [];
    if (!template.systemPrompt?.trim()) warnings.push('Template has no system prompt.');
    if (allowedTools.length === 0 && dto.includeTools) {
      warnings.push('No explicit allowed tools configured; sandbox run is reasoning-only.');
    }
    if (blockedTools.length > 0) {
      warnings.push(`Blocked tools enforced in preview: ${blockedTools.join(', ')}`);
    }

    const contextSections = [
      `Template name: ${template.name}`,
      `Template type: ${template.type}`,
      `Authority level: ${authorityLevel}`,
      `Memory policy: ${memoryPolicy}`,
      `Channels: ${channels.length > 0 ? channels.join(', ') : 'none declared'}`,
      `Allowed tools: ${allowedTools.length > 0 ? allowedTools.join(', ') : 'none declared'}`,
      `Blocked tools: ${blockedTools.length > 0 ? blockedTools.join(', ') : 'none'}`,
      `Knowledge sources: ${knowledgeSources.length > 0 ? knowledgeSources.join(', ') : 'none declared'}`,
      `Permissions: ${Array.isArray(template.permissions) ? template.permissions.join(', ') : 'none declared'}`,
    ];

    const response = await this.aiGateway.invoke({
      tenantId: null,
      capability: 'conversation',
      sourceModule: 'agents-pool-sandbox',
      modelId: dto.modelOverride ?? template.model,
      systemPrompt:
        `${template.systemPrompt ?? 'You are a platform agent template under test.'}\n\n` +
        `Sandbox execution rules:\n` +
        `- Do not claim to have executed external side effects.\n` +
        `- If a tool would normally be used, describe the intended tool call instead.\n` +
        `- If information is missing, state assumptions clearly.\n` +
        `- Return concise operational output followed by a 'Tool plan' section.\n`,
      prompt:
        `You are testing an undeployed platform agent template in a safe sandbox.\n\n` +
        `${contextSections.join('\n')}\n\n` +
        `User prompt:\n${dto.prompt}\n\n` +
        `Respond as the configured agent would. Then include a short "Tool plan:" list of intended tool actions without executing them.`,
      maxTokens: dto.maxTokens ?? 900,
      temperature: 0.2,
      metadata: {
        templateId: template.id,
        templateName: template.name,
        sandbox: true,
        includeTools: dto.includeTools ?? true,
      },
    });

    const content = response.content;
    const sections = content.split(/tool plan:/i);
    const toolPlan =
      sections.length > 1
        ? sections[1]
            .split('\n')
            .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
            .filter(Boolean)
        : [];

    const result: SandboxAgentTemplateResult = {
      templateId: template.id,
      templateName: template.name,
      model: response.model || template.model,
      authorityLevel,
      memoryPolicy,
      channels,
      allowedTools,
      blockedTools,
      knowledgeSources,
      response: sections[0]?.trim() || content,
      toolPlan,
      warnings,
      tokenUsage: {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens,
        total: response.usage.totalTokens,
      },
    };

    await this.prismaService.auditLog.create({
      data: {
        actor: actorId ?? 'system',
        action: 'agents_pool.sandbox_run',
        resource: 'agent_template',
        resourceId: template.id,
        tenantId: null,
        result: 'success',
        details: {
          prompt: dto.prompt,
          modelOverride: dto.modelOverride ?? null,
          includeTools: dto.includeTools ?? true,
          knowledgeSources,
          sandboxResult: result,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  }

  async listSandboxRuns(templateId: string): Promise<PersistedSandboxRun[]> {
    const rows = await this.prismaService.auditLog.findMany({
      where: {
        action: 'agents_pool.sandbox_run',
        resource: 'agent_template',
        resourceId: templateId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return rows.map((row) => {
      const details = (row.details ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        actor: row.actor,
        createdAt: row.createdAt.toISOString(),
        prompt: (details.prompt as string) ?? '',
        result: details.sandboxResult as SandboxAgentTemplateResult,
      };
    });
  }

  async compareSandboxRuns(
    templateId: string,
    leftId: string,
    rightId: string,
  ): Promise<SandboxRunComparison> {
    const rows = await this.prismaService.auditLog.findMany({
      where: {
        id: { in: [leftId, rightId] },
        action: 'agents_pool.sandbox_run',
        resource: 'agent_template',
        resourceId: templateId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (rows.length !== 2) {
      throw new NotFoundException('Sandbox comparison runs not found');
    }

    const normalized = rows.map((row) => {
      const details = (row.details ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        actor: row.actor,
        createdAt: row.createdAt.toISOString(),
        prompt: (details.prompt as string) ?? '',
        result: details.sandboxResult as SandboxAgentTemplateResult,
      };
    });

    const left = normalized.find((row) => row.id === leftId)!;
    const right = normalized.find((row) => row.id === rightId)!;

    return {
      left,
      right,
      summary: {
        responseChanged: left.result.response !== right.result.response,
        toolPlanChanged:
          JSON.stringify(left.result.toolPlan) !== JSON.stringify(right.result.toolPlan),
        tokenDelta: right.result.tokenUsage.total - left.result.tokenUsage.total,
        warningDelta: right.result.warnings.length - left.result.warnings.length,
      },
    };
  }
}
