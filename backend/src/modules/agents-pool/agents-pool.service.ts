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

@Injectable()
export class AgentsPoolService extends PoolService<
  AgentTemplate,
  CreateAgentsPoolDto,
  UpdateAgentsPoolDto
> {
  protected readonly uniqueKey: 'id' | 'slug' | 'key' = 'id';

  constructor(private readonly prismaService: PrismaService) {
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
}
