/**
 * pool-slot.interface.ts — SOLID: Interface Segregation Principle
 *
 * SRP: Defines only pool-slot contracts (not tier limits, not provisioning)
 * DIP: Services depend on abstractions (interfaces), not concretions
 */

import type { Agent, TierAgentPool, AgentTemplate } from '@prisma/client';

// ─── Slot Types ───────────────────────────────────────────────────────────────

export type SlotType = 'FIXED' | 'CHOICE';

// ─── Pool Slot (resolved with optional filled agent) ───────────────────────────

export interface PoolSlot {
  id: string;
  tierId: string;
  templateId: string;
  templateName: string;       // resolved from template relation
  slot: number;               // position (1-based)
  slotType: SlotType;
  isRequired: boolean;         // true = fixed, false = choice
  isDefaultSelected: boolean;  // pre-selected when tenant is created
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  // Filled state — present when a tenant agent was created from this slot
  filledAgentId?: string;
  filledAgentName?: string;
  filledAgentStatus?: string;
  filledAt?: string;
}

// ─── Tenant Pool Status (aggregated) ─────────────────────────────────────────

export interface TenantPoolStatus {
  tenantId: string;
  tierId: string;
  tierName: string;
  tierSlug: string;
  fixedSlots: PoolSlot[];
  choiceSlots: PoolSlot[];
  // Counts
  totalFixed: number;
  totalChoice: number;
  filledFixed: number;
  filledChoice: number;
  choiceRemaining: number;   // totalChoice - filledChoice
  // Flags
  canAddMoreChoiceAgents: boolean;
  isAtLimit: boolean;
}

// ─── Provision Result ─────────────────────────────────────────────────────────

export interface ProvisionResult {
  agentId: string;
  slotId: string;
  slotType: SlotType;
  isFixed: boolean;
  agentName: string;
}

// ─── Service Interfaces (ISP — focused per operation) ───────────────────────

export interface ITierPoolService {
  /**
   * Get all pool slots for a tier (SUPER_ADMIN view)
   */
  getSlotsForTier(tierId: string): Promise<PoolSlot[]>;

  /**
   * Get pool status for a tenant (which slots filled, remaining)
   * Used by ADMIN portal tenant detail + tenant's own agents page
   */
  getPoolStatusForTenant(tenantId: string): Promise<TenantPoolStatus>;

  /**
   * Get all filled slots for a tenant as a flat list (used by agent store)
   */
  getFilledSlotsForTenant(tenantId: string): Promise<PoolSlot[]>;

  /**
   * Get the pool slot an agent was created from
   */
  getSlotForAgent(agentId: string): Promise<PoolSlot | null>;
}

export interface ITierEnforcementService {
  /**
   * Enforce agent count limits — throws if tenant would exceed choice slots
   * Returns remaining choice slots (0 if at limit)
   */
  enforceAgentLimit(tenantId: string): Promise<number>;

  /**
   * Check if tenant's tier allows API key creation
   * Throws ForbiddenException with clear message if not allowed
   */
  enforceApiAccess(tenantId: string): Promise<void>;

  /**
   * Check if tenant's tier allows audit log export
   * Throws ForbiddenException with clear message if not allowed
   */
  enforceAuditExport(tenantId: string): Promise<void>;
}

export interface IPoolProvisioningService {
  /**
   * Provision an agent from a specific CHOICE slot for a tenant.
   * Used when tenant picks a template for an empty choice slot.
   * Throws if slot is already filled or is a FIXED slot.
   */
  provisionFromSlot(tenantId: string, slotId: string, userId?: string): Promise<Agent>;

  /**
   * Bulk-provision all default-selected slots for a new tenant.
   * Called automatically when a tenant is first created.
   * Returns all provisioned agents.
   */
  provisionDefaultPool(tenantId: string, userId?: string): Promise<Agent[]>;

  /**
   * Release a CHOICE slot — removes the agent and marks slot as empty.
   * Throws if attempted on a FIXED slot.
   */
  releaseSlot(tenantId: string, slotId: string): Promise<void>;

  /**
   * Replace an agent in a CHOICE slot with a new template choice.
   * Releases old slot and provisions new one atomically.
   */
  replaceChoiceSlot(tenantId: string, slotId: string, newTemplateId: string, userId?: string): Promise<Agent>;
}

// ─── Prisma Include Types ─────────────────────────────────────────────────────

export type PoolSlotWithRelations = TierAgentPool & {
  template: AgentTemplate;
  agents: Agent[];
};

export type AgentWithPoolEntry = Agent & {
  tierAgentPool: TierAgentPool & {
    template: AgentTemplate;
  } | null;
};