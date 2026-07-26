// src/modules/assignments/commands/assign-task.command.ts
// Phase 4 / plan §6.2 — AssignTaskCommand. Owns the only authoritative
// path that mutates task→agent linkage, releases capacity, and emits
// the TaskAssigned audit + outbox event.
//
// The assignment command—not the search result—owns correctness.

import { CommandResult } from '../../../common/commands/command.interface';

export const ASSIGN_TASK_COMMAND = 'AssignTaskCommand';
export const ASSIGN_TASK_VERSION = '1.0';

export type DataClassification = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface AssignTaskInput {
  tenantId: string;
  taskId: string;
  /** Optional override (plan §6.5 "Manual override"). Undefined → auto. */
  agentId?: string;
  /** Required when agentId is provided. Disables scoring. */
  manualOverrideRationale?: string;
  /** TTL for this assignment in seconds. Defaults to 8h. */
  expiresInSeconds?: number;
  /** Override actor; populated by the controller from auth context. */
  overrideByActorId?: string;
  overrideByActorType?: string;
  /** The classification floor — assignment only picks agents whose
   *  dataClassification ≥ this value (plan §6.1). */
  dataClassification?: DataClassification;
  /** Optional department alignment requirement. */
  departmentId?: string;
  /** Optional capability requirements (forwarded from the task). */
  requiredCapabilities?: string[];
  requiredRole?: string;
}

export interface AssignTaskResult {
  assignmentId: string;
  taskId: string;
  agentId: string;
  generation: number;
  rationale: string;
  policyVersion: string;
  manualOverride: boolean;
  expiresAt: string | null;
  newTaskVersion: number;
  capabilityScore: number;
  workloadScore: number;
  departmentScore: number;
  historicalScore: number;
  totalScore: number;
  /**
   * Ranked alternatives surfaced so the picker UI can show
   * "other eligible AI employees" alongside the chosen one. Plan §6.2
   * calls for "alternatives" on the assignment decision.
   */
  alternatives: Array<{
    agentId: string;
    agentName: string;
    score: number;
    rationale: string;
    policyVersion: string;
  }>;
}
