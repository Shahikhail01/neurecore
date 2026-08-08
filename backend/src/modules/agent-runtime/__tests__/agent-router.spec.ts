/**
 * Phase 23 — AgentRouter unit spec.
 */

import { AgentRouter } from '../routing/agent-router';
import { AgentRegistry } from '../../agent-templates/agents.registry';
import type { AgentId } from '../../agent-templates/agents.registry';

describe('Phase 23 — AgentRouter', () => {
  const registry = new AgentRegistry();
  registry.registerAll();
  const router = new AgentRouter(registry);

  it('classify "summarize …" → CR-AI-0502', () => {
    expect(router.classify('summarize this thread')).toBe(
      'CR-AI-0502' as AgentId,
    );
  });

  it('classify "lead score …" → CR-AI-0503', () => {
    expect(router.classify('lead score this opportunity')).toBe(
      'CR-AI-0503' as AgentId,
    );
  });

  it('classify "campaign …" → CR-AI-0504', () => {
    expect(router.classify('campaign launch to enterprise')).toBe(
      'CR-AI-0504' as AgentId,
    );
  });

  it('classify "categorize case …" → CR-AI-0505', () => {
    expect(router.classify('categorize case 12345')).toBe(
      'CR-AI-0505' as AgentId,
    );
  });

  it('classify "find article …" → CR-AI-0506', () => {
    expect(router.classify('find article in KB')).toBe('CR-AI-0506' as AgentId);
  });

  it('classify unknown → defaults to CR-AI-0501', () => {
    expect(router.classify('hello world')).toBe('CR-AI-0501' as AgentId);
  });

  it('explicit agentId + unsupported intent → AgentClarificationRequiredError', () => {
    expect(() =>
      router.resolve('totally-unsupported-intent-xyz', 'CR-AI-0501' as AgentId),
    ).toThrow(/clarification/i);
  });
});
