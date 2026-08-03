/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  IsoDateTimeSchema,
  SemverSchema,
  Sha256ChecksumSchema,
  SignatureSchema,
  UuidSchema,
  type AuthorizationContext,
  type EvidenceEnvelope,
  type Signature,
} from '../contracts';
import {
  CapabilityRegistryEntrySchema,
  CertificateOfCapabilitySchema,
  ChangedSurfaceSchema,
  ChangedSurfaceSelectorOutputSchema,
  Phase9ReleaseWaiverSchema,
  ReleaseGateVerdictSchema,
  RequiredSuiteScheduleEntrySchema,
  ResolvedEvidenceBundleSchema,
  RiskTierGatePolicySchema,
  RollbackDrillRequirementSchema,
  RollbackDrillStatusSchema,
  VerdictEvaluationSchema,
  PHASE9_VERSION,
  type CapabilityRegistryEntry,
  type CertificateOfCapability,
  type ChangedSurface,
  type Phase9ReleaseWaiver,
  type ReleaseGateVerdict,
  type RequiredSuiteScheduleEntry,
  type ResolvedEvidenceBundle,
  type RiskTierGatePolicy,
  type RollbackDrillRequirement,
  type VerdictEvaluation,
} from './contracts';
import {
  DEFAULT_PHASE9_FULL_SUITES,
  DefaultRequiredSuiteSelector,
  DefaultVerdictAuthority,
  InMemoryCapabilityRegistry,
  InMemoryEvidenceResolver,
  InMemoryProductionAdapterRegistry,
  InMemoryRollbackRegistry,
  InMemoryWaiversLedger,
  SupportSignatureAuthority,
  computeEvaluatorChainHash,
  stampUnregisteredAdapters,
  type EvidenceResolution,
  type SignatureAuthority,
} from './ports';
import {
  Phase9ReleaseGateCoordinator,
  buildRequiredSuiteSchedule,
  buildReleaseGateVerdict,
  defaultPhase9Policies,
  findPolicy,
} from './runners';
import {
  Phase9LaneSelector,
  Phase9ReleaseGate,
  PHASE9_DEFAULT_LANES,
} from './ci-lane';
import {
  Phase9CapabilityCertificateSchema,
  buildPhase9IntegrityReport,
  buildPhase9Summary,
  writePhase9Report,
} from './report-writer';
import {
  detectTampering,
  evaluateReportRetention,
  restoreReport,
  roundTripPhase9Report,
  tamperedReport,
} from './report-migration';

const TENANT = '11111111-1111-1111-1111-111111111111';
const SIGNER_KEY = 'phase9-conformance-key-do-not-use-in-production';

function makeEnvelope(
  overrides: Partial<EvidenceEnvelope> = {},
): EvidenceEnvelope {
  return {
    schemaVersion: PHASE9_VERSION,
    evidenceId: randomUUID(),
    runId: randomUUID(),
    scenarioId: 'phase9-fixture',
    capabilityId: 'CAP-001',
    tenantId: TENANT,
    timestamp: new Date().toISOString(),
    producer: 'phase9-conformance',
    mediaType: 'application/json',
    classification: 'INTERNAL',
    checksum:
      'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    storageRef: 'phase9://fixture',
    retentionClass: 'MEDIUM_TERM',
    redactionStatus: 'NOT_REQUIRED',
    correlationIds: ['phase9:fixture'],
    ...overrides,
  } as EvidenceEnvelope;
}

function makeCapability(
  overrides: Partial<CapabilityRegistryEntry> = {},
): CapabilityRegistryEntry {
  return CapabilityRegistryEntrySchema.parse({
    schemaVersion: PHASE9_VERSION,
    capabilityId: 'CAP-001',
    capabilityVersion: '1.0.0',
    name: 'CAP-001',
    description: 'Phase 9 conformance fixture capability',
    riskTier: 'HIGH',
    owner: {
      ownerId: 'phase9-owner',
      ownerRole: 'DOMAIN_OWNER',
      confirmedAt: new Date().toISOString(),
    },
    environmentScope: { environmentClass: 'STAGING' },
    requiredSuites: [...DEFAULT_PHASE9_FULL_SUITES.HIGH],
    surfaces: ['src/harness/phase9/'],
    notes: [],
    ...overrides,
  });
}

function makeWaiver(
  overrides: Partial<Phase9ReleaseWaiver> = {},
): Phase9ReleaseWaiver {
  const issuedAt = overrides.issuedAt ?? new Date().toISOString();
  const expiresAt =
    overrides.expiresAt ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const base = {
    schemaVersion: PHASE9_VERSION,
    waiverId: randomUUID(),
    capabilityId: 'CAP-001',
    scope: 'coverage-pending',
    reason: 'Phase 9 test waiver',
    compensatingControl: 'block on missing signature',
    owner: 'phase9-owner',
    approver: 'phase9-approver',
    issueLink: 'https://example.invalid/phase9/waiver',
    issuedAt,
    expiresAt,
    phase9Signers: {
      ownerId: 'phase9-owner',
      approverId: 'phase9-approver',
      issuerId: 'phase9-runner',
    },
    ...overrides,
  };
  try {
    return Phase9ReleaseWaiverSchema.parse(base);
  } catch (err) {
    const reason =
      err instanceof Error && err.message.includes('expiresAt')
        ? 'expiresAt must be strictly after issuedAt'
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(`makeWaiver failed: ${reason}`);
  }
}

function makeDrill(
  overrides: Partial<RollbackDrillRequirement> = {},
): RollbackDrillRequirement {
  return RollbackDrillRequirementSchema.parse({
    schemaVersion: PHASE9_VERSION,
    drillId: randomUUID(),
    capabilityId: 'CAP-001',
    riskTier: 'HIGH',
    requiredScenarios: ['rollback-scenario'],
    maxAgeDays: 30,
    status: 'PASSED',
    lastSuccessfulDrillAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    executedBy: 'sre-platform',
    notes: [],
    ...overrides,
  });
}

function makeResolved(
  cap: CapabilityRegistryEntry,
  overrides: {
    finalizedRunIds?: string[];
    runIds?: string[];
    envelopes?: EvidenceEnvelope[];
    markExpired?: string[];
    markFailed?: string[];
  } = {},
): EvidenceResolution {
  const runIds = overrides.runIds ?? [randomUUID()];
  const envelopes = overrides.envelopes ?? [
    makeEnvelope({ capabilityId: cap.capabilityId, runId: runIds[0] }),
  ];
  const finalizedRunIds = overrides.finalizedRunIds ?? runIds;
  const resolver = new InMemoryEvidenceResolver();
  for (const id of finalizedRunIds) resolver.markFinalized(id);
  for (const id of overrides.markExpired ?? []) resolver.markExpired(id);
  for (const id of overrides.markFailed ?? []) resolver.markFailed(id);
  return resolver.resolve({
    capabilityId: cap.capabilityId,
    runIds,
    evidenceEnvelopes: envelopes,
    finalizedRunIds,
  });
}

function makeApprovals(
  capabilityId: string,
  riskTier: RiskTierGatePolicy['riskTier'],
) {
  const roles: string[] = [
    ...(
      {
        CRITICAL: [
          'EVALUATOR',
          'QA_LEAD',
          'DOMAIN_OWNER',
          'SECURITY',
          'COMPLIANCE',
          'ARCHITECTURE',
        ],
        HIGH: ['EVALUATOR', 'QA_LEAD', 'DOMAIN_OWNER'],
        MEDIUM: ['EVALUATOR', 'QA_LEAD'],
        LOW: ['EVALUATOR'],
      } as const
    )[riskTier],
  ];
  return roles.map((role) => {
    const signerId = `signer-${role.toLowerCase()}`;
    const signer = new SupportSignatureAuthority(role, signerId, SIGNER_KEY);
    const packet = {
      capabilityId,
      certificateId: randomUUID(),
      verdict: 'PASSED',
      issuedAt: new Date().toISOString(),
    };
    const sig = signer.issueSignature(packet);
    return {
      signerId,
      signerRole: role as Signature['signerRole'],
      signedAt: packet.issuedAt,
      signature: sig.signature,
      publicKey: sig.publicKey,
    };
  });
}

describe('Phase 9 / Conformance / Schemas', () => {
  it('every Phase 9 schema parses a minimal valid input', () => {
    expect(
      CapabilityRegistryEntrySchema.safeParse(makeCapability()).success,
    ).toBe(true);
    expect(
      RiskTierGatePolicySchema.safeParse({
        schemaVersion: PHASE9_VERSION,
        riskTier: 'HIGH',
        fullSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.HIGH],
        requiredSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.HIGH],
      }).success,
    ).toBe(true);
    expect(
      ChangedSurfaceSchema.safeParse({
        changeId: randomUUID(),
        path: 'src/harness/phase9/contracts.ts',
        kind: 'SOURCE',
        riskTier: 'HIGH',
      }).success,
    ).toBe(true);
    expect(RollbackDrillRequirementSchema.safeParse(makeDrill()).success).toBe(
      true,
    );
    expect(Phase9ReleaseWaiverSchema.safeParse(makeWaiver()).success).toBe(
      true,
    );
  });

  it('Phase9ReleaseWaiver refuses same owner + approver', () => {
    const result = Phase9ReleaseWaiverSchema.safeParse({
      schemaVersion: PHASE9_VERSION,
      waiverId: randomUUID(),
      capabilityId: 'CAP-001',
      scope: 'coverage-pending',
      reason: 'Phase 9 test waiver',
      compensatingControl: 'block on missing signature',
      owner: 'phase9-owner',
      approver: 'phase9-approver',
      issueLink: 'https://example.invalid/phase9/waiver',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      phase9Signers: {
        ownerId: 'same',
        approverId: 'same',
        issuerId: 'phase9-runner',
      },
    });
    expect(result.success).toBe(false);
  });

  it('Phase9ReleaseWaiver refuses same issuer + approver', () => {
    const result = Phase9ReleaseWaiverSchema.safeParse({
      schemaVersion: PHASE9_VERSION,
      waiverId: randomUUID(),
      capabilityId: 'CAP-001',
      scope: 'coverage-pending',
      reason: 'Phase 9 test waiver',
      compensatingControl: 'block on missing signature',
      owner: 'phase9-owner',
      approver: 'phase9-approver',
      issueLink: 'https://example.invalid/phase9/waiver',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      phase9Signers: {
        ownerId: 'phase9-owner',
        approverId: 'phase9-approver',
        issuerId: 'phase9-approver',
      },
    });
    expect(result.success).toBe(false);
  });

  it('Phase9ReleaseWaiver refuses expiresAt <= issuedAt', () => {
    const now = new Date().toISOString();
    const result = Phase9ReleaseWaiverSchema.safeParse({
      schemaVersion: PHASE9_VERSION,
      waiverId: randomUUID(),
      capabilityId: 'CAP-001',
      scope: 'coverage-pending',
      reason: 'Phase 9 test waiver',
      compensatingControl: 'block on missing signature',
      owner: 'phase9-owner',
      approver: 'phase9-approver',
      issueLink: 'https://example.invalid/phase9/waiver',
      issuedAt: now,
      expiresAt: now,
      phase9Signers: {
        ownerId: 'phase9-owner',
        approverId: 'phase9-approver',
        issuerId: 'phase9-runner',
      },
    });
    expect(result.success).toBe(false);
  });

  it('RollbackDrillRequirements reject empty requiredScenarios', () => {
    const result = RollbackDrillRequirementSchema.safeParse({
      schemaVersion: PHASE9_VERSION,
      drillId: randomUUID(),
      capabilityId: 'CAP-001',
      riskTier: 'HIGH',
      requiredScenarios: [],
      maxAgeDays: 30,
      status: 'PASSED',
      lastSuccessfulDrillAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
      executedBy: 'sre-platform',
      notes: [],
    });
    expect(result.success).toBe(false);
  });

  it('CertificateOfCapability rejects PASSED with unresolvedRisks', () => {
    const result = CertificateOfCapabilitySchema.safeParse({
      schemaVersion: PHASE9_VERSION,
      certificateId: randomUUID(),
      capabilityId: 'CAP-001',
      capabilityVersion: '1.0.0',
      riskTier: 'HIGH',
      environmentScope: { environmentClass: 'STAGING' },
      testSuiteIds: ['phase9.certification'],
      runIds: [randomUUID()],
      evidenceRefs: [
        {
          evidenceId: randomUUID(),
          mediaType: 'application/json',
          storageRef: 'phase9://x',
          checksum:
            'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        },
      ],
      evaluator: {
        evaluatorId: 'phase9-evaluator',
        evaluatorVersion: PHASE9_VERSION,
        evaluatorType: 'AUTOMATED',
      },
      evaluationDate: new Date().toISOString(),
      verdict: 'PASSED',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      signatures: [],
      requiredSignaturesByTier: {
        CRITICAL: [],
        HIGH: ['EVALUATOR'],
        MEDIUM: [],
        LOW: [],
      },
      unresolvedRisks: ['open-risk'],
      caveats: [],
      evaluatorChainHash:
        'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      rollbackDrillRef: {
        drillId: randomUUID(),
        lastSuccessfulDrillAt: new Date().toISOString(),
        status: 'PASSED',
      },
    });
    expect(result.success).toBe(false);
  });

  it('RiskTierGatePolicy default waiversAllowed is false', () => {
    const parsed = RiskTierGatePolicySchema.parse({
      schemaVersion: PHASE9_VERSION,
      riskTier: 'LOW',
      fullSuiteIds: ['suite'],
      requiredSuiteIds: ['suite'],
    });
    expect(parsed.waiversAllowed).toBe(false);
  });
});

describe('Phase 9 / Conformance / Capability Registry', () => {
  it('registers and resolves a capability entry', () => {
    const reg = new InMemoryCapabilityRegistry();
    const cap = makeCapability();
    reg.register(cap);
    expect(reg.get(cap.capabilityId)?.capabilityId).toBe(cap.capabilityId);
    expect(reg.list().length).toBe(1);
  });

  it('refuses duplicate registration', () => {
    const reg = new InMemoryCapabilityRegistry();
    reg.register(makeCapability());
    expect(() => reg.register(makeCapability())).toThrow();
  });

  it('returns null for unknown capability', () => {
    const reg = new InMemoryCapabilityRegistry();
    expect(reg.get('unknown')).toBeNull();
  });
});

describe('Phase 9 / Conformance / Evidence Resolver', () => {
  it('reports missing runIds as not finalized', () => {
    const cap = makeCapability();
    const resolver = new InMemoryEvidenceResolver();
    const runId = randomUUID();
    const envelope = makeEnvelope({ capabilityId: cap.capabilityId, runId });
    const out = resolver.resolve({
      capabilityId: cap.capabilityId,
      runIds: [runId],
      evidenceEnvelopes: [envelope],
      finalizedRunIds: [],
    });
    expect(out.missingRunIds).toContain(runId);
    expect(out.reasons.some((r) => r.includes('not finalized'))).toBe(true);
  });

  it('reports expired evidence', () => {
    const cap = makeCapability();
    const runId = randomUUID();
    const env = makeEnvelope({ capabilityId: cap.capabilityId, runId });
    const resolver = new InMemoryEvidenceResolver();
    resolver.markFinalized(runId);
    resolver.markExpired(env.evidenceId);
    const out = resolver.resolve({
      capabilityId: cap.capabilityId,
      runIds: [runId],
      evidenceEnvelopes: [env],
      finalizedRunIds: [runId],
    });
    expect(out.expiredEvidenceIds).toContain(env.evidenceId);
  });

  it('reports failed evidence', () => {
    const cap = makeCapability();
    const runId = randomUUID();
    const env = makeEnvelope({ capabilityId: cap.capabilityId, runId });
    const resolver = new InMemoryEvidenceResolver();
    resolver.markFinalized(runId);
    resolver.markFailed(env.evidenceId);
    const out = resolver.resolve({
      capabilityId: cap.capabilityId,
      runIds: [runId],
      evidenceEnvelopes: [env],
      finalizedRunIds: [runId],
    });
    expect(out.failedEvidenceIds).toContain(env.evidenceId);
  });

  it('summary returns OK reason when all finalized', () => {
    const cap = makeCapability();
    const runId = randomUUID();
    const env = makeEnvelope({ capabilityId: cap.capabilityId, runId });
    const resolver = new InMemoryEvidenceResolver();
    resolver.markFinalized(runId);
    const out = resolver.resolve({
      capabilityId: cap.capabilityId,
      runIds: [runId],
      evidenceEnvelopes: [env],
      finalizedRunIds: [runId],
    });
    expect(out.missingRunIds.length).toBe(0);
    expect(out.expiredEvidenceIds.length).toBe(0);
    expect(out.failedEvidenceIds.length).toBe(0);
  });
});

describe('Phase 9 / Conformance / Signature Authority', () => {
  it('issues and verifies signatures per signerRole', () => {
    const signer = new SupportSignatureAuthority(
      'EVALUATOR',
      'signer-1',
      SIGNER_KEY,
    );
    const packet = {
      capabilityId: 'CAP-001',
      certificateId: randomUUID(),
      verdict: 'PASSED',
      issuedAt: new Date().toISOString(),
    };
    const sig = signer.issueSignature(packet);
    expect(
      signer.verifySignature({
        payload: packet,
        signature: sig.signature,
        publicKey: sig.publicKey,
      }),
    ).toBe(true);
  });

  it('rejects mismatched keys', () => {
    const signer = new SupportSignatureAuthority(
      'EVALUATOR',
      'signer-1',
      SIGNER_KEY,
    );
    const packet = {
      capabilityId: 'CAP-001',
      certificateId: randomUUID(),
      verdict: 'PASSED',
      issuedAt: new Date().toISOString(),
    };
    const sig = signer.issueSignature(packet);
    const other = new SupportSignatureAuthority(
      'EVALUATOR',
      'signer-2',
      'other-key',
    );
    expect(
      other.verifySignature({
        payload: packet,
        signature: sig.signature,
        publicKey: sig.publicKey,
      }),
    ).toBe(false);
  });

  it('SupportSignatureAuthority for SECURITY and COMPLIANCE are independent', () => {
    const sec = new SupportSignatureAuthority('SECURITY', 'sec-1', SIGNER_KEY);
    const comp = new SupportSignatureAuthority(
      'COMPLIANCE',
      'comp-1',
      SIGNER_KEY,
    );
    const packet = {
      capabilityId: 'CAP-001',
      certificateId: randomUUID(),
      verdict: 'PASSED',
      issuedAt: new Date().toISOString(),
    };
    const sig = sec.issueSignature(packet);
    expect(
      sec.verifySignature({
        payload: packet,
        signature: sig.signature,
        publicKey: sig.publicKey,
      }),
    ).toBe(true);
    expect(
      comp.verifySignature({
        payload: packet,
        signature: sig.signature,
        publicKey: sig.publicKey,
      }),
    ).toBe(true);
  });
});

describe('Phase 9 / Conformance / Waivers Ledger', () => {
  it('issues a waiver if owner !== approver', () => {
    const ledger = new InMemoryWaiversLedger();
    const waiver = makeWaiver();
    ledger.issue(waiver);
    expect(ledger.status(waiver.waiverId)).toBe('ACTIVE');
  });

  it('revokes a waiver and the status is REVOKED', () => {
    const ledger = new InMemoryWaiversLedger();
    const waiver = makeWaiver();
    ledger.issue(waiver);
    ledger.revoke(waiver.waiverId, 'phase9-approver', 'coverage completed');
    expect(ledger.status(waiver.waiverId)).toBe('REVOKED');
  });

  it('reports ACTIVE before expiry and EXPIRED after', () => {
    const ledger = new InMemoryWaiversLedger();
    const waiver = makeWaiver({
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    ledger.issue(waiver);
    expect(ledger.status(waiver.waiverId, new Date(Date.now() + 120_000))).toBe(
      'EXPIRED',
    );
  });

  it('refuses re-issuing an existing waiver', () => {
    const ledger = new InMemoryWaiversLedger();
    const waiver = makeWaiver();
    ledger.issue(waiver);
    expect(() => ledger.issue(waiver)).toThrow();
  });

  it('refuses self-approval in the underlying schema', () => {
    const result = Phase9ReleaseWaiverSchema.safeParse({
      schemaVersion: PHASE9_VERSION,
      waiverId: randomUUID(),
      capabilityId: 'CAP-001',
      scope: 'coverage-pending',
      reason: 'Phase 9 test waiver',
      compensatingControl: 'block on missing signature',
      owner: 'phase9-approver',
      approver: 'phase9-approver',
      issueLink: 'https://example.invalid/phase9/waiver',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      phase9Signers: {
        ownerId: 'phase9-approver',
        approverId: 'phase9-approver',
        issuerId: 'phase9-runner',
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('Phase 9 / Conformance / Rollback Registry', () => {
  it('records and lastSuccessfulDrillAt returns ISO', () => {
    const reg = new InMemoryRollbackRegistry();
    const drill = makeDrill();
    reg.recordDrill(drill);
    expect(reg.get(drill.drillId)).not.toBeNull();
    expect(reg.lastSuccessfulDrillAt(drill.capabilityId)).toBe(
      drill.lastSuccessfulDrillAt,
    );
  });

  it('skips non-PASSED drills', () => {
    const reg = new InMemoryRollbackRegistry();
    reg.recordDrill(
      makeDrill({ status: 'FAILED', lastSuccessfulDrillAt: null }),
    );
    expect(reg.lastSuccessfulDrillAt('CAP-001')).toBeNull();
  });
});

describe('Phase 9 / Conformance / VerdictAuthority independence', () => {
  it('recomputes verdict from resolved evidence, ignoring any report-provided verdict', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const evaluator = new DefaultVerdictAuthority();
    const policy = findPolicy(defaultPhase9Policies(), 'HIGH');
    const approvals = makeApprovals(cap.capabilityId, 'HIGH');
    const drill = makeDrill();
    const out = evaluator.evaluate({
      capabilityId: cap.capabilityId,
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policy,
      approvals,
      waivers: [],
      rollbackDrill: drill,
      capability: cap,
    });
    expect(out.verdict).toBe('PASSED');
    const broken = evaluator.evaluate({
      capabilityId: cap.capabilityId,
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved: { ...resolved, missingRunIds: [randomUUID()] },
      policy,
      approvals,
      waivers: [],
      rollbackDrill: drill,
      capability: cap,
    });
    expect(broken.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('evaluatorChainHash changes when missingEvidence changes', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const policy = findPolicy(defaultPhase9Policies(), 'HIGH');
    const approvals = makeApprovals(cap.capabilityId, 'HIGH');
    const drill = makeDrill();
    const e1 = new DefaultVerdictAuthority().evaluate({
      capabilityId: cap.capabilityId,
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policy,
      approvals,
      waivers: [],
      rollbackDrill: drill,
      capability: cap,
    });
    const e2 = new DefaultVerdictAuthority().evaluate({
      capabilityId: cap.capabilityId,
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved: { ...resolved, missingRunIds: [randomUUID()] },
      policy,
      approvals,
      waivers: [],
      rollbackDrill: drill,
      capability: cap,
    });
    expect(e1.evaluatorChainHash).not.toBe(e2.evaluatorChainHash);
  });

  it('chain hash is deterministic for identical inputs', () => {
    const h1 = computeEvaluatorChainHash({
      capabilityId: 'CAP-001',
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      missingEvidence: ['m1'],
      unresolvedRisks: [],
      caveats: [],
      activeWaivers: [],
      rollbackDrillRef: 'drill-1',
    });
    const h2 = computeEvaluatorChainHash({
      capabilityId: 'CAP-001',
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      missingEvidence: ['m1'],
      unresolvedRisks: [],
      caveats: [],
      activeWaivers: [],
      rollbackDrillRef: 'drill-1',
    });
    expect(h1).toBe(h2);
  });
});

describe('Phase 9 / Conformance / Required suite selection', () => {
  it('selects full suites per riskTier', () => {
    const selector = new DefaultRequiredSuiteSelector(defaultPhase9Policies());
    const out = selector.select({
      capabilityId: 'CAP-001',
      changedSurfaces: [],
    });
    expect(out.requiredSuiteIds.length).toBe(
      DEFAULT_PHASE9_FULL_SUITES.LOW.length,
    );
    const criticalOut = selector.select({
      capabilityId: 'CAP-001',
      changedSurfaces: [
        ChangedSurfaceSchema.parse({
          changeId: randomUUID(),
          path: 'src/harness/phase9/runners.ts',
          kind: 'SOURCE',
          riskTier: 'CRITICAL',
        }),
      ],
    });
    expect(criticalOut.requiredSuiteIds.length).toBeGreaterThan(
      out.requiredSuiteIds.length,
    );
    expect(criticalOut.requiredSuiteIds).toContain('phase9.rollback-drill');
  });

  it('changed surfaces that mention isolation/security pull isolation lanes', () => {
    const selector = new DefaultRequiredSuiteSelector(defaultPhase9Policies());
    const out = selector.select({
      capabilityId: 'CAP-001',
      changedSurfaces: [
        ChangedSurfaceSchema.parse({
          changeId: randomUUID(),
          path: 'src/harness/phase8/isolation.ts',
          kind: 'SOURCE',
          riskTier: 'HIGH',
        }),
      ],
    });
    expect(out.requiredSuiteIds).toContain('phase9.tenant-isolation');
    expect(out.requiredSuiteIds).toContain('phase9.security');
  });

  it('prompt/dataset changes trigger evaluation suite', () => {
    const selector = new DefaultRequiredSuiteSelector(defaultPhase9Policies());
    const out = selector.select({
      capabilityId: 'CAP-001',
      changedSurfaces: [
        ChangedSurfaceSchema.parse({
          changeId: randomUUID(),
          path: 'prompts/foo.ts',
          kind: 'PROMPT',
          riskTier: 'HIGH',
        }),
      ],
    });
    expect(out.requiredSuiteIds).toContain('phase9.evaluation');
  });
});

describe('Phase 9 / Conformance / Lane Selector and gate', () => {
  it('PR_FAST goes blocking on affected surfaces', () => {
    const lane = new Phase9LaneSelector();
    const out = lane.select({
      prId: 'pr-1',
      capabilityId: 'CAP-001',
      riskTier: 'HIGH',
      surfaces: [
        ChangedSurfaceSchema.parse({
          changeId: randomUUID(),
          path: 'src/harness/phase9/contracts.ts',
          kind: 'SOURCE',
          riskTier: 'HIGH',
        }),
      ],
    });
    expect(out.requiredSuiteIds).toContain('phase9.certification');
  });

  it('Phase9ReleaseGate.evaluate blocks on insufficient evidence', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap, { finalizedRunIds: [] });
    const gate = new Phase9ReleaseGate();
    const out = gate.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    expect(out.passed).toBe(false);
    expect(
      out.blockedReasons.some((r) =>
        r.toLowerCase().includes('insufficient finalized'),
      ),
    ).toBe(true);
    expect(out.verdict).not.toBeNull();
    expect(out.verdict?.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('Phase9ReleaseGate.weeklySoak blocks on SIMULATED environmentClass', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const gate = new Phase9ReleaseGate();
    const out = gate.weeklySoak({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'SIMULATED',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    expect(out.passed).toBe(false);
    expect(out.blockedReasons.some((r) => r.includes('SIMULATED'))).toBe(true);
  });
});

describe('Phase 9 / Conformance / Coordinator fail-closed', () => {
  it('returns BLOCKED on missing signature per risk tier', () => {
    const cap = makeCapability({ riskTier: 'CRITICAL' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'CRITICAL',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: [], // missing all required signatures
      waivers: [],
      rollbackDrill: makeDrill({ riskTier: 'CRITICAL' }),
      capability: cap,
    });
    expect(out.evaluation.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(
      out.evaluation.missingEvidence.some((m) =>
        m.includes('missing signature'),
      ),
    ).toBe(true);
  });

  it('returns INSUFFICIENT_EVIDENCE on missing rollback drill for CRITICAL', () => {
    const cap = makeCapability({ riskTier: 'CRITICAL' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'CRITICAL',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'CRITICAL'),
      waivers: [],
      rollbackDrill: null,
      capability: cap,
    });
    expect(out.evaluation.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(
      out.evaluation.missingEvidence.some((m) =>
        m.includes('rollbackDrillRef'),
      ),
    ).toBe(true);
  });

  it('returns INSUFFICIENT_EVIDENCE on expired waiver', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const issuedAt = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const expired = makeWaiver({
      issuedAt,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [expired],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    expect(out.evaluation.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(out.evaluation.reasons.some((r) => r.includes('expired'))).toBe(
      true,
    );
  });

  it('returns INSUFFICIENT_EVIDENCE on revoked waiver', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const revoked = makeWaiver({
      revokedAt: new Date().toISOString(),
      revokedReason: 'canceled',
    });
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [revoked],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    expect(out.evaluation.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(out.evaluation.reasons.some((r) => r.includes('revoked'))).toBe(
      true,
    );
  });
});

describe('Phase 9 / Conformance / Report writer integrity', () => {
  it('writes a Phase 9 report and validates it against Phase9CapabilityCertificateSchema', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    const schedule = buildRequiredSuiteSchedule({
      capabilityId: cap.capabilityId,
      policy: findPolicy(defaultPhase9Policies(), 'HIGH'),
    });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase9-'));
    const result = writePhase9Report({
      bundle: resolved.bundle,
      schedule,
      selection: out.selection,
      evaluation: out.evaluation,
      gate: out.gate,
      certificate: null,
      outDir: tmp,
    });
    expect(fs.existsSync(result.jsonPath)).toBe(true);
    expect(fs.existsSync(result.summaryPath)).toBe(true);
    expect(fs.existsSync(result.certificatePath)).toBe(true);
    expect(fs.existsSync(result.checksumPath)).toBe(true);
    expect(fs.existsSync(result.integrityPath)).toBe(true);
    const parsed = Phase9CapabilityCertificateSchema.safeParse({
      schemaVersion: PHASE9_VERSION,
      certificate: null,
      verdict: out.evaluation,
      selection: out.selection,
      schedule,
      bundle: resolved.bundle,
      gate: out.gate,
      producedAt: new Date().toISOString(),
    });
    expect(parsed.success).toBe(true);
  });

  it('round-trip preserves bundled data', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    const schedule = buildRequiredSuiteSchedule({
      capabilityId: cap.capabilityId,
      policy: findPolicy(defaultPhase9Policies(), 'HIGH'),
    });
    const trip = roundTripPhase9Report({
      bundle: resolved.bundle,
      evaluation: out.evaluation,
      selection: out.selection,
      gate: out.gate,
      schedule,
      certificate: null,
    });
    expect(trip.checksumOk).toBe(true);
  });

  it('detectTampering flags mutated verdict', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    const tampered = tamperedReport({
      bundle: resolved.bundle,
      evaluation: out.evaluation,
      selection: out.selection,
      gate: out.gate,
      schedule: [],
      certificate: null,
      tamper: 'verdict',
    });
    const found = detectTampering({
      original: { bundle: resolved.bundle, evaluation: out.evaluation },
      candidate: { bundle: tampered.bundle, evaluation: tampered.evaluation },
    });
    expect(found.tampered).toBe(true);
  });

  it('evaluateReportRetention keeps within window and purges after', () => {
    const kept = evaluateReportRetention({
      capabilityId: 'CAP-001',
      retentionClass: 'MEDIUM_TERM',
      retentionUntilMs: Date.now() + 60_000,
      legalHold: false,
    });
    expect(kept.kept).toBe(true);
    expect(kept.purged).toBe(false);
    const purged = evaluateReportRetention({
      capabilityId: 'CAP-001',
      retentionClass: 'MEDIUM_TERM',
      retentionUntilMs: Date.now() - 60_000,
      legalHold: false,
    });
    expect(purged.purged).toBe(true);
  });

  it('restoreReport valid for a stored report', () => {
    const cap = makeCapability({ riskTier: 'HIGH' });
    const resolved = makeResolved(cap);
    const coordinator = new Phase9ReleaseGateCoordinator();
    const out = coordinator.evaluate({
      capabilityId: cap.capabilityId,
      changedSurfaces: [],
      riskTier: 'HIGH',
      environmentClass: 'STAGING',
      resolved,
      policies: defaultPhase9Policies(),
      capabilities: [cap],
      approvals: makeApprovals(cap.capabilityId, 'HIGH'),
      waivers: [],
      rollbackDrill: makeDrill(),
      capability: cap,
    });
    const restored = restoreReport({
      report: {
        schemaVersion: PHASE9_VERSION,
        bundle: resolved.bundle,
        evaluation: out.evaluation,
        selection: out.selection,
        gate: out.gate,
        schedule: [],
        certificate: null,
      },
      sourceChecksum: 'irrelevant',
      expectedSchemaVersion: PHASE9_VERSION,
    });
    expect(restored.restored).toBe(true);
    expect(restored.valid).toBe(true);
  });
});

describe('Phase 9 / Conformance / Production Adapter Registry', () => {
  it('stamps UNREGISTERED for every Phase 9 adapter by default', () => {
    const stamps = stampUnregisteredAdapters();
    expect(stamps.adapters.length).toBeGreaterThan(0);
    expect(stamps.adapters.every((a) => a.status === 'UNREGISTERED')).toBe(
      true,
    );
  });

  it('InMemoryProductionAdapterRegistry reports UNREGISTERED before registration', () => {
    const reg = new InMemoryProductionAdapterRegistry();
    expect(reg.statusOf('CAPABILITY_REGISTRY')).toBe('UNREGISTERED');
    reg.register('CAPABILITY_REGISTRY', { stub: true });
    expect(reg.statusOf('CAPABILITY_REGISTRY')).toBe('REGISTERED');
  });
});
