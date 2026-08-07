/**
 * Phase 18 — AgentTenantScopeGuard.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE_15_18.md §1.
 *
 * Closes the wildcard bypass noted in
 * `creatio-parity-baseline.yaml` CR-AI-1301 (notes: "12-boundary
 * probe passes; agents.service.ts wildcard bypass exists.").
 *
 * SRP — owns ONLY the tenant-scope assertion logic. No I/O, no DB,
 * no logging beyond the structural reject.
 *
 * DIP — exported as a DI token (AGENT_TENANT_SCOPE) so consumers
 * inject the helper rather than call it directly. Tests can swap
 * a permissive variant when the surrounding guard is the test's
 * responsibility.
 */

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

export const AGENT_TENANT_SCOPE = Symbol('AgentTenantScope');

export type TenantScopeReason =
  | 'CROSS_TENANT'
  | 'MISSING_TENANT'
  | 'AUTH_REJECTED';

export class AgentTenantScopeError extends ForbiddenException {
  constructor(
    message: string,
    readonly reason: TenantScopeReason,
    readonly op: string,
  ) {
    super(message);
    this.name = 'AgentTenantScopeError';
  }
}

@Injectable()
export class AgentTenantScopeGuard {
  private readonly logger = new Logger(AgentTenantScopeGuard.name);

  /**
   * Validate a tenantId. Throws typed error with `reason` so callers
   * can render typed guidance to the operator.
   *
   * Rules (in order):
   *   1. undefined / null / empty / non-string → MISSING_TENANT
   *   2. '*' wildcard → CROSS_TENANT (silently disabling tenant
   *      scoping would leak agents across tenants — strictly
   *      forbidden)
   *   3. otherwise returns the validated value unchanged
   */
  assert(op: string, tenantId: unknown): string {
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new AgentTenantScopeError(
        `${op}: TENANT_ID_REQUIRED (tenantId is required and must be a non-empty string)`,
        'MISSING_TENANT',
        op,
      );
    }
    if (tenantId === '*') {
      throw new AgentTenantScopeError(
        `${op}: TENANT_WILDCARD_FORBIDDEN (CR-AI-1301)`,
        'CROSS_TENANT',
        op,
      );
    }
    return tenantId;
  }

  /**
   * Lightweight probe — true when the tenantId is structurally
   * safe (no wildcards, no empty string). Does NOT throw.
   */
  isAcceptable(tenantId: unknown): boolean {
    return typeof tenantId === 'string' && tenantId.length > 0 && tenantId !== '*';
  }
}
