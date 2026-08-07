/**
 * AgentRegistry — unit tests.
 */

import {
  AgentNotRegisteredError,
  AgentRegistry,
  PHASE_13_OOB_AGENT_IDS,
  isOobAgentId,
} from './agents.registry';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.registerAll();
  });

  it('registers all 6 Phase 13 OOB agents at boot', () => {
    expect(registry.list()).toHaveLength(6);
    expect(PHASE_13_OOB_AGENT_IDS).toHaveLength(6);
  });

  it('list() exposes typed IAgentDefinition entries', () => {
    const all = registry.list();
    for (const a of all) {
      expect(typeof a.id).toBe('string');
      expect(typeof a.displayName).toBe('string');
      expect(typeof a.description).toBe('string');
      expect(typeof a.version).toBe('string');
      expect(typeof a.certifiedAt).toBe('string');
      expect(typeof a.maxConcurrency).toBe('number');
      expect(a.implemented).toBe(true);
      expect(typeof a.type).toBe('string');
      expect(Array.isArray(a.skillKeys)).toBe(true);
      expect(Array.isArray(a.channels)).toBe(true);
    }
  });

  it('get(id) returns the typed definition for a known id', () => {
    for (const id of PHASE_13_OOB_AGENT_IDS) {
      const a = registry.get(id);
      // `a.id` is the lowercase type; `a.stableId` is the canonical CR-AI code.
      expect(a.stableId).toMatch(/^CR-AI-050[1-6]$/);
      expect(a.implemented).toBe(true);
    }
  });

  it('get(id) throws AgentNotRegisteredError for an unknown id', () => {
    expect(() => registry.get('CR-AI-9999' as never)).toThrow(
      AgentNotRegisteredError,
    );
  });

  it('has(id) reflects registry presence', () => {
    expect(registry.has(PHASE_13_OOB_AGENT_IDS[0])).toBe(true);
    expect(registry.has('CR-AI-9999' as never)).toBe(false);
  });

  it('skillKeys exist as an array (may be empty for some OOB agents)', () => {
    for (const a of registry.list()) {
      expect(Array.isArray(a.skillKeys)).toBe(true);
    }
  });

  it('boot is idempotent — second registerAll() does not duplicate entries', () => {
    const first = registry.list().length;
    registry.registerAll();
    expect(registry.list().length).toBe(first);
  });

  it('isOobAgentId type guard', () => {
    expect(isOobAgentId('CR-AI-0501')).toBe(true);
    expect(isOobAgentId('not-an-agent')).toBe(false);
  });
});
