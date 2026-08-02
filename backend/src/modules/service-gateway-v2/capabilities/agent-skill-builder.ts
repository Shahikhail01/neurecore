/**
 * Agent and Skill Builder Infrastructure — Phase 4
 *
 * No-code agent and skill management for authorized tenant administrators.
 * Extends existing AgentTemplate, agent-pool services, AiActionRegistry,
 * and ToolRegistry rather than creating new parallel systems.
 *
 * The builder must NOT support:
 * - Arbitrary JavaScript, shell, SQL
 * - Provider keys
 * - Unregistered HTTP URLs
 *
 * Extensibility uses certified registries and connector definitions only.
 */

import { z } from 'zod';

// ── Skill Definition ──────────────────────────────────────────────────────────

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  /** Registered read/action/runtime tool names this skill composes */
  capabilityRefs: string[];
  /** Maximum effect derived from its children (not user-overridable) */
  maxEffect: SkillEffect;
  /** Required authority derived from capabilities (not user-overridable) */
  requiredAuthority: number;
  /** Approval sensitivity derived from capabilities (not user-overridable) */
  approvalSensitive: boolean;
  timeoutMs: number;
  maxRetries: number;
  idempotencyKey?: string;
  responseEnvelopeMapping?: Record<string, string>;
  testExamples?: Array<{
    input: unknown;
    expectedOutput: unknown;
    description: string;
  }>;
  status: SkillStatus;
}

export type SkillEffect = 'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_WRITE';

export type SkillStatus = 'DRAFT' | 'CERTIFIED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

// ── No-code Agent Definition ─────────────────────────────────────────────────

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  purpose: string;
  instructions: string;
  /** Organizational scopes this agent is allowed to operate in */
  allowedScopes: Array<{
    type: 'TENANT' | 'DEPARTMENT' | 'PROJECT';
    id?: string;
  }>;
  /** Selected registered skill IDs */
  skillRefs: string[];
  /** Model capability profile (not raw credentials) */
  modelProfile: ModelProfile;
  /** Authority ceiling */
  authorityCeiling: number;
  /** Escalation owner */
  escalationOwner?: string;
  /** Operational limits */
  limits: AgentLimits;
  /** Channel bindings */
  channelBindings: ChannelBinding[];
  /** Approval policy references */
  approvalPolicyRefs: string[];
  /** Evaluation criteria */
  evaluationCriteria?: {
    datasetId?: string;
    minimumScore: number;
  };
  status: AgentDefinitionStatus;
}

export interface ModelProfile {
  provider: string;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentLimits {
  budgetLimitCents?: number;
  rateLimitPerHour?: number;
  concurrencyLimit?: number;
  schedule?: string; // cron expression
}

export interface ChannelBinding {
  channel: string;
  enabled: boolean;
}

export type AgentDefinitionStatus = 'DRAFT' | 'CERTIFIED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

// ── Skill Composer ────────────────────────────────────────────────────────────

export interface SkillComposition {
  skillId: string;
  inputs: Record<string, unknown>;
  dependsOn: string[];
}

export interface SkillGraph {
  nodes: Array<{
    skillId: string;
    label: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
  }>;
}

/**
 * Validate skill graph for cycles and invalid references
 */
export function validateSkillGraph(
  skills: SkillDefinition[],
  composition: SkillComposition[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const skillIds = new Set(skills.map((s) => s.id));

  // Check all refs are valid
  for (const skill of skills) {
    for (const ref of skill.capabilityRefs) {
      if (!skillIds.has(ref)) {
        errors.push(`Invalid capability reference: ${ref} in skill ${skill.id}`);
      }
    }
  }

  // Check for cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(skillId: string): boolean {
    visited.add(skillId);
    recursionStack.add(skillId);

    const skill = skills.find((s) => s.id === skillId);
    if (skill) {
      for (const ref of skill.capabilityRefs) {
        if (!visited.has(ref)) {
          if (hasCycle(ref)) return true;
        } else if (recursionStack.has(ref)) {
          return true;
        }
      }
    }

    recursionStack.delete(skillId);
    return false;
  }

  for (const skill of skills) {
    if (!visited.has(skill.id)) {
      if (hasCycle(skill.id)) {
        errors.push(`Cycle detected involving skill: ${skill.id}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Effect Derivation ─────────────────────────────────────────────────────────

export const EFFECT_HIERARCHY: Record<SkillEffect, number> = {
  READ: 0,
  INTERNAL_WRITE: 1,
  EXTERNAL_WRITE: 2,
};

/**
 * Derive maximum effect from a collection of capability effects.
 * External write > Internal write > Read
 */
export function deriveMaxEffect(effects: SkillEffect[]): SkillEffect {
  let max = 0;
  for (const effect of effects) {
    const level = EFFECT_HIERARCHY[effect] ?? 0;
    if (level > max) max = level;
  }
  if (max === EFFECT_HIERARCHY.EXTERNAL_WRITE) return 'EXTERNAL_WRITE';
  if (max === EFFECT_HIERARCHY.INTERNAL_WRITE) return 'INTERNAL_WRITE';
  return 'READ';
}
