export type EmployeeEligibilityErrorCode =
  | 'EMPLOYEE_NOT_FOUND'
  | 'TASK_ASSIGNMENT_INELIGIBLE';

export class EmployeeEligibilityError extends Error {
  constructor(
    readonly code: EmployeeEligibilityErrorCode,
    message: string,
    readonly employeeId: string,
  ) {
    super(message);
    this.name = 'EmployeeEligibilityError';
  }
}
