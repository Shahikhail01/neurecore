// src/modules/execution/domain/execution-failures.ts
export enum FailureClassification {
  TRANSIENT_INFRASTRUCTURE = 'TRANSIENT_INFRASTRUCTURE',
  INVALID_INPUT = 'INVALID_INPUT',
  POLICY_DENIAL = 'POLICY_DENIAL',
  TOOL_FUNCTIONAL_FAILURE = 'TOOL_FUNCTIONAL_FAILURE',
  MODEL_QUALITY_FAILURE = 'MODEL_QUALITY_FAILURE',
  CANCELLATION = 'CANCELLATION',
  BUDGET_EXHAUSTION = 'BUDGET_EXHAUSTION',
}

export interface FailureHandling {
  retryable: boolean;
  backoff?: boolean;
  requiresInput?: boolean;
  requiresApproval?: boolean;
  ifClassifiedRetryable?: boolean;
  withinLimit?: boolean;
  safeStop?: boolean;
  visibleFailure?: boolean;
}

export const FAILURE_HANDLING: Record<FailureClassification, FailureHandling> =
  {
    [FailureClassification.TRANSIENT_INFRASTRUCTURE]: {
      retryable: true,
      backoff: true,
    },
    [FailureClassification.INVALID_INPUT]: {
      retryable: false,
      requiresInput: true,
    },
    [FailureClassification.POLICY_DENIAL]: {
      retryable: false,
      requiresApproval: true,
    },
    [FailureClassification.TOOL_FUNCTIONAL_FAILURE]: {
      retryable: true,
      ifClassifiedRetryable: true,
    },
    [FailureClassification.MODEL_QUALITY_FAILURE]: {
      retryable: true,
      withinLimit: true,
    },
    [FailureClassification.CANCELLATION]: {
      retryable: false,
      safeStop: true,
    },
    [FailureClassification.BUDGET_EXHAUSTION]: {
      retryable: false,
      visibleFailure: true,
    },
  };
