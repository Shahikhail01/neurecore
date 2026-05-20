export type TierSlotType = 'FIXED' | 'CHOICE';

export interface AddAgentTemplateToTierInput {
  tierId: string;
  templateId: string;
  slot?: number;
  slotType?: TierSlotType;
  isRequired?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  isDefaultSelected?: boolean;
}

export interface UpdateAgentTemplateTierInput {
  slot?: number;
  slotType?: TierSlotType;
  isRequired?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  isDefaultSelected?: boolean;
}

export interface AddDepartmentTemplateToTierInput {
  tierId: string;
  departmentTemplateId: string;
  slot?: number;
  slotType?: TierSlotType;
  isRequired?: boolean;
  isDefaultSelected?: boolean;
}

export interface UpdateDepartmentTemplateTierInput {
  slot?: number;
  slotType?: TierSlotType;
  isRequired?: boolean;
  isDefaultSelected?: boolean;
}

export interface ITierCompositionService {
  findAgentTemplatesByTierId(tierId: string): Promise<any[]>;
  findDepartmentTemplatesByTierId(tierId: string): Promise<any[]>;
  findAgentTemplateEntryById(id: string): Promise<any>;
  findDepartmentTemplateEntryById(id: string): Promise<any>;
  addAgentTemplateToTier(input: AddAgentTemplateToTierInput): Promise<any>;
  updateAgentTemplateEntry(
    id: string,
    input: UpdateAgentTemplateTierInput,
  ): Promise<any>;
  removeAgentTemplateFromTier(id: string): Promise<void>;
  reorderAgentTemplates(tierId: string, orderedIds: string[]): Promise<any[]>;
  addDepartmentTemplateToTier(
    input: AddDepartmentTemplateToTierInput,
  ): Promise<any>;
  updateDepartmentTemplateEntry(
    id: string,
    input: UpdateDepartmentTemplateTierInput,
  ): Promise<any>;
  removeDepartmentTemplateFromTier(id: string): Promise<void>;
  reorderDepartmentTemplates(
    tierId: string,
    orderedIds: string[],
  ): Promise<any[]>;
}
