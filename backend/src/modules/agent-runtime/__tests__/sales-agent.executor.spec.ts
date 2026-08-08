/**
 * Phase 23 — SalesAgentExecutor unit spec (mutating-write gating).
 */

import { SalesAgentExecutor } from '../executors/sales-agent.executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import type {
  ISkillStep,
  SkillStepResult,
} from '../interfaces/agent-step.interface';

function makeCtx(intent: string, message: string): AgentExecuteContext {
  return {
    tenantId: 't-1',
    actorUserId: 'u-1',
    actorRole: 'OWNER' as never,
    intent,
    message,
  };
}

function noopStep(): ISkillStep {
  return {
    async invoke(): Promise<SkillStepResult> {
      return {
        output: 'ok',
        confidence: 0.8,
        citationsCount: 0,
        durationMs: 1,
      };
    },
  };
}

describe('Phase 23 — SalesAgentExecutor', () => {
  it('draft-email is approval-gated', async () => {
    const exec = new SalesAgentExecutor(noopStep());
    const out = await exec.execute(
      makeCtx('sales.draft-email', 'draft an outreach email'),
    );
    expect(out.requiresApproval).toBe(true);
  });

  it('extract/score is NOT approval-gated', async () => {
    const exec = new SalesAgentExecutor(noopStep());
    const out = await exec.execute(
      makeCtx('sales.score-lead', 'score this lead'),
    );
    expect(out.requiresApproval).toBe(false);
  });

  it('reports its agentId as CR-AI-0503', () => {
    const exec = new SalesAgentExecutor(noopStep());
    expect(exec.agentId).toBe('CR-AI-0503');
  });
});
