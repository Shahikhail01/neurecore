export type EmployeeRunStatus =
  | 'CREATED'
  | 'PLANNING'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ArtifactReference {
  readonly id: string;
  readonly type: string;
  readonly name: string;
}

export interface EmployeeRunStepView {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

export interface EmployeeRunView {
  readonly id: string;
  readonly tenantId: string;
  readonly employee: {
    readonly id: string;
    readonly name: string;
    readonly role: string | null;
  };
  readonly objective: string;
  readonly status: EmployeeRunStatus;
  readonly trigger: { readonly type: string; readonly sourceId: string | null };
  readonly taskId: string | null;
  readonly summary: string | null;
  readonly failure: { readonly code: string; readonly reason: string } | null;
  readonly approvalId: string | null;
  readonly artifacts: readonly ArtifactReference[];
  readonly steps: readonly EmployeeRunStepView[];
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface EmployeeRunFilter {
  readonly employeeId?: string;
  readonly status?: EmployeeRunStatus;
  readonly taskId?: string;
}
