import { AgentClassification } from '@prisma/client';

/**
 * Phase 6 — EmployeeEligibilityPort (SOL-02 §Phase 6 task 1).
 *
 * A read-only port for selecting the deterministically best Employee to own a
 * follow-up Task. It is deliberately separate from {@link IEmployeeResolver}:
 * the resolver proves ONE Employee is executable by the core right now, while
 * eligibility ranks the tenant's Employees for assignment and re-validates a
 * planner-nominated Employee inside `tasks.assign`. Never trust planner output
 * alone.
 */
export interface EmployeeEligibilityCriteria {
  /** All of these capabilities must be covered by the Employee. */
  readonly requiredCapabilities?: readonly string[];
  /** When present, the Employee role must match. */
  readonly requiredRole?: string | null;
  /** When present, the Employee department must match. */
  readonly departmentId?: string | null;
  /** Data-classification floor: the Employee must be at or above this level. */
  readonly dataClassification?: AgentClassification;
  /** Hard cap on returned rows. */
  readonly limit?: number;
}

export interface EligibleEmployee {
  readonly employeeId: string;
  readonly name: string;
  readonly role: string | null;
  readonly departmentId: string | null;
  /** Number of required capabilities the Employee covers. */
  readonly capabilityCoverage: number;
  /** True when all required capabilities are covered. */
  readonly capabilityComplete: boolean;
  readonly roleMatch: boolean;
  readonly departmentMatch: boolean;
  readonly dataClassification: AgentClassification;
  /** Non-terminal WorkRun count (never mutable Agent status alone). */
  readonly activeWorkRuns: number;
  readonly maxConcurrency: number;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface IEmployeeEligibility {
  /**
   * Return tenant Employees meeting the criteria, ranked deterministically by
   * capability coverage, then department/role match, then workload (fewer
   * active WorkRuns first), then stable Agent ID (ascending).
   */
  findEligible(
    tenantId: string,
    criteria?: EmployeeEligibilityCriteria,
  ): Promise<readonly EligibleEmployee[]>;

  /**
   * Prove a single Employee is currently eligible for assignment to a Task
   * with the given criteria. Throws TASK_ASSIGNMENT_INELIGIBLE (or
   * EMPLOYEE_NOT_FOUND for a foreign/missing ID) when not eligible. Used to
   * re-validate a planner-nominated Employee inside `tasks.assign`.
   */
  assertEligible(
    tenantId: string,
    employeeId: string,
    criteria?: EmployeeEligibilityCriteria,
  ): Promise<EligibleEmployee>;
}

export const EMPLOYEE_ELIGIBILITY = Symbol('EmployeeEligibility');
