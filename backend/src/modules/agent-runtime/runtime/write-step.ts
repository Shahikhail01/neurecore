/**
 * Phase 23 — WriteStep implementation (real approval gate).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §4 (P23).
 *
 * Closes the P23 approval gap: previously `requiresApproval` was only
 * echoed back as a status flag while the write still executed. This
 * step is the real gate — every mutating write the runtime performs
 * goes through `submit()`, which:
 *
 *   1. decides whether the skill is approval-sensitive (typed set);
 *   2. if NOT sensitive, delegates straight to `ISkillStep` and
 *      returns `approved: true` (write performed);
 *   3. if sensitive, consults `IApprovalPort` (ADR-006) and FAILS
 *      CLOSED when approval is required — the write is never invoked;
 *      only after an approval decision authorises it is the skill run.
 *
 * Fail-closed: if no approval port is wired, a sensitive write is
 * refused (`approved: false`) rather than silently performed. An agent
 * can never bypass permissions because the underlying skill is only
 * reachable through this step's approval decision.
 *
 * SOLID — SRP: gate + delegation only.
 * SOLID — DIP: injects `IApprovalPort` (optional, via token) and
 *   `ISkillStep`. No direct Prisma, no `new` collaborators.
 * SOLID — ISP: `IWriteStep.submit()` is the single narrow contract.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { APPROVAL_PORT } from '../../approval-port/approval-port.interface';
import type {
  ApprovalContext,
  IApprovalPort,
  WorkActor,
} from '../../approval-port/approval-port.interface';
import type { TenantContext } from '../../../common/context/tenant-context';
import { SKILL_STEP } from '../agent-runtime.tokens';
import type {
  ISkillStep,
  IWriteStep,
  WriteRequest,
  WriteResult,
} from '../interfaces/agent-step.interface';

/**
 * Skills whose execution mutates external state and therefore require
 * human approval before the write is performed. OCP: adding a
 * sensitive skill = one entry here; no edits to the gate logic.
 */
export const APPROVAL_SENSITIVE_SKILLS: ReadonlySet<string> = new Set([
  'draft-email',
  'draft-report',
  'article-draft',
]);

@Injectable()
export class WriteStep implements IWriteStep {
  private readonly logger = new Logger(WriteStep.name);

  constructor(
    @Inject(SKILL_STEP) private readonly skillStep: ISkillStep,
    @Optional() @Inject(APPROVAL_PORT)
    private readonly approvalPort?: IApprovalPort,
  ) {}

  async submit(req: WriteRequest): Promise<WriteResult> {
    const sensitive = APPROVAL_SENSITIVE_SKILLS.has(req.skillKey);

    if (!sensitive) {
      const out = await this.skillStep.invoke(
        req.skillKey,
        req.input,
        req.tenantContext,
      );
      return {
        approved: true,
        output: out.output,
        confidence: out.confidence,
        citationsCount: out.citationsCount,
        durationMs: out.durationMs,
      };
    }

    // Approval-sensitive path. Fail closed: never write until approved.
    const approved = await this.isApproved(req.skillKey, req.tenantContext);
    if (!approved) {
      return {
        approved: false,
        output: `approval required to invoke ${req.skillKey}`,
        confidence: 0,
        citationsCount: 0,
        durationMs: 0,
      };
    }

    const out = await this.skillStep.invoke(
      req.skillKey,
      req.input,
      req.tenantContext,
    );
    return {
      approved: true,
      output: out.output,
      confidence: out.confidence,
      citationsCount: out.citationsCount,
      durationMs: out.durationMs,
    };
  }

  /**
   * Determine whether the write is authorised. Returns false (fail
   * closed) whenever the port is missing or approval is required but
   * not yet granted. This method is intentionally narrow so it can be
   * exercised by the certification gate in isolation.
   */
  async isApproved(
    skillKey: string,
    tenantCtx: TenantContext,
  ): Promise<boolean> {
    if (!this.approvalPort) {
      this.logger.warn(
        `WriteStep: approval port unavailable; fail-closed on ${skillKey}`,
      );
      return false;
    }

    const actor: WorkActor = {
      id: tenantCtx.actorUserId,
      type: 'AI_AGENT',
      name: 'agent-runtime',
      tenantId: tenantCtx.tenantId,
      role: tenantCtx.actorRole,
    };

    const context: ApprovalContext = {
      tenantId: tenantCtx.tenantId,
      projectId: null,
      resourceType: 'agent_action',
      resourceId: skillKey,
      riskTier: null,
      priority: 'HIGH',
      amount: null,
      currency: null,
    };

    try {
      const requirement = await this.approvalPort.evaluateRequirement(
        context,
        actor,
      );
      if (!requirement.governanceAllowed) return false;
      if (requirement.autoApproved) return true;
      if (!requirement.requiresApproval) return true;
      this.logger.debug(
        `WriteStep: ${skillKey} requires approval (reason=${requirement.reason ?? 'n/a'})`,
      );
      return false;
    } catch (err: unknown) {
      this.logger.warn(
        `WriteStep: approval evaluation failed; fail-closed on ${skillKey}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
