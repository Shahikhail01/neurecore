import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * TierLimitExceededException — 422 (Unprocessable Entity)
 *
 * Thrown when a tenant attempts an action (typically `selectTemplate` /
 * `seedFromPackage`) that exceeds the configured Tier's hard limits
 * (maxDepartments / maxAgents / maxStorageGB / maxApprovalStages).
 *
 * Mapped to:
 *   HTTP 422 Unprocessable Entity
 *   error.code === 'TIER_LIMIT_EXCEEDED'
 *
 * This previously surfaced as `403 PERMISSION_DENIED` via the generic
 * ForbiddenException + GlobalExceptionFilter mapping. That mapping was
 * wrong: the request itself was well-formed and authorised, the plan
 * just doesn't allow it. UI uses the structured payload to either
 * route the tenant to a Tier Change flow or recommend a smaller
 * template/package slug.
 *
 * SOLID: SRP — single responsibility is reporting over-cap choices.
 * OCP: extensible — consumers may surface any of the structured
 * fields without changing this class.
 */
export interface TierLimitContext {
  tier: {
    id: string;
    slug: string;
    maxDepartments: number;
    maxAgents: number;
  };
  projected: {
    departments: number;
    agents: number;
  };
  /** Suggestions the UI can offer instead (e.g. smaller template slugs). */
  suggestions?: string[];
  /** Free-form reason, e.g. "Template requires 12 departments". */
  reason: string;
}

export class TierLimitExceededException extends HttpException {
  readonly context: TierLimitContext;

  constructor(context: TierLimitContext) {
    // CRITICAL: pass the `reason` string as the message so that
    // `exception.message` (and `toThrow(/…/)` in tests) match the
    // user-facing copy. The structured payload is exposed via
    // `getResponse()` for the GlobalExceptionFilter to serialise
    // verbatim.
    super(context.reason, HttpStatus.UNPROCESSABLE_ENTITY);
    this.context = context;
    this.name = 'TierLimitExceededException';
  }

  /**
   * Returns the full ApiResponse envelope. Overridden so the
   * GlobalExceptionFilter serialises the structured `error.code` +
   * `error.details` payload rather than the bare message string.
   */
  getResponse(): string | object {
    return {
      status: 'error',
      error: {
        code: 'TIER_LIMIT_EXCEEDED',
        message: this.context.reason,
        details: this.context,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
