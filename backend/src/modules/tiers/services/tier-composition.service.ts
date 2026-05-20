import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  AddAgentTemplateToTierInput,
  AddDepartmentTemplateToTierInput,
  ITierCompositionService,
  UpdateAgentTemplateTierInput,
  UpdateDepartmentTemplateTierInput,
} from '../interfaces/tier-composition.interface';

@Injectable()
export class TierCompositionService implements ITierCompositionService {
  private readonly logger = new Logger(TierCompositionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAgentTemplatesByTierId(tierId: string) {
    return this.prisma.tierAgentPool.findMany({
      where: { tierId },
      include: { template: true },
      orderBy: { slot: 'asc' },
    });
  }

  async findDepartmentTemplatesByTierId(tierId: string) {
    return this.prisma.tierDepartmentPool.findMany({
      where: { tierId },
      include: { departmentTemplate: true },
      orderBy: { slot: 'asc' },
    });
  }

  async findAgentTemplateEntryById(id: string) {
    const entry = await this.prisma.tierAgentPool.findUnique({
      where: { id },
      include: { template: true, tier: true },
    });
    if (!entry) {
      throw new NotFoundException(`Agent pool entry ${id} not found`);
    }
    return entry;
  }

  async findDepartmentTemplateEntryById(id: string) {
    const entry = await this.prisma.tierDepartmentPool.findUnique({
      where: { id },
      include: { departmentTemplate: true, tier: true },
    });
    if (!entry) {
      throw new NotFoundException(`Department pool entry ${id} not found`);
    }
    return entry;
  }

  async addAgentTemplateToTier(input: AddAgentTemplateToTierInput) {
    const tier = await this.prisma.tier.findUnique({
      where: { id: input.tierId },
    });
    if (!tier) {
      throw new NotFoundException(`Tier ${input.tierId} not found`);
    }

    const template = await this.prisma.agentTemplate.findUnique({
      where: { id: input.templateId },
    });
    if (!template) {
      throw new NotFoundException(
        `Agent template ${input.templateId} not found`,
      );
    }

    const existing = await this.prisma.tierAgentPool.findUnique({
      where: {
        tierId_templateId: {
          tierId: input.tierId,
          templateId: input.templateId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Template ${template.name} already belongs to tier ${tier.name}`,
      );
    }

    const slot = input.slot ?? (await this.getNextAgentSlot(input.tierId));
    const slotType = input.slotType ?? 'CHOICE';
    const isRequired = input.isRequired ?? slotType === 'FIXED';

    const entry = await this.prisma.tierAgentPool.create({
      data: {
        tierId: input.tierId,
        templateId: input.templateId,
        slot,
        slotType,
        isRequired,
        defaultBudgetPerDay: input.defaultBudgetPerDay,
        defaultModel: input.defaultModel,
        isDefaultSelected: input.isDefaultSelected ?? true,
      },
      include: { template: true },
    });

    this.logger.log(
      `Added agent template ${template.name} to tier ${tier.name}`,
    );
    return entry;
  }

  async updateAgentTemplateEntry(
    id: string,
    input: UpdateAgentTemplateTierInput,
  ) {
    await this.findAgentTemplateEntryById(id);

    const data: Prisma.TierAgentPoolUpdateInput = {
      ...(input.slot !== undefined && { slot: input.slot }),
      ...(input.slotType !== undefined && { slotType: input.slotType }),
      ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      ...(input.defaultBudgetPerDay !== undefined && {
        defaultBudgetPerDay: input.defaultBudgetPerDay,
      }),
      ...(input.defaultModel !== undefined && {
        defaultModel: input.defaultModel,
      }),
      ...(input.isDefaultSelected !== undefined && {
        isDefaultSelected: input.isDefaultSelected,
      }),
    };

    return this.prisma.tierAgentPool.update({
      where: { id },
      data,
      include: { template: true },
    });
  }

  async removeAgentTemplateFromTier(id: string) {
    const entry = await this.findAgentTemplateEntryById(id);
    const activeUsage = await this.prisma.agent.count({
      where: { tierAgentPoolId: id, isSelected: true },
    });
    if (activeUsage > 0) {
      throw new BadRequestException(
        `Cannot remove agent pool entry ${id} - ${activeUsage} tenant instance(s) still reference it`,
      );
    }

    await this.prisma.tierAgentPool.delete({ where: { id } });
    this.logger.log(`Removed agent pool entry ${entry.id}`);
  }

  async reorderAgentTemplates(tierId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.tierAgentPool.update({
        where: { id },
        data: { slot: index + 1 },
      }),
    );

    const reordered = await this.prisma.$transaction(updates);
    this.logger.log(
      `Reordered ${reordered.length} agent pool entries for tier ${tierId}`,
    );
    return reordered;
  }

  async addDepartmentTemplateToTier(input: AddDepartmentTemplateToTierInput) {
    const tier = await this.prisma.tier.findUnique({
      where: { id: input.tierId },
    });
    if (!tier) {
      throw new NotFoundException(`Tier ${input.tierId} not found`);
    }

    const template = await this.prisma.departmentTemplate.findUnique({
      where: { id: input.departmentTemplateId },
    });
    if (!template) {
      throw new NotFoundException(
        `Department template ${input.departmentTemplateId} not found`,
      );
    }

    const existing = await this.prisma.tierDepartmentPool.findUnique({
      where: {
        tierId_departmentTemplateId: {
          tierId: input.tierId,
          departmentTemplateId: input.departmentTemplateId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Department template ${template.name} already belongs to tier ${tier.name}`,
      );
    }

    const slot = input.slot ?? (await this.getNextDepartmentSlot(input.tierId));
    const slotType = input.slotType ?? 'CHOICE';
    const isRequired = input.isRequired ?? slotType === 'FIXED';

    const entry = await this.prisma.tierDepartmentPool.create({
      data: {
        tierId: input.tierId,
        departmentTemplateId: input.departmentTemplateId,
        slot,
        slotType,
        isRequired,
        isDefaultSelected: input.isDefaultSelected ?? true,
      },
      include: { departmentTemplate: true },
    });

    this.logger.log(
      `Added department template ${template.name} to tier ${tier.name}`,
    );
    return entry;
  }

  async updateDepartmentTemplateEntry(
    id: string,
    input: UpdateDepartmentTemplateTierInput,
  ) {
    await this.findDepartmentTemplateEntryById(id);

    const data: Prisma.TierDepartmentPoolUpdateInput = {
      ...(input.slot !== undefined && { slot: input.slot }),
      ...(input.slotType !== undefined && { slotType: input.slotType }),
      ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      ...(input.isDefaultSelected !== undefined && {
        isDefaultSelected: input.isDefaultSelected,
      }),
    };

    return this.prisma.tierDepartmentPool.update({
      where: { id },
      data,
      include: { departmentTemplate: true },
    });
  }

  async removeDepartmentTemplateFromTier(id: string) {
    const entry = await this.findDepartmentTemplateEntryById(id);
    const activeUsage = await this.prisma.department.count({
      where: { tierDepartmentPoolId: id, isSelected: true },
    });
    if (activeUsage > 0) {
      throw new BadRequestException(
        `Cannot remove department pool entry ${id} - ${activeUsage} tenant instance(s) still reference it`,
      );
    }

    await this.prisma.tierDepartmentPool.delete({ where: { id } });
    this.logger.log(`Removed department pool entry ${entry.id}`);
  }

  async reorderDepartmentTemplates(tierId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.tierDepartmentPool.update({
        where: { id },
        data: { slot: index + 1 },
      }),
    );

    const reordered = await this.prisma.$transaction(updates);
    this.logger.log(
      `Reordered ${reordered.length} department pool entries for tier ${tierId}`,
    );
    return reordered;
  }

  private async getNextAgentSlot(tierId: string): Promise<number> {
    const last = await this.prisma.tierAgentPool.findFirst({
      where: { tierId },
      orderBy: { slot: 'desc' },
      select: { slot: true },
    });
    return (last?.slot ?? 0) + 1;
  }

  private async getNextDepartmentSlot(tierId: string): Promise<number> {
    const last = await this.prisma.tierDepartmentPool.findFirst({
      where: { tierId },
      orderBy: { slot: 'desc' },
      select: { slot: true },
    });
    return (last?.slot ?? 0) + 1;
  }
}
