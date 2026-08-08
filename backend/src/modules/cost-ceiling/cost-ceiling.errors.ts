/**
 * Phase 30 — Cost ceiling typed errors (CR-AI-1305).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30)
 * — "exceeding ceiling → typed `CostCeilingExceededError` → gate the
 * LLM call".
 *
 * Following the platform convention (`SkillAbstainedError`,
 * `LlmOptedOutError`, `KillSwitchTenantScopeError`): a named error
 * class carrying structured, readonly context — never a bare
 * `new Error('...')`.
 *
 * `CostCeilingExceededError` extends `HttpException` with 402
 * Payment Required so the global exception filter renders a stable
 * machine-readable body for API callers, while in-process callers
 * (the LLM runner) can still branch on `instanceof`.
 */

import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import type { CeilingEvaluation } from './interfaces/ICeilingRule';

export const COST_CEILING_ERROR_CODE = 'COST_CEILING_EXCEEDED';

export class CostCeilingExceededError extends HttpException {
  constructor(
    readonly tenantId: string,
    readonly capability: string,
    readonly evaluation: CeilingEvaluation,
  ) {
    super(
      {
        code: COST_CEILING_ERROR_CODE,
        message: `cost ceiling ${evaluation.dimension} exceeded for tenant ${tenantId}`,
        dimension: evaluation.dimension,
        unit: evaluation.unit,
        used: evaluation.used,
        projected: evaluation.projected,
        limitValue: evaluation.limitValue,
        capability,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
    this.name = 'CostCeilingExceededError';
  }
}

/** Thrown when a caller omits the tenant or passes the wildcard. */
export class CostCeilingScopeError extends ForbiddenException {
  constructor(operation: string) {
    super(`tenantId required for ${operation}; wildcard or empty forbidden`);
    this.name = 'CostCeilingScopeError';
  }
}

/** Thrown when a ceiling is configured with a non-integer or negative limit. */
export class InvalidCeilingLimitError extends Error {
  constructor(readonly limitValue: number) {
    super(
      `ceiling limit must be a non-negative safe integer, received ${limitValue}`,
    );
    this.name = 'InvalidCeilingLimitError';
  }
}
