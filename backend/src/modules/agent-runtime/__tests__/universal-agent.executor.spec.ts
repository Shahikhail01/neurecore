/**
 * Phase 23 — UniversalAgentExecutor unit spec.
 */

import { UniversalAgentExecutor } from '../executors/universal-agent.executor';
import type { AgentExecuteContext } from '../interfaces/agent-runtime.interface';
import type {
  ISkillStep,
  SkillStepResult,
} from '../interfaces/agent-step.interface';

function makeCtx(message: string): AgentExecuteContext {
  return {
    tenantId: 't-1',
    actorUserId: 'u-1',
    actorRole: 'OWNER' as never,
    intent: 'universal.route',
    message,
  };
}

function recorder(): {
  step: ISkillStep;
  calls: Array<{ key: string; input: unknown }>;
} {
  const calls: Array<{ key: string; input: unknown }> = [];
  const step: ISkillStep = {
    invoke: async (key: string, input: unknown): Promise<SkillStepResult> => {
      calls.push({ key, input });
      return {
        output: `out:${key}`,
        confidence: 0.85,
        citationsCount: 0,
        durationMs: 3,
      };
    },
  };
  return { calls, step };
}

describe('Phase 23 — UniversalAgentExecutor', () => {
  it('routes "summarize …" → summarize skill', async () => {
    const r = recorder();
    const exec = new UniversalAgentExecutor(r.step);
    const out = await exec.execute(makeCtx('summarize this thread'));
    expect(r.calls[0]?.key).toBe('summarize');
    expect(out.skillKey).toBe('summarize');
    expect(out.requiresApproval).toBe(false);
  });

  it('routes "rewrite …" → rewrite skill', async () => {
    const r = recorder();
    const exec = new UniversalAgentExecutor(r.step);
    await exec.execute(makeCtx('rewrite this email'));
    expect(r.calls[0]?.key).toBe('rewrite');
  });

  it('routes "extract …" → extract skill with valid schema', async () => {
    const r = recorder();
    const exec = new UniversalAgentExecutor(r.step);
    await exec.execute(makeCtx('extract the customer name'));
    expect(r.calls[0]?.key).toBe('extract');
    const input = r.calls[0]?.input as { schema: Record<string, unknown> };
    expect(Object.keys(input.schema).length).toBeGreaterThan(0);
  });

  it('routes "translate …" → translate skill', async () => {
    const r = recorder();
    const exec = new UniversalAgentExecutor(r.step);
    await exec.execute(makeCtx('translate to spanish'));
    expect(r.calls[0]?.key).toBe('translate');
  });

  it('falls back to summarize for unknown intent', async () => {
    const r = recorder();
    const exec = new UniversalAgentExecutor(r.step);
    await exec.execute(makeCtx('hello world'));
    expect(r.calls[0]?.key).toBe('summarize');
  });

  it('reports its agentId as CR-AI-0501', () => {
    const r = recorder();
    const exec = new UniversalAgentExecutor(r.step);
    expect(exec.agentId).toBe('CR-AI-0501');
  });
});
