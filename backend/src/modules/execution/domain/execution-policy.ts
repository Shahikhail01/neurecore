// src/modules/execution/domain/execution-policy.ts
export interface ExecutionPolicy {
  taskId: string;
  policyVersion: string;
  autonomyLevel: 0 | 1 | 2 | 3 | 4;
  allowedTools: string[];
  deniedTools: string[];
  maxToolCalls: number;
  maxTokens: number;
  maxCost: number;
  timeoutMs: number;
  requiresHumanApproval: boolean;
  externalSideEffectApproval: boolean;
  inputSources: string[];
  promptVersion: string;
  graphVersion: string;
  modelVersion: string;
  toolVersion: string;
  redactionPolicy: 'STANDARD' | 'STRICT';
  sideEffectAllowList: string[];
}

export enum AutonomyLevel {
  L0_SUGGEST = 0,
  L1_DRAFT_EXECUTION = 1,
  L2_INTERNAL_EXECUTION = 2,
  L3_CONDITIONAL_SIDE_EFFECTS = 3,
  L4_BROAD_DELEGATION = 4,
}

export interface ResourceLimits {
  maxTokens: number;
  maxCostCents: number;
  maxDurationMs: number;
  maxToolCalls: number;
}
