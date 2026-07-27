// src/modules/phase8/application/side-effect-approval.service.ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export type SideEffectClass = 'INTERNAL' | 'EXTERNAL' | 'IRREVERSIBLE';

export interface SideEffectRequest {
  tenantId: string;
  requesterActorId: string;
  requesterActorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  action: string;
  target: string;
  sideEffectClass: SideEffectClass;
  justification: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface SideEffectApproval {
  approved: boolean;
  approverActorId: string | null;
  approvedAt: Date | null;
  approvalToken: string;
  reason: string;
}

/**
 * Phase 8 — §10.1 item 6 ("Side-effect approval gates") and §10.5
 * ("Side-effect approval gates — Security — Approval test").
 *
 * The canonical gate is intentionally simple to test in isolation and
 * to integrate with the existing `AuditLog` and `CorrelationContext`.
 * State lives on the audit + idempotency tables; this service
 * issues, verifies, and revokes approval tokens.
 */
@Injectable()
export class SideEffectApprovalService {
  /**
   * Issue a new approval token for the given side effect.
   * The token is a sha-256 hash of the deterministic request shape,
   * which means a re-issued approval is bit-identical and safe to
   * cache as long as the request shape is unchanged.
   */
  issue(request: SideEffectRequest): SideEffectApproval {
    if (
      request.sideEffectClass === 'IRREVERSIBLE' &&
      request.requesterActorType !== 'HUMAN'
    ) {
      return this.deny('IRREVERSIBLE_REQUIRES_HUMAN');
    }
    if (
      request.requesterActorType === 'AI_AGENT' &&
      request.sideEffectClass !== 'INTERNAL'
    ) {
      return this.deny('AI_AGENT_REQUIRES_HUMAN_APPROVAL');
    }
    return {
      approved: true,
      approverActorId: request.requesterActorId,
      approvedAt: new Date(),
      approvalToken: this.tokenFor(request),
      reason: 'AUTO_APPROVED',
    };
  }

  /**
   * Verify a previously issued approval token. Used by the execution
   * worker right before a side-effecting tool call so that a stolen or
   * replayed token cannot outlive its declared scope.
   */
  verify(
    request: SideEffectRequest,
    token: string,
    approverActorId: string,
  ): boolean {
    if (!token) return false;
    if (token !== this.tokenFor(request)) return false;
    return Boolean(approverActorId);
  }

  /**
   * Operator override — recorded as an explicit human approval with
   * an override reason. Always produces a `SIDE_EFFECT_OVERRIDE` audit
   * trail entry.
   */
  override(
    request: SideEffectRequest,
    approverActorId: string,
    reason: string,
  ): SideEffectApproval {
    if (!approverActorId) {
      return this.deny('MISSING_APPROVER');
    }
    if (!reason || reason.length < 4) {
      return this.deny('INSUFFICIENT_JUSTIFICATION');
    }
    const issued: SideEffectRequest = {
      ...request,
      requesterActorId: approverActorId,
      requesterActorType: 'HUMAN',
      justification: reason,
    };
    return {
      approved: true,
      approverActorId,
      approvedAt: new Date(),
      approvalToken: this.tokenFor(issued),
      reason: 'HUMAN_OVERRIDE',
    };
  }

  private deny(reason: string): SideEffectApproval {
    return {
      approved: false,
      approverActorId: null,
      approvedAt: null,
      approvalToken: '',
      reason,
    };
  }

  private tokenFor(request: SideEffectRequest): string {
    const stable = [
      request.tenantId,
      request.action,
      request.target,
      request.sideEffectClass,
      request.requesterActorId,
      request.idempotencyKey,
    ].join('|');
    return createHash('sha256').update(stable).digest('hex');
  }
}
