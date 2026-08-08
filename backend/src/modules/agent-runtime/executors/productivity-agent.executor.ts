/**
 * Phase 23 — PRODUCTIVITY agent executor (CR-AI-0502).
 *
 * Productivity operations: summarize, rewrite, draft-report.
 * Mutating writes (draft-report, draft-email) require approval.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AgentId } from '../../agent-templates/agents.registry';
import { BaseAgentExecutor, SkillSelection } from './base-agent-executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import { SKILL_STEP, WRITE_STEP } from '../agent-runtime.tokens';
import type { ISkillStep, IWriteStep } from '../interfaces/agent-step.interface';

@Injectable()
export class ProductivityAgentExecutor extends BaseAgentExecutor {
  readonly agentId: AgentId = 'CR-AI-0502' as AgentId;
  readonly supportedIntents: ReadonlyArray<string> = [
    'productivity.summarize',
    'productivity.rewrite',
    'productivity.draft-report',
    'productivity.draft-email',
  ];
  readonly skillKeys: ReadonlyArray<string> = [
    'summarize',
    'rewrite',
    'draft-report',
    'draft-email',
  ];

  constructor(
    @Inject(SKILL_STEP) skillStep: ISkillStep,
    @Optional() @Inject(WRITE_STEP) writeStep?: IWriteStep,
  ) {
    super(skillStep, writeStep);
  }

  protected selectSkill(ctx: AgentExecuteContext): SkillSelection {
    const lowered = (ctx.message ?? '').toLowerCase().trim();
    if (lowered.startsWith('rewrite') || lowered.startsWith('rephrase')) {
      return {
        skillKey: 'rewrite',
        input: { source: { kind: 'text', text: ctx.message } },
        requiresApproval: false,
      };
    }
    if (
      lowered.startsWith('draft email') ||
      lowered.startsWith('draft-email')
    ) {
      return {
        skillKey: 'draft-email',
        input: { source: { kind: 'text', text: ctx.message } },
        requiresApproval: true, // mutating — approval gated
      };
    }
    if (
      lowered.startsWith('draft report') ||
      lowered.startsWith('draft-report')
    ) {
      return {
        skillKey: 'draft-report',
        input: { source: { kind: 'text', text: ctx.message } },
        requiresApproval: true,
      };
    }
    // Default: summarize.
    return {
      skillKey: 'summarize',
      input: { source: { kind: 'text', text: ctx.message } },
      requiresApproval: false,
    };
  }
}
