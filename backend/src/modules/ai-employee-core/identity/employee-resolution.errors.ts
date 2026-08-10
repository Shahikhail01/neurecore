export type EmployeeResolutionErrorCode =
  | 'EMPLOYEE_NOT_FOUND'
  | 'EMPLOYEE_INACTIVE'
  | 'EMPLOYEE_NOT_SELECTED'
  | 'EMPLOYEE_ARCHIVED'
  | 'EMPLOYEE_UNAVAILABLE'
  | 'EMPLOYEE_CONCURRENCY_EXCEEDED'
  | 'EMPLOYEE_CONFIGURATION_INVALID';

export class EmployeeResolutionError extends Error {
  constructor(
    readonly code: EmployeeResolutionErrorCode,
    message: string,
    readonly employeeId: string,
  ) {
    super(message);
    this.name = 'EmployeeResolutionError';
  }
}
