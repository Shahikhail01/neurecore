import {
  DeterministicIntentClassifier,
  IntentRuleRegistry,
} from './intent-router';
import { TypedParameterExtractor } from './parameter-extractor';
import { ClassifierService } from './classifier.service';
import { RoutingService } from './routing.service';

function makeRegistry(): IntentRuleRegistry {
  const registry = new IntentRuleRegistry();
  registry.registerBuiltInRules();
  return registry;
}

function makeServices() {
  const registry = makeRegistry();
  const classifier = new DeterministicIntentClassifier(registry);
  const extractor = {} as TypedParameterExtractor;
  const classifierService = new ClassifierService(
    classifier,
    extractor,
    registry,
  );

  const recorded: Array<{
    tenantId: string;
    actorId: string;
    payload: Record<string, unknown>;
  }> = [];
  const store = {
    record: jest.fn(
      async (
        tenantId: string,
        actorId: string,
        payload: Record<string, unknown>,
      ) => {
        recorded.push({ tenantId, actorId, payload });
        return { id: 'fake-row-id', tenantId, actorId, ...payload };
      },
    ),
    listRecent: jest.fn(async () => []),
    countAmbiguousSince: jest.fn(async () => 0),
  } as unknown as ConstructorParameters<typeof RoutingService>[0];

  const routingService = new RoutingService(store, classifierService);

  return {
    registry,
    classifier,
    classifierService,
    routingService,
    store,
    recorded,
  };
}

describe('ClassifierService', () => {
  it('wraps the deterministic classifier and delegates classify / classifyAsync', async () => {
    const { registry, classifierService } = (() => {
      const r = new IntentRuleRegistry();
      r.registerBuiltInRules();
      const c = new DeterministicIntentClassifier(r);
      return {
        registry: r,
        classifierService: new ClassifierService(c, {} as never, r),
      };
    })();

    const sync = await classifierService.classify({
      message: 'show me the projects',
    });
    const asyncRes = await classifierService.classifyAsync({
      message: 'show me the projects',
    });
    expect(sync.intent).toBe('READ');
    expect(asyncRes).toEqual(sync);
    expect(classifierService.getRuleVersion()).toBe(registry.getVersion());
  });
});

describe('RoutingService', () => {
  it('persists every classified prompt with a SHA-256 rawMessageHash', async () => {
    const { routingService, recorded, registry } = makeServices();
    await routingService.recordAndClassify(
      'tenant-1',
      'user-1',
      'show me the projects',
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0].tenantId).toBe('tenant-1');
    expect(recorded[0].actorId).toBe('user-1');
    const payload = recorded[0].payload;
    expect(typeof payload['rawMessageHash']).toBe('string');
    expect(payload['rawMessageHash'] as string).toMatch(/^[a-f0-9]{64}$/);
    expect(payload['ruleVersion']).toBe(registry.getVersion());
  });

  it('captures the canonical capability derived from the built-in rule id', async () => {
    const { routingService, recorded } = makeServices();
    await routingService.recordAndClassify(
      'tenant-1',
      'user-1',
      'show me the projects',
    );
    expect(recorded[0].payload['canonicalCapability']).toBe('listProjects');
  });

  it('flags ambiguous=true when decision carries candidate capabilities', async () => {
    const { routingService, recorded } = makeServices();
    // Synthetic decision: candidates populated as the classifier emits on
    // its ambiguity branch when no built-in rule fires cleanly.
    const ambiguousDecision = {
      intent: 'UNSUPPORTED' as const,
      confidence: 0.5,
      ruleId: 'ambiguity',
      candidates: [
        { intent: 'READ' as const, entity: 'project', confidence: 0.6 },
        { intent: 'READ' as const, entity: 'goal', confidence: 0.6 },
      ],
    };

    await routingService.recordDecision({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      message: 'show everything',
      decision: ambiguousDecision,
      ruleVersion: '1.0.0',
    });
    expect(recorded[0].payload['ambiguous']).toBe(true);
  });

  it('is tolerant — never throws on persistence failure', async () => {
    const failing = {
      record: jest.fn(async () => {
        throw new Error('boom');
      }),
      listRecent: jest.fn(),
      countAmbiguousSince: jest.fn(),
    } as unknown as ConstructorParameters<typeof RoutingService>[0];

    const registry = makeRegistry();
    const classifier = new DeterministicIntentClassifier(registry);
    const svc = new RoutingService(
      failing,
      new ClassifierService(classifier, {} as never, registry),
    );

    await expect(
      svc.recordAndClassify('t1', 'u1', 'show me projects'),
    ).resolves.toBeDefined();
    expect(failing.record).toHaveBeenCalled();
  });

  it('persists hash derived from the raw user message — never stores the message itself', async () => {
    const { routingService, store } = makeServices();
    await routingService.recordAndClassify('tenant-1', 'user-1', 'secret text');

    const callArgs = (
      store as unknown as { record: jest.Mock }
    ).record.mock.calls[0];
    expect(callArgs[2]['rawMessageHash']).not.toContain('secret text');
  });
});
