/**
 * Phase 23 — SALES agent executor (CR-AI-0503).
 *
 * Sales operations: summarize a CRM record, extract lead fields,
 * draft a sales email (mutating → approval).
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AgentId } from '../../agent-templates/agents.registry';
import { BaseAgentExecutor, SkillSelection } from './base-agent-executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import { SKILL_STEP, WRITE_STEP } from '../agent-runtime.tokens';
import type { ISkillStep, IWriteStep } from '../interfaces/agent-step.interface';

@Injectable()
export class SalesAgentExecutor extends BaseAgentExecutor {
  readonly agentId: AgentId = 'CR-AI-0503' as AgentId;
  readonly supportedIntents: ReadonlyArray<string> = [
    'sales.summarize-lead',
    'sales.extract-lead',
    'sales.draft-email',
    'sales.score-lead',
  ];
  readonly skillKeys: ReadonlyArray<string> = [
    'summarize',
    'extract',
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
    if (lowered.startsWith('extract') || lowered.startsWith('score')) {
      return {
        skillKey: 'extract',
        input: {
          source: { kind: 'text', text: ctx.message },
          schema: {
            leadScore: { type: 'number' },
            rationale: { type: 'string' },
          },
        },
        requiresApproval: false,
      };
    }
    if (lowered.startsWith('draft') || lowered.startsWith('email')) {
      return {
        skillKey: 'draft-email',
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
