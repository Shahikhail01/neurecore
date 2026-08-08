/**
 * Phase 23 — UNIVERSAL agent executor (CR-AI-0501).
 *
 * The universal agent delegates to any of its registered skills
 * based on the request. In practice it picks `summarize` when the
 * user asks for a summary, `draft-email` when asked to draft, etc.
 *
 * SOLID — SRP: only knows how to route a universal request to the
 *   right skill via the narrow SkillSelection contract.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AgentId } from '../../agent-templates/agents.registry';
import { BaseAgentExecutor, SkillSelection } from './base-agent-executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import { SKILL_STEP, WRITE_STEP } from '../agent-runtime.tokens';
import type { ISkillStep, IWriteStep } from '../interfaces/agent-step.interface';

@Injectable()
export class UniversalAgentExecutor extends BaseAgentExecutor {
  readonly agentId: AgentId = 'CR-AI-0501' as AgentId;
  readonly supportedIntents: ReadonlyArray<string> = [
    'universal.route',
    'universal.clarify',
    'universal.handoff',
    'help.topics',
    'help.listing',
  ];
  readonly skillKeys: ReadonlyArray<string> = [
    'summarize',
    'rewrite',
    'extract',
    'compare',
    'translate',
  ];

  constructor(
    @Inject(SKILL_STEP) skillStep: ISkillStep,
    @Optional() @Inject(WRITE_STEP) writeStep?: IWriteStep,
  ) {
    super(skillStep, writeStep);
  }

  protected selectSkill(ctx: AgentExecuteContext): SkillSelection {
    const lowered = (ctx.message ?? '').toLowerCase().trim();
    if (lowered.startsWith('summarize')) {
      return {
        skillKey: 'summarize',
        input: this.textInput(ctx),
        requiresApproval: false,
      };
    }
    if (lowered.startsWith('rewrite') || lowered.startsWith('rephrase')) {
      return {
        skillKey: 'rewrite',
        input: this.textInput(ctx),
        requiresApproval: false,
      };
    }
    if (lowered.startsWith('extract')) {
      return {
        skillKey: 'extract',
        input: {
          source: { kind: 'text', text: ctx.message },
          schema: { intent: { type: 'string' } },
        },
        requiresApproval: false,
      };
    }
    if (lowered.startsWith('translate')) {
      return {
        skillKey: 'translate',
        input: {
          source: { kind: 'text', text: ctx.message },
          targetLanguage: 'es',
        },
        requiresApproval: false,
      };
    }
    if (lowered.startsWith('compare')) {
      return {
        skillKey: 'compare',
        input: {
          sources: [
            { kind: 'text', text: ctx.message },
            { kind: 'text', text: ctx.message },
          ],
        },
        requiresApproval: false,
      };
    }
    // Default: list help (summarize the user's message — non-mutating).
    return {
      skillKey: 'summarize',
      input: this.textInput(ctx),
      requiresApproval: false,
    };
  }

  private textInput(ctx: AgentExecuteContext): {
    source: { kind: 'text'; text: string };
  } {
    return {
      source: { kind: 'text', text: ctx.message ?? '' },
    };
  }
}
