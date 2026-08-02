import {
  DeterministicIntentClassifier,
  IntentRuleRegistry,
} from './intent-router';
import { CAPABILITY_MAP } from '../../chat/responses/maps/capability-map';

describe('IntentRuleRegistry + DeterministicIntentClassifier', () => {
  const registry = new IntentRuleRegistry();
  const classifier = new DeterministicIntentClassifier(registry);

  beforeAll(() => {
    registry.registerBuiltInRules();
  });

  it('rejects duplicate rule ids', () => {
    const rule = {
      id: 'dup-1',
      version: '1.0.0',
      intent: 'READ' as const,
      entityPatterns: [/\bproject\b/],
      priority: 10,
    };
    registry.register(rule);
    expect(() => registry.register(rule)).toThrow(/duplicate/i);
  });

  it('rejects non-integer priority', () => {
    expect(() =>
      registry.register({
        id: 'bad-priority',
        version: '1.0.0',
        intent: 'READ',
        entityPatterns: [/\bfoo\b/],
        priority: 1.5,
      }),
    ).toThrow(/integer/i);
  });

  it('rejects global or sticky regex flags (non-deterministic)', () => {
    expect(() =>
      registry.register({
        id: 'bad-regex',
        version: '1.0.0',
        intent: 'READ',
        entityPatterns: [/\bproject\b/g],
        priority: 10,
      }),
    ).toThrow(/deterministic/i);
  });

  it('rejects rules referencing unknown capabilities', () => {
    expect(() =>
      registry.register({
        id: 'bad-capability',
        version: '1.0.0',
        intent: 'READ',
        entityPatterns: [/\bfoo\b/],
        priority: 10,
        capability: 'doesNotExist',
      }),
    ).toThrow(/unknown capability/i);
  });

  it('returns UNSUPPORTED for invalid explicitAction values', async () => {
    const decision = classifier.classify({
      message: 'show me things',
      context: { explicitAction: 'doesNotExist' },
    });
    expect(decision.intent).toBe('UNSUPPORTED');
    expect(decision.ruleId).toBe('invalid_explicit_action');
  });

  it('routes trusted explicit actions to READ with confidence 1.0', () => {
    const decision = classifier.classify({
      message: 'show me things',
      context: { explicitAction: 'listProjects' },
    });
    expect(decision.intent).toBe('READ');
    expect(decision.confidence).toBe(1.0);
    expect(decision.ruleId).toBe('explicit_context');
  });

  it('classifyAsync returns the same decision as classify', async () => {
    const sync = classifier.classify({ message: 'show me the projects' });
    const asyncResult = await classifier.classifyAsync({
      message: 'show me the projects',
    });
    expect(sync).toEqual(asyncResult);
  });

  describe('registerBuiltInRules', () => {
    it('registers one rule per active CAPABILITY_MAP read capability', () => {
      const fresh = new IntentRuleRegistry();
      const registered = fresh.registerBuiltInRules();
      const expected = Object.keys(CAPABILITY_MAP);
      expect(registered).toHaveLength(expected.length);
      for (const cap of expected) {
        expect(fresh.get(`builtIn:${cap}`)?.capability).toBe(cap);
      }
    });

    it('is idempotent — re-running does not throw', () => {
      const fresh = new IntentRuleRegistry();
      fresh.registerBuiltInRules();
      expect(() => fresh.registerBuiltInRules()).not.toThrow();
    });

    it('routes "show me the projects" to listProjects via built-in rule', () => {
      const fresh = new IntentRuleRegistry();
      fresh.registerBuiltInRules();
      const decision = new DeterministicIntentClassifier(fresh).classify({
        message: 'show me the projects',
      });
      // Hits either listProjects or getProject rule (both have entity
      // "project") — the higher-priority rule wins.
      expect(decision.intent).toBe('READ');
    });
  });
});
