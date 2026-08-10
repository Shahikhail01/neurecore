import { Injectable } from '@nestjs/common';
import type { WorkRunStatus } from '@prisma/client';
import {
  ArtifactReference,
  EmployeeRunStepView,
  EmployeeRunView,
} from '../contracts/employee-run.types';

export interface EmployeeRunIdentityView {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
}

export interface EmployeeRunProjectionSource {
  readonly id: string;
  readonly tenantId: string;
  readonly employeeId: string | null;
  readonly request: string;
  readonly status: WorkRunStatus;
  readonly triggerType: string;
  readonly triggerSourceId: string | null;
  readonly taskId: string | null;
  readonly summary: string | null;
  readonly failureCode: string | null;
  readonly failureReason: string | null;
  readonly createdAt: Date | string;
  readonly startedAt?: Date | string | null;
  readonly completedAt?: Date | string | null;
}

@Injectable()
export class EmployeeRunViewMapper {
  map(
    run: EmployeeRunProjectionSource,
    employee: EmployeeRunIdentityView,
    artifacts: readonly ArtifactReference[] = [],
    steps: readonly EmployeeRunStepView[] = [],
    approvalId: string | null = null,
  ): EmployeeRunView {
    if (!run.employeeId || run.employeeId !== employee.id) {
      throw new Error(
        'Employee Run view requires the persisted executing employee',
      );
    }

    return {
      id: run.id,
      tenantId: run.tenantId,
      employee: Object.freeze({ ...employee }),
      objective: run.request,
      // The stable Employee view intentionally folds the runtime's short-lived
      // PLANNED state into PLANNING; no public Employee status is lost.
      status: run.status === 'PLANNED' ? 'PLANNING' : run.status,
      trigger: Object.freeze({
        type: run.triggerType,
        sourceId: run.triggerSourceId,
      }),
      taskId: run.taskId,
      summary: run.summary,
      failure:
        run.failureCode || run.failureReason
          ? Object.freeze({
              code: run.failureCode ?? 'WORK_RUN_FAILED',
              reason: run.failureReason ?? 'Work Run failed',
            })
          : null,
      approvalId,
      artifacts: Object.freeze([...artifacts]),
      steps: Object.freeze([...steps]),
      createdAt: this.iso(run.createdAt),
      startedAt: run.startedAt ? this.iso(run.startedAt) : null,
      completedAt: run.completedAt ? this.iso(run.completedAt) : null,
    };
  }

  private iso(value: Date | string): string {
    return typeof value === 'string' ? value : value.toISOString();
  }
}
