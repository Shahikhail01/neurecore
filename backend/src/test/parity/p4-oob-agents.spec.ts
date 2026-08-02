/**
 * P4 — OOB agents registry unit tests.
 *
 * Validates that every CR-AI-050x agent exports a fully populated
 * OotbAgentDefinition with the required fields and the same stable ID
 * it is registered under in the parity baseline register.
 */

import {
  OOB_AGENTS,
  OOB_AGENT_INDEX,
  OOB_AGENT_IDS,
} from '../../modules/agent-templates/instances';

const REQUIRED_STABLE_IDS = [
  'CR-AI-0501',
  'CR-AI-0502',
  'CR-AI-0503',
  'CR-AI-0504',
  'CR-AI-0505',
  'CR-AI-0506',
];

describe('P4 — OOB agent registry', () => {
  it('contains every required CR-AI-050x agent', () => {
    const ids: readonly string[] = OOB_AGENT_IDS;
    const expected: readonly string[] = REQUIRED_STABLE_IDS;
    const setA = new Set<string>();
    for (const id of ids) setA.add(id);
    const setB = new Set<string>();
    for (const id of expected) setB.add(id);
    expect(setA.size).toBe(setB.size);
    for (const id of expected) expect(setA.has(id)).toBe(true);
  });

  it('exposes each agent by stableId', () => {
    for (const id of REQUIRED_STABLE_IDS) {
      const agent = OOB_AGENT_INDEX[id];
      expect(agent).toBeDefined();
      expect(agent.stableId).toBe(id);
    }
  });

  it('declares purpose / supported / unsupported intents', () => {
    for (const a of OOB_AGENTS) {
      expect(a.purpose.length).toBeGreaterThan(20);
      expect(a.supportedIntents.length).toBeGreaterThan(0);
      expect(a.unsupportedIntents.length).toBeGreaterThan(0);
      const supported: readonly string[] = a.supportedIntents;
      const unsupported: readonly string[] = a.unsupportedIntents;
      const overlap: string[] = [];
      for (const i of supported) {
        if (unsupported.indexOf(i) >= 0) overlap.push(i);
      }
      expect(overlap).toEqual([]);
    }
  });

  it('enforces a kill-switch flag and SLO', () => {
    for (const a of OOB_AGENTS) {
      expect(a.killSwitch.flagKey).toMatch(/^agent\.oob\./);
      expect(a.slo.availability).toBeGreaterThanOrEqual(0.95);
      expect(a.slo.p95LatencyMs).toBeGreaterThan(0);
    }
  });

  it('uses only authoritative tool ceilings', () => {
    const allowed: ReadonlyArray<string> = [
      'READ',
      'INTERNAL_WRITE',
      'EXTERNAL_WRITE',
    ];
    for (const a of OOB_AGENTS) {
      expect(allowed).toContain(a.toolCeiling);
    }
  });
});
