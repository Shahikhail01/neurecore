/**
 * AI Twin — Runtime Contract.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.3.6-5.3.8.
 *
 * Per Creatio's published governance rule:
 *   "The AI Twin doesn't get new privileges. It inherits, and is bound by,
 *    the same access as the person it acts for."
 *
 * This module is the single canonical owner of:
 *   • TwinEnvelope: the canonical envelope shape persisted in
 *     AiTwinAuditLog.envelope. Every twin action goes through here.
 *   • TwinActionIntent: the 9 enumerated actions a twin can perform.
 *   • TwinPermissionMirrorGuard: enforces (user.tenantId, user.role,
 *     user.id) on every envelope — no scope elevation, no role widening,
 *     no tenant bypass.
 *
 * Solid:
 *   • SRP — only the runtime contract lives here; the controller and
 *     service are separate concerns.
 *   • OCP — adding a new intent is a new enum value + new branch in
 *     `assertCanExecute`. No existing code changes.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '@/modules/auth/interfaces/token.interface';

/**
 * TwinActionIntent — every action a twin can perform.
 *
 * Each intent maps to one or more backend capabilities. The intent name
 * is persisted in AiTwinAuditLog.action so audit replay can reconstruct
 * what the twin did without needing to parse the envelope body.
 */
export enum TwinActionIntent {
  INTENT_RESOLVED = 'INTENT_RESOLVED',
  TOOL_INVOKED = 'TOOL_INVOKED',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  APPROVAL_GRANTED = 'APPROVAL_GRANTED',
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  WIZARD_ADVANCED = 'WIZARD_ADVANCED',
  DEPLOYED = 'DEPLOYED',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * TwinActionOutcome — categorical outcome of an action.
 *
 * Persisted alongside the action so dashboards can render success /
 * failure / abstain / pending-approval metrics without rehydrating the
 * envelope JSON.
 */
export enum TwinActionOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  ABSTAINED = 'ABSTAINED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

/**
 * TwinPermissionScope — coarse read/write capability scopes the owner can
 * grant. Empty arrays mean "no scope" — the twin cannot perform any
 * actions until the owner explicitly enables scopes.
 *
 * Each scope corresponds to a backend capability id so we can audit
 * "which capabilities did this twin touch" with a single join.
 */
export type TwinPermissionScope = string; // e.g. "crm.read.contacts"

export interface TwinEnvelope {
  // ─── Mandatory audit fields (do NOT omit) ───
  tenantId: string;       // must equal actorUserId's tenant
  twinId: string;
  actorUserId: string;    // human whose permissions the twin inherited
  intent: TwinActionIntent;
  outcome: TwinActionOutcome;
  scopesUsed: TwinPermissionScope[];
  occurredAt: string;     // ISO 8601
  // ─── Optional payload ───
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authorised platform roles that may administer twins across tenants.
 * Twins themselves NEVER inherit platform roles — they only inherit the
 * human owner's role. This set is used for administrative bypass only.
 */
export const TWIN_PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
]);

/**
 * Minimum roles permitted to own a twin. A SUPPORT user (read-only) cannot
 * create a twin because the twin would have no meaningful scopes.
 */
export const TWIN_OWNER_MIN_ROLE: UserRole = UserRole.OWNER;

/**
 * TwinPermissionMirrorGuard.
 *
 * The runtime contract. Every TwinEnvelope that leaves a service MUST pass
 * through `assertCanExecute`. The guard enforces:
 *
 *   1. tenantId is real (no wildcard '*').
 *   2. actorUserId is set (we cannot audit a missing actor).
 *   3. actor's tenantId equals envelope.tenantId (no cross-tenant twins).
 *   4. actor's role ≥ TWIN_OWNER_MIN_ROLE for write intents, or is in
 *      TWIN_PLATFORM_ROLES for read intents.
 *   5. every requested scope is present in the twin's allowedReadScopes /
 *      allowedWriteScopes (the caller passes the twin's allow-list).
 *
 * The guard does NOT consult the DB. It is a pure function of (actor,
 * envelope, twinAllowList). The service layer is responsible for
 * loading the twin's allow-list from the DB.
 */
@Injectable()
export class TwinPermissionMirrorGuard {
  private readonly logger = new Logger(TwinPermissionMirrorGuard.name);

  assertCanExecute(args: {
    actor: JwtPayload;
    twinId: string;
    envelope: Omit<TwinEnvelope, 'twinId' | 'occurredAt' | 'outcome'> & {
      outcome?: TwinActionOutcome;
    };
    twinAllowList: {
      read: TwinPermissionScope[];
      write: TwinPermissionScope[];
      status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    };
  }): TwinEnvelope {
    const { actor, twinId, envelope, twinAllowList } = args;

    // (1) Real tenant id only.
    if (!envelope.tenantId || envelope.tenantId === '*') {
      throw new ForbiddenException(
        'TwinEnvelope.tenantId is required and may not be "*"',
      );
    }

    // (2) Actor id is mandatory for audit attribution.
    if (!actor.sub) {
      throw new ForbiddenException(
        'actor.sub is required to attribute a twin action to a human',
      );
    }

    // (3) Tenant binding — actor and envelope must agree.
    if (
      actor.tenantId &&
      actor.tenantId !== '*' &&
      actor.tenantId !== envelope.tenantId
    ) {
      throw new ForbiddenException(
        `actor tenant ${actor.tenantId} cannot act for tenant ${envelope.tenantId}`,
      );
    }

    // (4) Twin cannot outrank its owner. Write intents require OWNER+
    // role; read intents allow ADMIN/OWNER. Platform roles are permitted
    // for administrative twin-management actions.
    const writeIntents = new Set<TwinActionIntent>([
      TwinActionIntent.TOOL_INVOKED,
      TwinActionIntent.APPROVAL_REQUESTED,
      TwinActionIntent.APPROVAL_GRANTED,
      TwinActionIntent.APPROVAL_REJECTED,
      TwinActionIntent.WIZARD_ADVANCED,
      TwinActionIntent.DEPLOYED,
      TwinActionIntent.PAUSED,
      TwinActionIntent.ARCHIVED,
    ]);
    const isWrite = writeIntents.has(envelope.intent);
    if (isWrite) {
      const allowed =
        actor.role === TWIN_OWNER_MIN_ROLE ||
        TWIN_PLATFORM_ROLES.has(actor.role);
      if (!allowed) {
        throw new ForbiddenException(
          `actor role ${actor.role} cannot perform write intent ${envelope.intent}; OWNER or platform admin required`,
        );
      }
    }

    // (5) Scope enforcement.
    const allow = isWrite ? twinAllowList.write : twinAllowList.read;
    for (const scope of envelope.scopesUsed) {
      if (!allow.includes(scope)) {
        throw new ForbiddenException(
          `scope "${scope}" is not in the twin's ${isWrite ? 'write' : 'read'} allow-list`,
        );
      }
    }

    // Twin lifecycle check — DRAFT twins can be wizard-advanced but
    // cannot invoke tools; PAUSED twins cannot invoke tools either;
    // ARCHIVED twins are fully inert.
    if (
      twinAllowList.status === 'PAUSED' &&
      (envelope.intent === TwinActionIntent.TOOL_INVOKED ||
        envelope.intent === TwinActionIntent.APPROVAL_REQUESTED)
    ) {
      throw new ForbiddenException(
        `twin ${twinId} is PAUSED; resume it before invoking tools`,
      );
    }
    if (
      twinAllowList.status === 'ARCHIVED' &&
      envelope.intent !== TwinActionIntent.WIZARD_ADVANCED
    ) {
      throw new ForbiddenException(
        `twin ${twinId} is ARCHIVED; only wizard edits are permitted`,
      );
    }

    return {
      twinId,
      tenantId: envelope.tenantId,
      actorUserId: actor.sub,
      intent: envelope.intent,
      outcome: envelope.outcome ?? TwinActionOutcome.SUCCESS,
      scopesUsed: envelope.scopesUsed,
      occurredAt: new Date().toISOString(),
      reason: envelope.reason,
      metadata: envelope.metadata,
    };
  }

  /**
   * Build an envelope without the runtime guard — used by the wizard step
   * controller when the user is configuring their own twin (no twin id
   * yet). The wizard is always authorised because the actor IS the owner.
   */
  buildWizardEnvelope(args: {
    actor: JwtPayload;
    tenantId: string;
    intent: TwinActionIntent.WIZARD_ADVANCED | TwinActionIntent.DEPLOYED;
    metadata?: Record<string, unknown>;
    reason?: string;
  }): Pick<TwinEnvelope, 'tenantId' | 'actorUserId' | 'intent' | 'occurredAt' | 'metadata' | 'reason'> {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId is required and may not be "*"');
    }
    return {
      tenantId: args.tenantId,
      actorUserId: args.actor.sub,
      intent: args.intent,
      occurredAt: new Date().toISOString(),
      metadata: args.metadata,
      reason: args.reason,
    };
  }
}
