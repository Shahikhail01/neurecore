/**
 * Routines Module Interfaces
 *
 * Defines contracts for routine execution and repository patterns
 * following SOLID principles with dependency injection.
 */

import { Routine, RoutineTrigger, RoutineRun } from '@prisma/client';

// ─── Repository Interfaces ────────────────────────────────────────────────────

/**
 * Repository interface for Routine persistence
 *遵循SOLID的接口隔离原则
 */
export interface IRoutineRepository {
  create(data: CreateRoutineInput): Promise<Routine>;
  findById(id: string, tenantId: string): Promise<Routine | null>;
  findAll(tenantId: string, options?: ListRoutinesOptions): Promise<{ routines: Routine[]; total: number }>;
  update(
    id: string,
    tenantId: string,
    data: UpdateRoutineInput,
  ): Promise<Routine>;
  delete(id: string, tenantId: string): Promise<void>;
  updateStatus(
    id: string,
    tenantId: string,
    status: RoutineStatus,
  ): Promise<Routine>;
}

/**
 * Repository interface for RoutineTrigger persistence
 */
export interface IRoutineTriggerRepository {
  create(routineId: string, data: CreateTriggerInput): Promise<RoutineTrigger>;
  findById(id: string, tenantId: string): Promise<RoutineTrigger | null>;
  findByRoutineId(routineId: string): Promise<RoutineTrigger[]>;
  findByWebhookPath(path: string): Promise<RoutineTrigger | null>;
  update(
    id: string,
    tenantId: string,
    data: UpdateTriggerInput,
  ): Promise<RoutineTrigger>;
  delete(id: string, tenantId: string): Promise<void>;
  updateLastFired(id: string, firedAt: Date, nextFire?: Date): Promise<void>;
}

/**
 * Repository interface for RoutineRun persistence
 */
export interface IRoutineRunRepository {
  create(data: CreateRoutineRunInput): Promise<RoutineRun>;
  findById(id: string, tenantId: string): Promise<RoutineRun | null>;
  findByRoutineId(
    routineId: string,
    options?: ListRunsOptions,
  ): Promise<{ runs: RoutineRun[]; total: number }>;
  findByTenantId(
    tenantId: string,
    options?: ListRunsOptions,
  ): Promise<{ runs: RoutineRun[]; total: number }>;
  updateState(id: string, state: Record<string, unknown>): Promise<void>;
  complete(id: string, output: Record<string, unknown>): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  cancel(id: string): Promise<void>;
}

// ─── Executor Interface ───────────────────────────────────────────────────────

/**
 * Core executor interface for running routines via LangGraph
 *
 * This is the primary interface for executing routines, following the
 * Command pattern with support for checkpoint resumption.
 */
export interface IRoutineExecutor {
  /**
   * Execute a routine by ID with optional input
   */
  execute(params: ExecuteRoutineParams): Promise<RoutineExecutionResult>;

  /**
   * Resume a paused/cancelled routine run from checkpoint
   */
  resume(runId: string): Promise<RoutineExecutionResult>;

  /**
   * Cancel a running routine
   */
  cancel(runId: string): Promise<void>;

  /**
   * Get current state of a running routine
   */
  getState(runId: string): Promise<RoutineGraphState | null>;

  /**
   * Validate routine graph definition
   */
  validateGraph(definition: RoutineGraphDefinition): ValidationResult;
}

// ─── Input/Output Types ───────────────────────────────────────────────────────

export type RoutineStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'DISABLED';
export type RoutineTriggerType = 'SCHEDULE' | 'WEBHOOK' | 'EVENT' | 'MANUAL';
export type RoutineRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface CreateRoutineInput {
  name: string;
  description?: string;
  graphDefinition: RoutineGraphDefinition;
  config?: RoutineConfig;
  metadata?: Record<string, unknown>;
  ownerAgentId?: string;
  tenantId: string;
  createdById?: string;
}

export interface UpdateRoutineInput {
  name?: string;
  description?: string;
  graphDefinition?: RoutineGraphDefinition;
  config?: RoutineConfig;
  metadata?: Record<string, unknown>;
  ownerAgentId?: string | null;
}

export interface CreateTriggerInput {
  type: RoutineTriggerType;
  name?: string;
  config: TriggerConfig;
}

export interface UpdateTriggerInput {
  name?: string;
  config?: TriggerConfig;
  isActive?: boolean;
}

export interface CreateRoutineRunInput {
  routineId: string;
  tenantId: string;
  triggerType?: RoutineTriggerType;
  triggerId?: string;
  input?: Record<string, unknown>;
  agentId?: string;
  createdById?: string;
  threadId?: string;
}

// ─── Graph Definition Types ───────────────────────────────────────────────────

/**
 * LangGraph-compatible routine graph definition
 */
export interface RoutineGraphDefinition {
  nodes: RoutineNode[];
  edges: RoutineEdge[];
  conditionalEdges?: RoutineConditionalEdge[];
  entryPoint?: string;
}

export interface RoutineNode {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'condition' | 'approval' | 'transform';
  config: NodeConfig;
}

export interface NodeConfig {
  agentId?: string;
  toolId?: string;
  prompt?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  approval?: ApprovalConfig;
}

export interface ApprovalConfig {
  name?: string;
  workflowType?: string;
  approverRoles?: string[];
  steps?: Array<{ stepOrder: number; approverRole: string[]; approverId?: string }>;
}

export interface RoutineEdge {
  source: string;
  target: string;
  label?: string;
}

export interface RoutineConditionalEdge {
  source: string;
  condition: string; // Function name or expression
  branches: Record<string, string>; // condition result -> target node
}

export interface RoutineConfig {
  maxIterations?: number;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  checkpointEnabled?: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs?: number;
  exponential?: boolean;
}

export interface TriggerConfig {
  // For SCHEDULE type
  cronExpression?: string;
  timezone?: string;

  // For WEBHOOK type
  method?: 'GET' | 'POST' | 'ANY';
  authType?: 'none' | 'signature' | 'bearer';

  // For EVENT type
  eventTypes?: string[];
  filter?: Record<string, unknown>;
}

// ─── Execution Types ──────────────────────────────────────────────────────────

export interface ExecuteRoutineParams {
  routineId: string;
  tenantId: string;
  input?: Record<string, unknown>;
  triggerType?: RoutineTriggerType;
  triggerId?: string;
  agentId?: string;
  userId?: string;
}

export interface RoutineExecutionResult {
  runId: string;
  status: RoutineRunStatus;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  nodeExecutions?: NodeExecution[];
}

export interface NodeExecution {
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  output?: unknown;
  error?: string;
}

export interface RoutineGraphState {
  runId: string;
  currentNode: string | null;
  iteration: number;
  nodes: Record<string, NodeState>;
  context: Record<string, unknown>;
}

export interface NodeState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// ─── Query Options ────────────────────────────────────────────────────────────

export interface ListRoutinesOptions {
  status?: RoutineStatus;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name';
  order?: 'asc' | 'desc';
  /** Phase 1 Gap 1 — filter by single owner agent */
  ownerAgentId?: string;
  /** Phase 1 Gap 1 — filter by multiple owner agents (workspace tab passes dept agents) */
  ownerAgentIds?: string[];
}

export interface ListRunsOptions {
  status?: RoutineRunStatus;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'startedAt';
  order?: 'asc' | 'desc';
}
