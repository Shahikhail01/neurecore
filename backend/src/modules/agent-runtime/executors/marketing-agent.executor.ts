/**
 * Phase 23 — MARKETING agent executor (CR-AI-0504).
 *
 * Marketing operations: extract segment fields, draft campaign
 * emails, draft campaign reports. Mutating writes are approval-gated.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AgentId } from '../../agent-templates/agents.registry';
import { BaseAgentExecutor, SkillSelection } from './base-agent-executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import { SKILL_STEP, WRITE_STEP } from '../agent-runtime.tokens';
import type { ISkillStep, IWriteStep } from '../interfaces/agent-step.interface';

@Injectable()
export class MarketingAgentExecutor extends BaseAgentExecutor {
  readonly agentId: AgentId = 'CR-AI-0504' as AgentId;
  readonly supportedIntents: ReadonlyArray<string> = [
    'marketing.segment',
    'marketing.campaign',
    'marketing.draft-email',
    'marketing.draft-report',
  ];
  readonly skillKeys: ReadonlyArray<string> = [
    'extract',
    'draft-email',
    'draft-report',
  ];

  constructor(
    @Inject(SKILL_STEP) skillStep: ISkillStep,
    @Optional() @Inject(WRITE_STEP) writeStep?: IWriteStep,
  ) {
    super(skillStep, writeStep);
  }

  protected selectSkill(ctx: AgentExecuteContext): SkillSelection {
    const lowered = (ctx.message ?? '').toLowerCase().trim();
    if (lowered.startsWith('segment') || lowered.startsWith('extract')) {
      return {
        skillKey: 'extract',
        input: {
          source: { kind: 'text', text: ctx.message },
          schema: { segment: { type: 'string' } },
        },
        requiresApproval: false,
      };
    }
    if (lowered.startsWith('draft email') || lowered.startsWith('campaign')) {
      return {
        skillKey: 'draft-email',
        input: { source: { kind: 'text', text: ctx.message } },
        requiresApproval: true,
      };
    }
    if (lowered.startsWith('draft report')) {
      return {
        skillKey: 'draft-report',
        input: { source: { kind: 'text', text: ctx.message } },
        requiresApproval: true,
      };
    }
    return {
      skillKey: 'summarize',
      input: { source: { kind: 'text', text: ctx.message } },
      requiresApproval: false,
    };
  }
}
