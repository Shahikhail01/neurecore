// src/modules/project-automation/domain/automation-states.ts
export enum ProjectAutomationStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  REQUESTED = 'REQUESTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  FAILED_FINAL = 'FAILED_FINAL',
}

export const AUTOMATION_TRANSITIONS: Record<ProjectAutomationStatus, ProjectAutomationStatus[]> = {
  [ProjectAutomationStatus.NOT_REQUESTED]: [ProjectAutomationStatus.REQUESTED],
  [ProjectAutomationStatus.REQUESTED]: [ProjectAutomationStatus.PROCESSING],
  [ProjectAutomationStatus.PROCESSING]: [
    ProjectAutomationStatus.COMPLETED,
    ProjectAutomationStatus.PARTIAL,
    ProjectAutomationStatus.FAILED_RETRYABLE,
  ],
  [ProjectAutomationStatus.COMPLETED]: [],
  [ProjectAutomationStatus.PARTIAL]: [ProjectAutomationStatus.PROCESSING],
  [ProjectAutomationStatus.FAILED_RETRYABLE]: [
    ProjectAutomationStatus.PROCESSING,
    ProjectAutomationStatus.FAILED_FINAL,
  ],
  [ProjectAutomationStatus.FAILED_FINAL]: [],
};

export class AutomationStateMachine {
  static canTransition(
    from: ProjectAutomationStatus,
    to: ProjectAutomationStatus,
  ): boolean {
    return AUTOMATION_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(
    from: ProjectAutomationStatus,
    to: ProjectAutomationStatus,
  ): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid automation transition from ${from} to ${to}`);
    }
  }
}
