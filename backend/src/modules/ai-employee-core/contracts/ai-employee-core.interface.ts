import { EmployeeRunFilter, EmployeeRunView } from './employee-run.types';

export interface StartEmployeeRunInput {
  readonly tenantId: string;
  readonly employeeId: string;
  readonly requestedBy: {
    readonly actorId: string;
    readonly actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  };
  readonly objective: string;
  readonly context?: {
    readonly projectId?: string;
    readonly customerId?: string;
    readonly taskId?: string;
    readonly fileIds?: readonly string[];
    readonly threadId?: string;
    readonly includeCapabilities?: readonly string[];
  };
  readonly trigger: {
    readonly type: 'USER' | 'TASK' | 'SCHEDULE' | 'EVENT' | 'MISSION';
    readonly sourceId?: string;
  };
  readonly idempotencyKey: string;
}

/** Result of a durable (create-without-execute) start. */
export interface DurableStartResult {
  /** The canonical run view immediately after creation. */
  readonly run: EmployeeRunView;
  /** True only when this caller created the run; false on an idempotent replay. */
  readonly created: boolean;
}

export interface IAIEmployeeCore {
  start(input: StartEmployeeRunInput): Promise<EmployeeRunView>;
  /**
   * Durable create-or-get without executing. The caller can then invoke
   * `executeRun` when it is safe to run. Returns the canonical run and whether
   * this caller created it (only the creator should execute).
   */
  startDurable(input: StartEmployeeRunInput): Promise<DurableStartResult>;
  /** Execute an already-created Employee WorkRun and return its view. */
  executeRun(tenantId: string, runId: string): Promise<EmployeeRunView>;
  get(tenantId: string, runId: string): Promise<EmployeeRunView | null>;
  list(
    tenantId: string,
    filter?: EmployeeRunFilter,
  ): Promise<readonly EmployeeRunView[]>;
  resume(tenantId: string, runId: string): Promise<EmployeeRunView>;
  cancel(
    tenantId: string,
    runId: string,
    reason: string,
  ): Promise<EmployeeRunView>;
}
