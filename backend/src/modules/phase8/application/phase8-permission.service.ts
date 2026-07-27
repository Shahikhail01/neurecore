// src/modules/phase8/application/phase8-permission.service.ts
import { Injectable } from '@nestjs/common';
import {
  PHASE8_PERMISSIONS,
  Phase8Action,
  Phase8ActorType,
  Phase8Role,
  SELF_APPROVAL_FORBIDDEN,
} from '../domain/phase8.constants';

export interface Phase8AuthorizationInput {
  role: Phase8Role;
  actorType: Phase8ActorType;
  actorId: string;
  action: Phase8Action;
  subjectActorId?: string;
}

/**
 * Phase 8 — Server-side authorization (§10.1 item 6 + §10.5).
 *
 * The plan is explicit: "Server-side evaluation for all security or
 * mutation decisions. Client-visible flags are presentation hints only
 * and cannot authorize backend behavior."
 *
 * This service is the ONLY place that answers "can actor X do action Y
 * for subject Z in tenant T?". It implements two layers:
 *
 *   1. Static role × action allow-list (PHASE8_PERMISSIONS).
 *   2. Self-approval invariant (SELF_APPROVAL_FORBIDDEN) — enforces
 *      the G5/G6 invariant "AI cannot approve its own task" at the
 *      authorization boundary rather than relying on a downstream
 *      state-machine check.
 */
@Injectable()
export class Phase8PermissionService {
  isAllowed(input: Phase8AuthorizationInput): boolean {
    if (this.isSelfApproval(input)) return false;
    return PHASE8_PERMISSIONS[input.role]?.has(input.action) === true;
  }

  assertAllowed(input: Phase8AuthorizationInput): void {
    if (!this.isAllowed(input)) {
      throw new Error(
        `PHASE8_PERMISSION_DENIED actor=${input.actorId} role=${input.role} action=${input.action}`,
      );
    }
  }

  /**
   * Return the reason an authorization was denied. Used by the
   * security audit logger to record a stable denial reason rather
   * than a free-form message.
   */
  denyReason(input: Phase8AuthorizationInput): string | null {
    if (this.isSelfApproval(input)) {
      return 'SELF_APPROVAL_FORBIDDEN';
    }
    const allowed = PHASE8_PERMISSIONS[input.role]?.has(input.action);
    if (!allowed) {
      return 'ROLE_ACTION_NOT_PERMITTED';
    }
    return null;
  }

  private isSelfApproval(input: Phase8AuthorizationInput): boolean {
    const forbidden = SELF_APPROVAL_FORBIDDEN[input.action];
    if (!forbidden || forbidden.size === 0) return false;
    if (!forbidden.has(input.actorType)) return false;
    if (input.subjectActorId && input.subjectActorId === input.actorId) {
      return true;
    }
    // AI_AGENT and SYSTEM attempting a class of approval actions is
    // forbidden even without a matching subjectActorId — their work is
    // always "their own" and the G5/G6 invariant says no AI-controlled
    // path can approve itself.
    return input.actorType === 'AI_AGENT' || input.actorType === 'SYSTEM';
  }
}
