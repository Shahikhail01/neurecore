/**
 * Phase 23 — BaseAgentExecutor.
 *
 * Shared helpers for the 6 OOB executors. Subclasses only declare
 * which skills they bind to + how to map a request to a skill input.
 *
 * SOLID — SRP: holds the boilerplate (skill dispatch + outcome
 *   shaping). Subclasses never touch SkillRegistry directly.
 * SOLID — OCP: a 7th agent = extend BaseAgentExecutor, override
 *   `selectSkill()`. No changes here.
 * SOLID — DIP: depends on injected ISkillStep, never on
 *   SkillRegistry directly.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { TenantContext } from '../../../common/context/tenant-context';
import { AgentId } from '../../agent-templates/agents.registry';
import { AgentUnsupportedIntentError } from '../errors';
import type {
  AgentExecuteContext,
  AgentSkillOutcome,
  IAgentExecutor,
} from '../interfaces/agent-runtime.interface';
import { SKILL_STEP, WRITE_STEP } from '../agent-runtime.tokens';
import type { ISkillStep } from '../interfaces/agent-step.interface';
import type { IWriteStep } from '../interfaces/agent-step.interface';

export interface SkillSelection {
  readonly skillKey: string;
  readonly input: unknown;
  readonly requiresApproval: boolean;
}

@Injectable()
export abstract class BaseAgentExecutor implements IAgentExecutor {
  abstract readonly agentId: AgentId;
  abstract readonly supportedIntents: ReadonlyArray<string>;
  abstract readonly skillKeys: ReadonlyArray<string>;

  private readonly logger = new Logger(BaseAgentExecutor.name);

  constructor(
    @Inject(SKILL_STEP) protected readonly skillStep: ISkillStep,
    @Optional() @Inject(WRITE_STEP)
    protected readonly writeStep?: IWriteStep,
  ) {}

  async execute(ctx: AgentExecuteContext): Promise<AgentSkillOutcome> {
    // Validate intent vs supported set (typed error, never silent).
    if (
      this.supportedIntents.length > 0 &&
      !this.matchesSupported(ctx.intent)
    ) {
      throw new AgentUnsupportedIntentError(this.agentId, ctx.intent);
    }

    const selection = this.selectSkill(ctx);
    const tenantCtx: TenantContext = {
      tenantId: ctx.tenantId,
      actorUserId: ctx.actorUserId,
      actorRole: ctx.actorRole,
      isCrossTenant: false,
    };

    // Approval-sensitive write path — the REAL gate. Never write until
    // authorised. If no write step is wired we FAIL CLOSED (the skill
    // is never invoked), so an agent can never bypass permissions.
    if (selection.requiresApproval) {
      if (!this.writeStep) {
        this.logger.warn(
          `agent ${this.agentId}: approval gate unavailable; fail-closed on ${selection.skillKey}`,
        );
        return {
          skillKey: selection.skillKey,
          output: `approval required to invoke ${selection.skillKey}`,
          confidence: 0,
          citationsCount: 0,
          durationMs: 0,
          requiresApproval: true,
        };
      }
      const write = await this.writeStep.submit({
        skillKey: selection.skillKey,
        input: selection.input,
        tenantContext: tenantCtx,
      });
      return {
        skillKey: selection.skillKey,
        output: write.output,
        confidence: write.confidence,
        citationsCount: write.citationsCount,
        durationMs: write.durationMs,
        requiresApproval: !write.approved,
      };
    }

    const step = await this.skillStep.invoke(
      selection.skillKey,
      selection.input,
      tenantCtx,
    );
    return {
      skillKey: selection.skillKey,
      output: step.output,
      confidence: step.confidence,
      citationsCount: step.citationsCount,
      durationMs: step.durationMs,
      requiresApproval: false,
    };
  }

  /**
   * Subclasses decide which skill + input to use for the request.
   * They NEVER touch SkillRegistry directly — only this base does.
   */
  protected abstract selectSkill(ctx: AgentExecuteContext): SkillSelection;

  private matchesSupported(intent: string): boolean {
    const lowered = intent.toLowerCase().trim();
    return this.supportedIntents.some((s) => lowered.includes(s.toLowerCase()));
  }
}
