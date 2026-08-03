/**
 * Phase 3 — Quarantine Module Conformance
 *
 * Validates:
 *   - Quarantine requires owner/reason/expiry (§10 Phase 3)
 *   - Cannot create indefinite quarantine
 *   - Extensions respect max count + max days
 *   - Expired entries are swept
 *   - Quarantined scenarios suppress flaky outcomes (§11)
 *   - Untracked FLAKY/SKIPPED outcomes become POLICY_VIOLATION
 *     (never silently pass)
 *   - Promotion requires linked defect
 */

import {
  QuarantineEngine,
  InMemoryQuarantineStore,
  QuarantinePolicySchema,
  QuarantineOutcomeResolutionSchema,
  WaiverRecordSchema,
  type QuarantineOutcome,
  type RegisterQuarantineInput,
  type QuarantinePolicy,
} from './index';

function makeEngine(
  policy: QuarantinePolicy = QuarantinePolicySchema.parse({}),
) {
  const clock = { now: () => new Date('2026-08-02T00:00:00.000Z') };
  const store = new InMemoryQuarantineStore();
  const engine = new QuarantineEngine(store, clock, policy);
  return { engine, store, clock, policy };
}

function baseInput(
  overrides: Partial<RegisterQuarantineInput> = {},
): RegisterQuarantineInput {
  return {
    scenarioId: 'sim-04-s3',
    reason: 'FLAKY',
    description: 'Customer form occasionally fails to submit under load',
    ownerId: 'qa-owner',
    ownerRole: 'QA Automation',
    createdBy: 'test-runner',
    expiresAt: '2026-08-09T00:00:00.000Z', // 7 days
    ...overrides,
  };
}

describe('harness/quarantine — Register', () => {
  it('rejects an indefinite quarantine (no future expiry)', () => {
    const { engine } = makeEngine();
    expect(() =>
      engine.register({
        ...baseInput(),
        expiresAt: '2026-08-02T00:00:00.000Z', // past/now
      }),
    ).toThrow(/future/);
  });

  it('rejects a quarantine exceeding the maximum lifetime', () => {
    const policy = QuarantinePolicySchema.parse({ maxLifetimeDays: 7 });
    const { engine } = makeEngine(policy);
    expect(() =>
      engine.register({
        ...baseInput(),
        expiresAt: '2026-09-15T00:00:00.000Z', // ~44 days
      }),
    ).toThrow(/exceeds policy max/);
  });

  it('accepts a valid quarantine entry', () => {
    const { engine, store } = makeEngine();
    const record = engine.register(baseInput());
    expect(record.status).toBe('ACTIVE');
    expect(store.findActiveByScenario('sim-04-s3')).not.toBeNull();
  });
});

describe('harness/quarantine — Extend', () => {
  it('respects maxExtensions', () => {
    const policy = QuarantinePolicySchema.parse({
      maxExtensions: 2,
      maxExtensionDays: 30,
    });
    const { engine } = makeEngine(policy);
    const record = engine.register(baseInput());
    engine.extend(record.quarantineId, 5, 'qa-owner', 'still flaky on staging');
    engine.extend(record.quarantineId, 5, 'qa-owner', 'still flaky');
    expect(() =>
      engine.extend(record.quarantineId, 5, 'qa-owner', 'third extension'),
    ).toThrow(/max extensions/);
  });

  it('rejects zero or oversized extensions', () => {
    const policy = QuarantinePolicySchema.parse({ maxExtensionDays: 7 });
    const { engine } = makeEngine(policy);
    const record = engine.register(baseInput());
    expect(() =>
      engine.extend(record.quarantineId, 0, 'qa', 'no days'),
    ).toThrow();
    expect(() =>
      engine.extend(record.quarantineId, 30, 'qa', 'too many days'),
    ).toThrow();
  });

  it('rejects extension of a non-ACTIVE quarantine', () => {
    const { engine } = makeEngine();
    const record = engine.register(baseInput());
    engine.revoke(record.quarantineId, 'qa', 'rolled back');
    expect(() =>
      engine.extend(record.quarantineId, 1, 'qa', 'too late'),
    ).toThrow(/Cannot extend/);
  });
});

describe('harness/quarantine — Promote + Revoke', () => {
  it('promotion requires linked defect', () => {
    const { engine } = makeEngine();
    const record = engine.register(baseInput());
    expect(() => engine.promote(record.quarantineId, '', 'qa')).toThrow(
      /defect/,
    );
    const defectId = '11111111-1111-1111-1111-111111111111';
    const promoted = engine.promote(record.quarantineId, defectId, 'qa');
    expect(promoted.status).toBe('PROMOTED');
    expect(promoted.linkedDefectId).toBe(defectId);
  });

  it('revoke is final', () => {
    const { engine } = makeEngine();
    const record = engine.register(baseInput());
    const revoked = engine.revoke(record.quarantineId, 'qa', 'rolled back');
    expect(revoked.status).toBe('REVOKED');
    expect(revoked.revokedReason).toBe('rolled back');
  });
});

describe('harness/quarantine — Sweep', () => {
  it('moves ACTIVE records with expiresAt <= now to EXPIRED', () => {
    const { engine, store } = makeEngine();
    const a = engine.register(
      baseInput({ expiresAt: '2026-08-05T00:00:00.000Z' }),
    );
    const b = engine.register(
      baseInput({
        scenarioId: 'sim-04-s4',
        expiresAt: '2026-08-20T00:00:00.000Z',
      }),
    );
    const expired = engine.sweepExpired('2026-08-10T00:00:00.000Z');
    expect(expired).toHaveLength(1);
    expect(expired[0].quarantineId).toBe(a.quarantineId);
    expect(store.get(a.quarantineId)!.status).toBe('EXPIRED');
    expect(store.get(b.quarantineId)!.status).toBe('ACTIVE');
  });
});

describe('harness/quarantine — Outcome Resolution (§11)', () => {
  it('resolves PASSED/FAILED directly', () => {
    const { engine } = makeEngine();
    const pass = engine.resolveOutcome('sim-04-s2', 'PASSED');
    expect(pass.resolvedOutcome).toBe('PASS');
    const fail = engine.resolveOutcome('sim-04-s2', 'FAILED');
    expect(fail.resolvedOutcome).toBe('FAIL');
  });

  it('suppresses a flaky outcome when an active quarantine covers the scenario', () => {
    const { engine } = makeEngine();
    engine.register(baseInput({ reason: 'FLAKY' }));
    const resolution = engine.resolveOutcome('sim-04-s3', 'FLAKY');
    QuarantineOutcomeResolutionSchema.parse(resolution);
    expect(resolution.resolvedOutcome).toBe('QUARANTINED');
    expect(resolution.quarantineId).toBeDefined();
  });

  it('flags FLAKY without an active quarantine as POLICY_VIOLATION', () => {
    const { engine } = makeEngine();
    const outcomes: QuarantineOutcome[] = [
      'FLAKY',
      'INFRA_ERROR',
      'SKIPPED',
      'BLOCKED',
      'UNKNOWN',
    ];
    for (const outcome of outcomes) {
      const r = engine.resolveOutcome(`s-${outcome}`, outcome);
      expect(r.resolvedOutcome).toBe('POLICY_VIOLATION');
      expect(r.reasons[0]).toMatch(/never silently count as pass/);
    }
  });

  it('treats untracked FLAKY as FAIL when blockUntrackedFlakeOutcomes=false', () => {
    const policy = QuarantinePolicySchema.parse({
      blockUntrackedFlakeOutcomes: false,
    });
    const { engine } = makeEngine(policy);
    const r = engine.resolveOutcome('sim-04-s-untracked', 'FLAKY');
    expect(r.resolvedOutcome).toBe('FAIL');
  });
});

describe('harness/quarantine — Waivers', () => {
  it('separates owner from approver (separation of duties)', () => {
    expect(() =>
      WaiverRecordSchema.parse({
        waiverId: '00000000-0000-0000-0000-000000000001',
        capabilityId: 'cap-1',
        scope: 'authn bypass',
        reason: 'unsupported in staging',
        compensatingControl: 'manual verification by SRE on-call',
        owner: 'qa-owner',
        approver: 'qa-owner', // same
        issuedAt: '2026-08-02T00:00:00.000Z',
        expiresAt: '2026-08-09T00:00:00.000Z',
      }),
    ).toThrow(/separation of duties/);
  });
});
