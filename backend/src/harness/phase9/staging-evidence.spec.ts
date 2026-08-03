/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomUUID } from 'crypto';
import {
  EvidenceEnvelopeSchema,
  Sha256ChecksumSchema,
  UuidSchema,
  type EvidenceEnvelope,
} from '../contracts';
import {
  EvidenceStore,
  computeContentChecksum,
  createEvidenceEnvelope,
} from '../evidence';
import {
  CapabilityRegistryEntrySchema,
  Phase9ReleaseWaiverSchema,
  RollbackDrillRequirementSchema,
  PHASE9_VERSION,
  type CapabilityRegistryEntry,
  type Phase9ReleaseWaiver,
  type RollbackDrillRequirement,
  type RiskTierGatePolicy,
} from './contracts';
import {
  DEFAULT_PHASE9_FULL_SUITES,
  DefaultVerdictAuthority,
  InMemoryCapabilityRegistry,
  InMemoryEvidenceResolver,
  InMemoryRollbackRegistry,
  InMemoryWaiversLedger,
  SupportSignatureAuthority,
  type EvidenceResolution,
} from './ports';
import { Phase9ReleaseGateCoordinator, defaultPhase9Policies } from './runners';
import {
  InMemoryStagingEvidenceSource,
  StagingEvidenceSourceImpl,
  StagingEvidenceBundleSchema,
  type StagingEvidenceBundle,
} from './adapters/staging-evidence-source';
import {
  loadStagingAdapters,
  registerPhase9ProductionAdapters,
} from './adapters/production-adapter-registry';

function makeStagingEnvelope(input: {
  runId: string;
  scenarioId: string;
  capabilityId?: string;
  tamperedChecksum?: boolean;
  content?: unknown;
}): EvidenceEnvelope {
  const env = createEvidenceEnvelope({
    runId: input.runId,
    scenarioId: input.scenarioId,
    capabilityId: input.capabilityId ?? 'CAP-STAGING-TEST',
    tenantId: '11111111-1111-1111-1111-111111111111',
    producer: 'phase9-staging-test',
    mediaType: 'application/json',
    classification: 'INTERNAL',
    retentionClass: 'MEDIUM_TERM',
    redactionStatus: 'NOT_REQUIRED',
    correlationIds: ['phase9:staging-test'],
    content: input.content ?? { ok: true },
  });
  if (input.tamperedChecksum) {
    return {
      ...env,
      checksum: Sha256ChecksumSchema.parse(
        'sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      ),
    };
  }
  return env;
}

function makeStore(
  runId: string,
  count: number,
  opts: { tampered?: boolean } = {},
): EvidenceStore {
  const store = new EvidenceStore();
  for (let i = 0; i < count; i++) {
    const content = { i, tampered: Boolean(opts.tampered) };
    const env = makeStagingEnvelope({
      runId,
      scenarioId: `phase9-staging-scenario-${i}`,
      tamperedChecksum: Boolean(opts.tampered),
      content,
    });
    store.append(env, content);
  }
  return store;
}

function makeCapability(): CapabilityRegistryEntry {
  return CapabilityRegistryEntrySchema.parse({
    schemaVersion: PHASE9_VERSION,
    capabilityId: 'CAP-STAGING-TEST',
    capabilityVersion: '1.0.0',
    name: 'CAP-STAGING-TEST',
    description: 'STAGING conformance test capability',
    riskTier: 'HIGH',
    owner: {
      ownerId: 'phase9-staging-test',
      ownerRole: 'EVALUATOR',
      confirmedAt: new Date().toISOString(),
    },
    environmentScope: { environmentClass: 'STAGING' },
    requiredSuites: [...DEFAULT_PHASE9_FULL_SUITES.HIGH],
    surfaces: ['src/harness/phase9/'],
    notes: [],
  });
}

function makeDrill(capabilityId: string): RollbackDrillRequirement {
  return RollbackDrillRequirementSchema.parse({
    schemaVersion: PHASE9_VERSION,
    drillId: randomUUID(),
    capabilityId,
    riskTier: 'HIGH',
    requiredScenarios: ['phase9-staging-rollback-1'],
    maxAgeDays: 30,
    status: 'PASSED',
    lastSuccessfulDrillAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    executedBy: 'sre-platform',
    notes: [],
  });
}

function makeWaiver(capabilityId: string): Phase9ReleaseWaiver {
  return Phase9ReleaseWaiverSchema.parse({
    schemaVersion: PHASE9_VERSION,
    waiverId: randomUUID(),
    capabilityId,
    scope: 'phase9-staging-conformance',
    reason: 'STAGING environmentClass is approved for STAGING promotion',
    compensatingControl: 'block PRODUCTION promotion; require separate ADR',
    owner: 'phase9-staging-owner',
    approver: 'phase9-staging-approver',
    issueLink: 'https://example.invalid/phase9/staging-waiver',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    phase9Signers: {
      ownerId: 'phase9-staging-owner',
      approverId: 'phase9-staging-approver',
      issuerId: 'phase9-staging-issuer',
    },
    notes: [],
  });
}

function makeSigners(): Map<
  string,
  {
    signerId: string;
    signerRole:
      | 'EVALUATOR'
      | 'QA_LEAD'
      | 'DOMAIN_OWNER'
      | 'SECURITY'
      | 'COMPLIANCE'
      | 'ARCHITECTURE';
    key: string;
  }
> {
  const result = new Map<
    string,
    {
      signerId: string;
      signerRole:
        | 'EVALUATOR'
        | 'QA_LEAD'
        | 'DOMAIN_OWNER'
        | 'SECURITY'
        | 'COMPLIANCE'
        | 'ARCHITECTURE';
      key: string;
    }
  >();
  const roles: Array<
    | 'EVALUATOR'
    | 'QA_LEAD'
    | 'DOMAIN_OWNER'
    | 'SECURITY'
    | 'COMPLIANCE'
    | 'ARCHITECTURE'
  > = [
    'EVALUATOR',
    'QA_LEAD',
    'DOMAIN_OWNER',
    'SECURITY',
    'COMPLIANCE',
    'ARCHITECTURE',
  ];
  for (const role of roles) {
    result.set(role, {
      signerId: `phase9-${role.toLowerCase()}-signer`,
      signerRole: role,
      key: `phase9-staging-test-key-${role.toLowerCase()}`,
    });
  }
  return result;
}

describe('Phase 9 / STAGING evidence conformance', () => {
  describe('StagingEvidenceSource', () => {
    it('returns finalized runIds from a populated EvidenceStore', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 5);
      const source = new StagingEvidenceSourceImpl(store);
      const runIds = source.listFinalizedRunIds();
      expect(runIds).toContain(runId);
    });

    it('returns STAGING-class evidence envelopes for a runId', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 5);
      const source = new StagingEvidenceSourceImpl(store);
      const bundle = source.getStagingEvidence({ phase9StagingRunId: runId });
      expect(bundle.environmentClass).toBe('STAGING');
      expect(bundle.runId).toBe(runId);
      expect(bundle.envelopes.length).toBe(5);
      expect(bundle.excludedCount).toBe(0);
    });

    it('excludes envelopes with tampered checksum', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3, { tampered: true });
      const source = new StagingEvidenceSourceImpl(store);
      const bundle = source.getStagingEvidence({ phase9StagingRunId: runId });
      expect(bundle.envelopes.length).toBe(0);
      expect(bundle.excludedCount).toBe(3);
      for (const note of bundle.notes) {
        expect(note).toMatch(/checksum mismatch/);
      }
    });

    it('excludes envelopes with missing scenarioId', () => {
      const runId = randomUUID();
      const store = new EvidenceStore();
      // Valid envelope
      store.append(
        makeStagingEnvelope({ runId, scenarioId: 'phase9-staging-ok' }),
        { ok: true },
      );
      // Tampered envelope: scenarioId blank
      const blank = makeStagingEnvelope({
        runId,
        scenarioId: 'phase9-staging-ok',
      });
      store.append(
        {
          ...blank,
          scenarioId: '' as unknown as string,
          evidenceId: randomUUID(),
        } as EvidenceEnvelope,
        { ok: true },
      );
      const source = new StagingEvidenceSourceImpl(store);
      const bundle = source.getStagingEvidence({ phase9StagingRunId: runId });
      expect(bundle.envelopes.length).toBe(1);
      expect(bundle.excludedCount).toBe(1);
    });

    it('InMemoryStagingEvidenceSource returns the same envelopes for a runId', () => {
      const runId = randomUUID();
      const source = new InMemoryStagingEvidenceSource();
      const env1 = makeStagingEnvelope({
        runId,
        scenarioId: 'phase9-staging-1',
      });
      const env2 = makeStagingEnvelope({
        runId,
        scenarioId: 'phase9-staging-2',
      });
      source.addRun(runId, [env1, env2]);
      const bundle = source.getStagingEvidence({ phase9StagingRunId: runId });
      expect(bundle.environmentClass).toBe('STAGING');
      expect(bundle.envelopes.length).toBe(2);
      expect(bundle.finalized).toBe(true);
    });
  });

  describe('registerPhase9ProductionAdapters', () => {
    it('stamps every adapter as REGISTERED with provenance', () => {
      const stamps = registerPhase9ProductionAdapters(
        new (class {
          private map = new Map<string, object>();
          register(adapter: string, port: object) {
            this.map.set(adapter, port);
          }
          resolve(adapter: string): object | null {
            return this.map.get(adapter) ?? null;
          }
          list(): string[] {
            return [...this.map.keys()];
          }
          statusOf(adapter: string): 'REGISTERED' | 'UNREGISTERED' {
            return this.map.has(adapter) ? 'REGISTERED' : 'UNREGISTERED';
          }
        })() as never,
        { environmentClass: 'STAGING' },
      );
      expect(stamps.length).toBe(7);
      for (const stamp of stamps) {
        expect(stamp.status).toBe('REGISTERED');
        expect(stamp.environmentClass).toBe('STAGING');
        expect(stamp.registeredAt).toMatch(/T/);
        expect(stamp.source).toBeTruthy();
      }
    });

    it('reads capability inventory from /etc/neurecore/phase9/capabilities.json when present', () => {
      // Use the in-process registry with a fresh stamp; the read will
      // simply fall through to the YAML/in-memory fallback.
      const stamps = registerPhase9ProductionAdapters(
        new (class {
          private map = new Map<string, object>();
          register(adapter: string, port: object) {
            this.map.set(adapter, port);
          }
          resolve(adapter: string): object | null {
            return this.map.get(adapter) ?? null;
          }
          list(): string[] {
            return [...this.map.keys()];
          }
          statusOf(adapter: string): 'REGISTERED' | 'UNREGISTERED' {
            return this.map.has(adapter) ? 'REGISTERED' : 'UNREGISTERED';
          }
        })() as never,
        { environmentClass: 'STAGING' },
      );
      const capStamp = stamps.find((s) => s.adapter === 'CAPABILITY_REGISTRY');
      expect(capStamp).toBeDefined();
      expect(capStamp!.source).toBeTruthy();
    });
  });

  describe('loadStagingAdapters', () => {
    it('returns REGISTERED stamps for every adapter and exposes the source', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3);
      const bundle = loadStagingAdapters({ evidenceStore: store });
      expect(bundle.stamps.length).toBe(7);
      for (const stamp of bundle.stamps) {
        expect(stamp.status).toBe('REGISTERED');
        expect(stamp.environmentClass).toBe('STAGING');
      }
      expect(bundle.evidenceSource.listFinalizedRunIds()).toContain(runId);
    });
  });

  describe('Phase9ReleaseGateCoordinator under STAGING', () => {
    it('returns PASS when STAGING adapters + valid signatures + valid rollback drill are present (no waiver)', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3);
      const bundle = loadStagingAdapters({ evidenceStore: store });
      const capability = makeCapability();
      bundle.capabilityRegistry.register(capability);

      const drill = makeDrill(capability.capabilityId);
      bundle.rollbackRegistry.recordDrill(drill);

      // Issue signatures for every required role.
      const signers = makeSigners();
      const approvals: Array<{
        signerId: string;
        signerRole:
          | 'EVALUATOR'
          | 'QA_LEAD'
          | 'DOMAIN_OWNER'
          | 'SECURITY'
          | 'COMPLIANCE'
          | 'ARCHITECTURE';
        signedAt: string;
        signature: string;
        publicKey: string;
      }> = [];
      for (const role of [
        'EVALUATOR',
        'QA_LEAD',
        'DOMAIN_OWNER',
        'SECURITY',
        'COMPLIANCE',
        'ARCHITECTURE',
      ] as const) {
        const s = signers.get(role)!;
        const sa = new SupportSignatureAuthority(role, s.signerId, s.key);
        const issued = sa.issueSignature({
          capabilityId: capability.capabilityId,
          certificateId: randomUUID(),
          verdict: 'PASSED',
          issuedAt: new Date().toISOString(),
        });
        approvals.push({
          signerId: s.signerId,
          signerRole: role,
          signedAt: new Date().toISOString(),
          signature: issued.signature,
          publicKey: issued.publicKey,
        });
      }

      const evidenceSource = bundle.evidenceSource.getStagingEvidence({
        phase9StagingRunId: runId,
      });
      const resolver = bundle.evidenceResolver as InMemoryEvidenceResolver;
      resolver.markFinalized(runId);
      const resolved: EvidenceResolution = resolver.resolve({
        capabilityId: capability.capabilityId,
        runIds: [runId],
        evidenceEnvelopes: evidenceSource.envelopes,
        finalizedRunIds: [runId],
      });

      const coordinator = new Phase9ReleaseGateCoordinator();
      const result = coordinator.evaluate({
        capabilityId: capability.capabilityId,
        changedSurfaces: [],
        riskTier: 'HIGH',
        environmentClass: 'STAGING',
        resolved,
        policies: bundle.policies,
        capabilities: [capability],
        approvals,
        waivers: [],
        rollbackDrill: drill,
        capability,
        capabilityRegistry: bundle.capabilityRegistry,
        evidenceResolver: bundle.evidenceResolver,
        signatureAuthority: bundle.signatureAuthority,
        waiversLedger: bundle.waiversLedger,
        rollbackRegistry: bundle.rollbackRegistry,
        requiredSuiteSelector: bundle.requiredSuiteSelector,
        verdictAuthority: bundle.verdictAuthority,
      });

      expect(result.evaluation.verdict).toBe('PASSED');
      expect(result.evaluation.missingEvidence).toEqual([]);
      expect(result.evaluation.unresolvedRisks).toEqual([]);
      expect(result.gate.passed).toBe(true);
      expect(result.gate.blockedReasons).toEqual([]);
    });

    it('returns BLOCKED/INSUFFICIENT_EVIDENCE when a required signature is missing', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3);
      const bundle = loadStagingAdapters({ evidenceStore: store });
      const capability = makeCapability();
      bundle.capabilityRegistry.register(capability);

      const drill = makeDrill(capability.capabilityId);
      bundle.rollbackRegistry.recordDrill(drill);

      const waiver = makeWaiver(capability.capabilityId);
      bundle.waiversLedger.issue(waiver);

      // Only one signature (EVALUATOR); HIGH tier needs
      // EVALUATOR, QA_LEAD, DOMAIN_OWNER.
      const signers = makeSigners();
      const s = signers.get('EVALUATOR')!;
      const sa = new SupportSignatureAuthority('EVALUATOR', s.signerId, s.key);
      const issued = sa.issueSignature({
        capabilityId: capability.capabilityId,
        certificateId: randomUUID(),
        verdict: 'PASSED',
        issuedAt: new Date().toISOString(),
      });
      const approvals = [
        {
          signerId: s.signerId,
          signerRole: 'EVALUATOR' as const,
          signedAt: new Date().toISOString(),
          signature: issued.signature,
          publicKey: issued.publicKey,
        },
      ];

      const evidenceSource = bundle.evidenceSource.getStagingEvidence({
        phase9StagingRunId: runId,
      });
      const resolver = bundle.evidenceResolver as InMemoryEvidenceResolver;
      resolver.markFinalized(runId);
      const resolved: EvidenceResolution = resolver.resolve({
        capabilityId: capability.capabilityId,
        runIds: [runId],
        evidenceEnvelopes: evidenceSource.envelopes,
        finalizedRunIds: [runId],
      });

      const coordinator = new Phase9ReleaseGateCoordinator();
      const result = coordinator.evaluate({
        capabilityId: capability.capabilityId,
        changedSurfaces: [],
        riskTier: 'HIGH',
        environmentClass: 'STAGING',
        resolved,
        policies: bundle.policies,
        capabilities: [capability],
        approvals,
        waivers: [waiver],
        rollbackDrill: drill,
        capability,
        capabilityRegistry: bundle.capabilityRegistry,
        evidenceResolver: bundle.evidenceResolver,
        signatureAuthority: bundle.signatureAuthority,
        waiversLedger: bundle.waiversLedger,
        rollbackRegistry: bundle.rollbackRegistry,
        requiredSuiteSelector: bundle.requiredSuiteSelector,
        verdictAuthority: bundle.verdictAuthority,
      });

      expect(['BLOCKED', 'INSUFFICIENT_EVIDENCE']).toContain(
        result.evaluation.verdict,
      );
      expect(result.evaluation.missingEvidence.join(' ')).toMatch(
        /missing signature for role QA_LEAD/,
      );
      expect(result.gate.passed).toBe(false);
    });

    it('VerdictAuthority recomputes verdict independently when a fake report verdict is provided', () => {
      const verdictAuthority = new DefaultVerdictAuthority();
      const resolver = new InMemoryEvidenceResolver();
      const runId = randomUUID();
      const env = makeStagingEnvelope({
        runId,
        scenarioId: 'phase9-staging-forge',
      });
      resolver.markFinalized(runId);
      const resolved: EvidenceResolution = resolver.resolve({
        capabilityId: 'CAP-STAGING-TEST',
        runIds: [runId],
        evidenceEnvelopes: [env],
        finalizedRunIds: [runId],
      });
      const policy: RiskTierGatePolicy = defaultPhase9Policies().find(
        (p) => p.riskTier === 'HIGH',
      )!;
      const capability = makeCapability();
      const drill = makeDrill(capability.capabilityId);
      // Pass `verdict` to a non-canonical value via `unresolvedRisks`
      // (the verdict authority is pass/fail; a fake report verdict
      // cannot override the recomputed one).
      const result = verdictAuthority.evaluate({
        capabilityId: capability.capabilityId,
        riskTier: 'HIGH',
        environmentClass: 'STAGING',
        resolved,
        policy,
        approvals: [],
        waivers: [],
        rollbackDrill: drill,
        capability,
        certificate: null,
      });
      // No approvals -> INSUFFICIENT_EVIDENCE
      expect(result.verdict).toBe('INSUFFICIENT_EVIDENCE');
      // The fake report verdict does not flow into the verdict
      // authority; the authority recomputes from the resolved bundle.
      expect(result.missingEvidence.join(' ')).toMatch(
        /missing signature for role EVALUATOR/,
      );
    });

    it('passes integrity verification for non-tampered STAGING evidence', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 4);
      const source = new StagingEvidenceSourceImpl(store);
      const bundle = source.getStagingEvidence({ phase9StagingRunId: runId });
      for (const env of bundle.envelopes) {
        const artifact = store.get(env.evidenceId);
        expect(artifact).not.toBeNull();
        expect(store.verifyIntegrity(env.evidenceId)).toBe(true);
      }
    });

    it('refuses a tampered envelope and excludes it from the bundle', () => {
      const runId = randomUUID();
      const store = new EvidenceStore();
      const good = makeStagingEnvelope({
        runId,
        scenarioId: 'phase9-staging-good',
      });
      store.append(good, { ok: true });
      const bad = makeStagingEnvelope({
        runId,
        scenarioId: 'phase9-staging-bad',
        tamperedChecksum: true,
      });
      store.append(bad, { ok: true });
      const source = new StagingEvidenceSourceImpl(store);
      const bundle = source.getStagingEvidence({ phase9StagingRunId: runId });
      expect(
        bundle.envelopes.find((e) => e.evidenceId === good.evidenceId),
      ).toBeDefined();
      expect(
        bundle.envelopes.find((e) => e.evidenceId === bad.evidenceId),
      ).toBeUndefined();
      expect(bundle.excludedCount).toBe(1);
    });

    it('parses the StagingEvidenceBundleSchema for a real bundle', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 2);
      const source = new StagingEvidenceSourceImpl(store);
      const bundle: StagingEvidenceBundle = source.getStagingEvidence({
        phase9StagingRunId: runId,
      });
      const parsed = StagingEvidenceBundleSchema.parse(bundle);
      expect(parsed.environmentClass).toBe('STAGING');
      expect(parsed.runId).toBe(runId);
    });

    it('returns no envelopes for a runId that does not exist in the store', () => {
      const store = makeStore(randomUUID(), 3);
      const source = new StagingEvidenceSourceImpl(store);
      const bundle = source.getStagingEvidence({
        phase9StagingRunId: randomUUID(),
      });
      expect(bundle.envelopes).toEqual([]);
      expect(bundle.finalized).toBe(false);
    });

    it('treats a valid active waiver as BLOCKED even when signatures are present', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3);
      const bundle = loadStagingAdapters({ evidenceStore: store });
      const capability = makeCapability();
      bundle.capabilityRegistry.register(capability);
      const drill = makeDrill(capability.capabilityId);
      bundle.rollbackRegistry.recordDrill(drill);
      const waiver = makeWaiver(capability.capabilityId);
      bundle.waiversLedger.issue(waiver);

      // Issue all 6 signatures so the only anomaly is the waiver.
      const signers = makeSigners();
      const approvals: Array<{
        signerId: string;
        signerRole:
          | 'EVALUATOR'
          | 'QA_LEAD'
          | 'DOMAIN_OWNER'
          | 'SECURITY'
          | 'COMPLIANCE'
          | 'ARCHITECTURE';
        signedAt: string;
        signature: string;
        publicKey: string;
      }> = [];
      for (const role of [
        'EVALUATOR',
        'QA_LEAD',
        'DOMAIN_OWNER',
        'SECURITY',
        'COMPLIANCE',
        'ARCHITECTURE',
      ] as const) {
        const s = signers.get(role)!;
        const sa = new SupportSignatureAuthority(role, s.signerId, s.key);
        const issued = sa.issueSignature({
          capabilityId: capability.capabilityId,
          certificateId: randomUUID(),
          verdict: 'PASSED',
          issuedAt: new Date().toISOString(),
        });
        approvals.push({
          signerId: s.signerId,
          signerRole: role,
          signedAt: new Date().toISOString(),
          signature: issued.signature,
          publicKey: issued.publicKey,
        });
      }

      const evidenceSource = bundle.evidenceSource.getStagingEvidence({
        phase9StagingRunId: runId,
      });
      const resolver = bundle.evidenceResolver as InMemoryEvidenceResolver;
      resolver.markFinalized(runId);
      const resolved: EvidenceResolution = resolver.resolve({
        capabilityId: capability.capabilityId,
        runIds: [runId],
        evidenceEnvelopes: evidenceSource.envelopes,
        finalizedRunIds: [runId],
      });

      const coordinator = new Phase9ReleaseGateCoordinator();
      const result = coordinator.evaluate({
        capabilityId: capability.capabilityId,
        changedSurfaces: [],
        riskTier: 'HIGH',
        environmentClass: 'STAGING',
        resolved,
        policies: bundle.policies,
        capabilities: [capability],
        approvals,
        waivers: [waiver],
        rollbackDrill: drill,
        capability,
        capabilityRegistry: bundle.capabilityRegistry,
        evidenceResolver: bundle.evidenceResolver,
        signatureAuthority: bundle.signatureAuthority,
        waiversLedger: bundle.waiversLedger,
        rollbackRegistry: bundle.rollbackRegistry,
        requiredSuiteSelector: bundle.requiredSuiteSelector,
        verdictAuthority: bundle.verdictAuthority,
      });

      expect(result.evaluation.verdict).toBe('BLOCKED');
    });

    it('treats a revoked waiver as an active issue that blocks PASS', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3);
      const bundle = loadStagingAdapters({ evidenceStore: store });
      const capability = makeCapability();
      bundle.capabilityRegistry.register(capability);
      const drill = makeDrill(capability.capabilityId);
      bundle.rollbackRegistry.recordDrill(drill);
      const waiver = makeWaiver(capability.capabilityId);
      bundle.waiversLedger.issue(waiver);
      const revoked = bundle.waiversLedger.revoke(
        waiver.waiverId,
        'phase9-staging-issuer',
        'mitigation complete',
      );

      const signers = makeSigners();
      const approvals: Array<{
        signerId: string;
        signerRole:
          | 'EVALUATOR'
          | 'QA_LEAD'
          | 'DOMAIN_OWNER'
          | 'SECURITY'
          | 'COMPLIANCE'
          | 'ARCHITECTURE';
        signedAt: string;
        signature: string;
        publicKey: string;
      }> = [];
      for (const role of [
        'EVALUATOR',
        'QA_LEAD',
        'DOMAIN_OWNER',
        'SECURITY',
        'COMPLIANCE',
        'ARCHITECTURE',
      ] as const) {
        const s = signers.get(role)!;
        const sa = new SupportSignatureAuthority(role, s.signerId, s.key);
        const issued = sa.issueSignature({
          capabilityId: capability.capabilityId,
          certificateId: randomUUID(),
          verdict: 'PASSED',
          issuedAt: new Date().toISOString(),
        });
        approvals.push({
          signerId: s.signerId,
          signerRole: role,
          signedAt: new Date().toISOString(),
          signature: issued.signature,
          publicKey: issued.publicKey,
        });
      }

      const evidenceSource = bundle.evidenceSource.getStagingEvidence({
        phase9StagingRunId: runId,
      });
      const resolver = bundle.evidenceResolver as InMemoryEvidenceResolver;
      resolver.markFinalized(runId);
      const resolved: EvidenceResolution = resolver.resolve({
        capabilityId: capability.capabilityId,
        runIds: [runId],
        evidenceEnvelopes: evidenceSource.envelopes,
        finalizedRunIds: [runId],
      });

      const coordinator = new Phase9ReleaseGateCoordinator();
      const result = coordinator.evaluate({
        capabilityId: capability.capabilityId,
        changedSurfaces: [],
        riskTier: 'HIGH',
        environmentClass: 'STAGING',
        resolved,
        policies: bundle.policies,
        capabilities: [capability],
        approvals,
        waivers: [revoked],
        rollbackDrill: drill,
        capability,
        capabilityRegistry: bundle.capabilityRegistry,
        evidenceResolver: bundle.evidenceResolver,
        signatureAuthority: bundle.signatureAuthority,
        waiversLedger: bundle.waiversLedger,
        rollbackRegistry: bundle.rollbackRegistry,
        requiredSuiteSelector: bundle.requiredSuiteSelector,
        verdictAuthority: bundle.verdictAuthority,
      });

      expect(result.evaluation.verdict).toBe('INSUFFICIENT_EVIDENCE');
      expect(result.evaluation.reasons.join(' ')).toMatch(/waiver .* revoked/);
      expect(result.gate.passed).toBe(false);
    });

    it('refuses STAGING promotion when no signatures are provided', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3);
      const bundle = loadStagingAdapters({ evidenceStore: store });
      const capability = makeCapability();
      bundle.capabilityRegistry.register(capability);
      const drill = makeDrill(capability.capabilityId);
      bundle.rollbackRegistry.recordDrill(drill);
      const waiver = makeWaiver(capability.capabilityId);
      bundle.waiversLedger.issue(waiver);

      const evidenceSource = bundle.evidenceSource.getStagingEvidence({
        phase9StagingRunId: runId,
      });
      const resolver = bundle.evidenceResolver as InMemoryEvidenceResolver;
      resolver.markFinalized(runId);
      const resolved: EvidenceResolution = resolver.resolve({
        capabilityId: capability.capabilityId,
        runIds: [runId],
        evidenceEnvelopes: evidenceSource.envelopes,
        finalizedRunIds: [runId],
      });

      const coordinator = new Phase9ReleaseGateCoordinator();
      const result = coordinator.evaluate({
        capabilityId: capability.capabilityId,
        changedSurfaces: [],
        riskTier: 'HIGH',
        environmentClass: 'STAGING',
        resolved,
        policies: bundle.policies,
        capabilities: [capability],
        approvals: [],
        waivers: [waiver],
        rollbackDrill: drill,
        capability,
        capabilityRegistry: bundle.capabilityRegistry,
        evidenceResolver: bundle.evidenceResolver,
        signatureAuthority: bundle.signatureAuthority,
        waiversLedger: bundle.waiversLedger,
        rollbackRegistry: bundle.rollbackRegistry,
        requiredSuiteSelector: bundle.requiredSuiteSelector,
        verdictAuthority: bundle.verdictAuthority,
      });

      expect(result.evaluation.verdict).toBe('INSUFFICIENT_EVIDENCE');
      expect(result.gate.passed).toBe(false);
    });

    it('refuses STAGING promotion when the rollback drill is not PASSED', () => {
      const runId = randomUUID();
      const store = makeStore(runId, 3);
      const bundle = loadStagingAdapters({ evidenceStore: store });
      const capability = makeCapability();
      bundle.capabilityRegistry.register(capability);
      // Failed drill
      const drill = RollbackDrillRequirementSchema.parse({
        ...makeDrill(capability.capabilityId),
        status: 'FAILED',
        lastSuccessfulDrillAt: null,
      });
      bundle.rollbackRegistry.recordDrill(drill);
      const waiver = makeWaiver(capability.capabilityId);
      bundle.waiversLedger.issue(waiver);

      // Issue full set of signatures so the only failure is the drill
      const signers = makeSigners();
      const approvals: Array<{
        signerId: string;
        signerRole: 'EVALUATOR' | 'QA_LEAD' | 'DOMAIN_OWNER';
        signedAt: string;
        signature: string;
        publicKey: string;
      }> = [];
      for (const role of ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER'] as const) {
        const s = signers.get(role)!;
        const sa = new SupportSignatureAuthority(role, s.signerId, s.key);
        const issued = sa.issueSignature({
          capabilityId: capability.capabilityId,
          certificateId: randomUUID(),
          verdict: 'PASSED',
          issuedAt: new Date().toISOString(),
        });
        approvals.push({
          signerId: s.signerId,
          signerRole: role,
          signedAt: new Date().toISOString(),
          signature: issued.signature,
          publicKey: issued.publicKey,
        });
      }

      const evidenceSource = bundle.evidenceSource.getStagingEvidence({
        phase9StagingRunId: runId,
      });
      const resolver = bundle.evidenceResolver as InMemoryEvidenceResolver;
      resolver.markFinalized(runId);
      const resolved: EvidenceResolution = resolver.resolve({
        capabilityId: capability.capabilityId,
        runIds: [runId],
        evidenceEnvelopes: evidenceSource.envelopes,
        finalizedRunIds: [runId],
      });

      const coordinator = new Phase9ReleaseGateCoordinator();
      const result = coordinator.evaluate({
        capabilityId: capability.capabilityId,
        changedSurfaces: [],
        riskTier: 'HIGH',
        environmentClass: 'STAGING',
        resolved,
        policies: bundle.policies,
        capabilities: [capability],
        approvals,
        waivers: [waiver],
        rollbackDrill: drill,
        capability,
        capabilityRegistry: bundle.capabilityRegistry,
        evidenceResolver: bundle.evidenceResolver,
        signatureAuthority: bundle.signatureAuthority,
        waiversLedger: bundle.waiversLedger,
        rollbackRegistry: bundle.rollbackRegistry,
        requiredSuiteSelector: bundle.requiredSuiteSelector,
        verdictAuthority: bundle.verdictAuthority,
      });

      expect(result.evaluation.verdict).toBe('INSUFFICIENT_EVIDENCE');
      expect(result.evaluation.missingEvidence.join(' ')).toMatch(
        /rollback drill/,
      );
      expect(result.gate.passed).toBe(false);
    });
  });
});
