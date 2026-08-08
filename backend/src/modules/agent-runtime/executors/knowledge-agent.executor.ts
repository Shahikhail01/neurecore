/**
 * Phase 23 — KNOWLEDGE agent executor (CR-AI-0506).
 *
 * Knowledge operations: summarize a knowledge article, draft a new
 * article (mutating → approval), check knowledge health.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AgentId } from '../../agent-templates/agents.registry';
import { BaseAgentExecutor, SkillSelection } from './base-agent-executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import { SKILL_STEP, WRITE_STEP } from '../agent-runtime.tokens';
import type { ISkillStep, IWriteStep } from '../interfaces/agent-step.interface';

@Injectable()
export class KnowledgeAgentExecutor extends BaseAgentExecutor {
  readonly agentId: AgentId = 'CR-AI-0506' as AgentId;
  readonly supportedIntents: ReadonlyArray<string> = [
    'knowledge.summarize-article',
    'knowledge.find-article',
    'knowledge.draft-article',
    'knowledge.health',
  ];
  readonly skillKeys: ReadonlyArray<string> = [
    'summarize',
    'article-draft',
    'knowledge-health',
    'compare',
  ];

  constructor(
    @Inject(SKILL_STEP) skillStep: ISkillStep,
    @Optional() @Inject(WRITE_STEP) writeStep?: IWriteStep,
  ) {
    super(skillStep, writeStep);
  }

  protected selectSkill(ctx: AgentExecuteContext): SkillSelection {
    const lowered = (ctx.message ?? '').toLowerCase().trim();
    if (lowered.startsWith('draft') || lowered.startsWith('article')) {
      return {
        skillKey: 'article-draft',
        input: {
          sources: [{ kind: 'text', text: ctx.message }],
          title: ctx.message.slice(0, 80),
          intent: 'concept',
        },
        requiresApproval: true,
      };
    }
    if (lowered.startsWith('health')) {
      return {
        skillKey: 'knowledge-health',
        input: { sources: [{ kind: 'text', text: ctx.message }] },
        requiresApproval: false,
      };
    }
    return {
      skillKey: 'summarize',
      input: { source: { kind: 'text', text: ctx.message } },
      requiresApproval: false,
    };
  }
}
