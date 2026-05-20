/**
 * AgentPoolService - SOLID: Single Responsibility Principle
 *
 * SRP: ONLY manages tier<->agent template mappings
 * DIP: Depends on PrismaService abstraction
 */

import { Injectable, Logger } from '@nestjs/common';
import { TierCompositionService } from './tier-composition.service';
import type { TierSlotType } from '../interfaces/tier-composition.interface';

export interface AddToPoolInput {
  tierId: string;
  templateId: string;
  slot?: number;
  slotType?: TierSlotType;
  isRequired?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  isDefaultSelected?: boolean;
}

export interface UpdatePoolEntryInput {
  slot?: number;
  slotType?: TierSlotType;
  isRequired?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  isDefaultSelected?: boolean;
}

export interface IAgentPoolService {
  findByTierId(tierId: string): Promise<any[]>;
  findById(id: string): Promise<any>;
  addToPool(input: AddToPoolInput): Promise<any>;
  updatePoolEntry(id: string, input: UpdatePoolEntryInput): Promise<any>;
  removeFromPool(id: string): Promise<void>;
  reorderPool(tierId: string, orderedIds: string[]): Promise<any[]>;
}

@Injectable()
export class AgentPoolService implements IAgentPoolService {
  private readonly logger = new Logger(AgentPoolService.name);

  constructor(
    private readonly tierCompositionService: TierCompositionService,
  ) {}

  async findByTierId(tierId: string) {
    return this.tierCompositionService.findAgentTemplatesByTierId(tierId);
  }

  async findById(id: string) {
    return this.tierCompositionService.findAgentTemplateEntryById(id);
  }

  async addToPool(input: AddToPoolInput) {
    return this.tierCompositionService.addAgentTemplateToTier(input);
  }

  async updatePoolEntry(id: string, input: UpdatePoolEntryInput) {
    return this.tierCompositionService.updateAgentTemplateEntry(id, input);
  }

  async removeFromPool(id: string) {
    await this.tierCompositionService.removeAgentTemplateFromTier(id);
  }

  async reorderPool(tierId: string, orderedIds: string[]) {
    return this.tierCompositionService.reorderAgentTemplates(
      tierId,
      orderedIds,
    );
  }
}
