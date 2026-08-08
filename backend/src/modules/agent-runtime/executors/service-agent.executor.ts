/**
 * Phase 23 — SERVICE agent executor (CR-AI-0505).
 *
 * Service / case operations: summarize a case, extract category +
 * resolution fields, draft a customer reply.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AgentId } from '../../agent-templates/agents.registry';
import { BaseAgentExecutor, SkillSelection } from './base-agent-executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import { SKILL_STEP, WRITE_STEP } from '../agent-runtime.tokens';
import type { ISkillStep, IWriteStep } from '../interfaces/agent-step.interface';

@Injectable()
export class ServiceAgentExecutor extends BaseAgentExecutor {
  readonly agentId: AgentId = 'CR-AI-0505' as AgentId;
  readonly supportedIntents: ReadonlyArray<string> = [
    'service.summarize-case',
    'service.categorize-case',
    'service.resolve-case',
    'service.draft-reply',
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
    if (lowered.startsWith('categorize') || lowered.startsWith('extract')) {
      return {
        skillKey: 'extract',
        input: {
          source: { kind: 'text', text: ctx.message },
          schema: { category: { type: 'string' } },
        },
        requiresApproval: false,
      };
    }
    if (lowered.startsWith('reply') || lowered.startsWith('draft')) {
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
