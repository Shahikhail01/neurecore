import {
  RunOutcomeSchema,
  RiskTierSchema,
  CertificateVerdictSchema,
  ScenarioManifestSchema,
  RunProvenanceSchema,
  HarnessResultSchema,
  CertificateSchema,
  EvidenceEnvelopeSchema,
  validateTransition,
  RunStatusSchema,
  EnvironmentClassSchema,
  CertificationEnvironmentSchema,
  REQUIRED_SIGNATURES_BY_TIER,
} from './index';

describe('Harness Contracts Conformance (Section 6.3)', () => {
  describe('RunOutcome Schema', () => {
    const validOutcomes = [
      'PASSED',
      'FAILED',
      'BLOCKED',
      'CANCELLED',
      'INFRA_ERROR',
      'FLAKY',
      'SKIPPED',
      'UNKNOWN',
    ];

    it.each(validOutcomes)('accepts valid outcome: %s', (outcome) => {
      expect(RunOutcomeSchema.safeParse(outcome).success).toBe(true);
    });

    it('rejects invalid outcome', () => {
      expect(RunOutcomeSchema.safeParse('INVALID').success).toBe(false);
    });

    it('has EXACTLY 8 values (no extras like PASS/WIN/OK)', () => {
      expect(RunOutcomeSchema.options).toHaveLength(8);
    });
  });

  describe('RiskTier Schema', () => {
    it.each(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])('accepts %s', (tier) => {
      expect(RiskTierSchema.safeParse(tier).success).toBe(true);
    });

    it('rejects invalid tier', () => {
      expect(RiskTierSchema.safeParse('UNKNOWN').success).toBe(false);
    });
  });

  describe('EnvironmentClass (ScenarioManifest - Section 6.3)', () => {
    it.each(['LOCAL', 'CI', 'STAGING', 'PRODUCTION_PROBE'])('accepts %s', (env) => {
      expect(EnvironmentClassSchema.safeParse(env).success).toBe(true);
    });

    it('rejects PRODUCTION (not in Section 6.3 spec for ScenarioManifest)', () => {
      expect(EnvironmentClassSchema.safeParse('PRODUCTION').success).toBe(false);
    });

    it('has EXACTLY 4 values', () => {
      expect(EnvironmentClassSchema.options).toHaveLength(4);
    });
  });

  describe('CertificationEnvironment (separate scope enum)', () => {
    it('accepts PRODUCTION for certification scope', () => {
      expect(CertificationEnvironmentSchema.safeParse('PRODUCTION').success).toBe(true);
    });
  });

  describe('ScenarioManifest (Section 6.3 - exact fields)', () => {
    const validManifest = {
      schemaVersion: '1.0.0',
      scenarioId: 'test-scenario',
      scenarioVersion: '1.0.0',
      capabilityIds: ['CAP-001'],
      riskTier: 'HIGH',
      executionMode: 'DETERMINISTIC',
      environmentClass: 'CI',
      requiredFeatures: [],
      requiredDatasets: [],
      steps: [
        {
          stepId: 'step-1',
          name: 'Step One',
          adapter: 'jest-adapter',
        },
      ],
      assertions: [
        {
          assertionId: 'assert-1',
          name: 'Test assertion',
          type: 'DETERMINISTIC',
          expression: 'value === true',
        },
      ],
      cleanupPolicy: { cleanupPolicy: 'ON_SUCCESS' },
      evidencePolicy: {
        retentionClass: 'SHORT_TERM',
        classification: 'CONFIDENTIAL',
        redactionRequired: true,
      },
    };

    it('accepts valid manifest', () => {
      expect(ScenarioManifestSchema.safeParse(validManifest).success).toBe(true);
    });

    it('rejects invalid risk tier', () => {
      const result = ScenarioManifestSchema.safeParse({
        ...validManifest,
        riskTier: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('rejects PRODUCTION environmentClass', () => {
      const result = ScenarioManifestSchema.safeParse({
        ...validManifest,
        environmentClass: 'PRODUCTION',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields (strict mode)', () => {
      const result = ScenarioManifestSchema.safeParse({
        ...validManifest,
        injectedField: 'bad',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty capabilityIds', () => {
      const result = ScenarioManifestSchema.safeParse({
        ...validManifest,
        capabilityIds: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty steps', () => {
      const result = ScenarioManifestSchema.safeParse({
        ...validManifest,
        steps: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty assertions', () => {
      const result = ScenarioManifestSchema.safeParse({
        ...validManifest,
        assertions: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RunProvenance (Section 6.3)', () => {
    const validProvenance = {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      actorId: 'actor-1',
      codeSha: 'a'.repeat(40),
      buildId: 'build-1',
      environmentId: 'env-1',
      modelRefs: [],
      promptRefs: [],
      policyRefs: [],
      toolRefs: [],
      datasetRefs: [],
      startedAt: '2026-08-02T12:00:00Z',
    };

    it('accepts valid provenance', () => {
      expect(RunProvenanceSchema.safeParse(validProvenance).success).toBe(true);
    });

    it('accepts optional parentRunId', () => {
      const result = RunProvenanceSchema.safeParse({
        ...validProvenance,
        parentRunId: '550e8400-e29b-41d4-a716-446655440099',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional seed', () => {
      const result = RunProvenanceSchema.safeParse({
        ...validProvenance,
        seed: 'seed-abc',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID runId', () => {
      const result = RunProvenanceSchema.safeParse({
        ...validProvenance,
        runId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-ISO timestamp', () => {
      const result = RunProvenanceSchema.safeParse({
        ...validProvenance,
        startedAt: 'yesterday',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid codeSha (must be 40-64 hex)', () => {
      const result = RunProvenanceSchema.safeParse({
        ...validProvenance,
        codeSha: 'too-short',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields', () => {
      const result = RunProvenanceSchema.safeParse({
        ...validProvenance,
        extraField: 'bad',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('HarnessResult (Section 6.3)', () => {
    const validResult = {
      schemaVersion: '1.0.0',
      outcome: 'PASSED',
      assertionResults: [
        {
          assertionId: 'assert-1',
          name: 'Test assertion',
          passed: true,
        },
      ],
      metrics: [{ name: 'duration_ms', value: 100, unit: 'ms' }],
      evidenceRefs: [
        {
          evidenceId: '550e8400-e29b-41d4-a716-446655440000',
          mediaType: 'application/json',
          storageRef: 's3://bucket/ev.json',
          checksum: 'sha256:' + 'a'.repeat(64),
        },
      ],
      cleanupResult: {
        success: true,
        cleanedResources: [],
      },
      diagnostics: [],
    };

    it('accepts valid result', () => {
      expect(HarnessResultSchema.safeParse(validResult).success).toBe(true);
    });

    it('rejects invalid outcome', () => {
      const result = HarnessResultSchema.safeParse({
        ...validResult,
        outcome: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty evidenceRefs (must preserve evidence trail)', () => {
      const result = HarnessResultSchema.safeParse({
        ...validResult,
        evidenceRefs: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid checksum format', () => {
      const result = HarnessResultSchema.safeParse({
        ...validResult,
        evidenceRefs: [
          {
            evidenceId: '550e8400-e29b-41d4-a716-446655440000',
            mediaType: 'application/json',
            storageRef: 's3://bucket/ev.json',
            checksum: 'not-a-checksum',
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Certificate (ADR-004)', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 1000).toISOString();

    const validCertBase = {
      certificateId: '550e8400-e29b-41d4-a716-446655440000',
      schemaVersion: '1.0.0',
      capabilityId: 'CAP-001',
      capabilityVersion: '1.0.0',
      riskTier: 'LOW' as const,
      environmentScope: { environmentClass: 'CI' as const },
      testSuiteIds: ['TS-001'],
      runIds: ['550e8400-e29b-41d4-a716-446655440001'],
      evidenceRefs: [
        {
          evidenceId: '550e8400-e29b-41d4-a716-446655440002',
          mediaType: 'application/json',
          storageRef: 's3://bucket/ev.json',
          checksum: 'sha256:' + 'a'.repeat(64),
        },
      ],
      evaluator: {
        evaluatorId: 'eval-001',
        evaluatorVersion: '1.0.0',
        evaluatorType: 'AUTOMATED' as const,
      },
      evaluationDate: pastDate,
      verdict: 'PASSED' as const,
      issuedAt: pastDate,
      expiresAt: futureDate,
      status: 'ACTIVE' as const,
      signatures: [],
      unresolvedRisks: [],
      caveats: [],
    };

    it('rejects PASSED with no signatures for any risk tier', () => {
      const result = CertificateSchema.safeParse(validCertBase);
      expect(result.success).toBe(false);
    });

    it('accepts PASSED with required EVALUATOR signature for LOW tier', () => {
      const result = CertificateSchema.safeParse({
        ...validCertBase,
        signatures: [
          {
            signerId: 'eval-1',
            signerRole: 'EVALUATOR',
            signedAt: pastDate,
            signature: 'sig',
            publicKey: 'pk',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects CRITICAL PASSED without all required signatures', () => {
      const result = CertificateSchema.safeParse({
        ...validCertBase,
        riskTier: 'CRITICAL',
        signatures: [
          {
            signerId: 'eval-1',
            signerRole: 'EVALUATOR',
            signedAt: pastDate,
            signature: 'sig',
            publicKey: 'pk',
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('accepts CRITICAL PASSED with all 6 required signatures', () => {
      const requiredRoles = REQUIRED_SIGNATURES_BY_TIER.CRITICAL;
      const signatures = requiredRoles.map((role) => ({
        signerId: `${role.toLowerCase()}-1`,
        signerRole: role,
        signedAt: pastDate,
        signature: 'sig',
        publicKey: 'pk',
      }));
      const result = CertificateSchema.safeParse({
        ...validCertBase,
        riskTier: 'CRITICAL',
        signatures,
      });
      expect(result.success).toBe(true);
    });

    it('rejects expiresAt before issuedAt', () => {
      const result = CertificateSchema.safeParse({
        ...validCertBase,
        signatures: [
          {
            signerId: 'eval-1',
            signerRole: 'EVALUATOR',
            signedAt: pastDate,
            signature: 'sig',
            publicKey: 'pk',
          },
        ],
        issuedAt: futureDate,
        expiresAt: pastDate,
      });
      expect(result.success).toBe(false);
    });

    it('rejects ACTIVE status with expiresAt in the past', () => {
      const result = CertificateSchema.safeParse({
        ...validCertBase,
        signatures: [
          {
            signerId: 'eval-1',
            signerRole: 'EVALUATOR',
            signedAt: pastDate,
            signature: 'sig',
            publicKey: 'pk',
          },
        ],
        expiresAt: pastDate,
      });
      expect(result.success).toBe(false);
    });

    it('rejects PASSED verdict with unresolvedRisks', () => {
      const result = CertificateSchema.safeParse({
        ...validCertBase,
        signatures: [
          {
            signerId: 'eval-1',
            signerRole: 'EVALUATOR',
            signedAt: pastDate,
            signature: 'sig',
            publicKey: 'pk',
          },
        ],
        unresolvedRisks: ['Risk A'],
      });
      expect(result.success).toBe(false);
    });

    it('accepts FAILED verdict with empty signatures', () => {
      const result = CertificateSchema.safeParse({
        ...validCertBase,
        verdict: 'FAILED',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('EvidenceEnvelope (Section 7.1 - all fields required)', () => {
    const validEnvelope = {
      schemaVersion: '1.0.0',
      evidenceId: '550e8400-e29b-41d4-a716-446655440000',
      runId: '550e8400-e29b-41d4-a716-446655440001',
      scenarioId: 'sc-001',
      capabilityId: 'CAP-001',
      tenantId: '550e8400-e29b-41d4-a716-446655440002',
      timestamp: '2026-08-02T12:00:00Z',
      producer: 'test-runner',
      mediaType: 'application/json',
      classification: 'CONFIDENTIAL',
      checksum: 'sha256:' + 'a'.repeat(64),
      storageRef: 's3://bucket/ev.json',
      retentionClass: 'SHORT_TERM',
      redactionStatus: 'APPLIED',
      correlationIds: ['corr-123'],
    };

    it('accepts valid envelope', () => {
      expect(EvidenceEnvelopeSchema.safeParse(validEnvelope).success).toBe(true);
    });

    it('rejects missing scenarioId (Section 7.1 requires it)', () => {
      const { scenarioId, ...rest } = validEnvelope;
      expect(EvidenceEnvelopeSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects missing capabilityId (Section 7.1 requires it)', () => {
      const { capabilityId, ...rest } = validEnvelope;
      expect(EvidenceEnvelopeSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects empty correlationIds', () => {
      const result = EvidenceEnvelopeSchema.safeParse({
        ...validEnvelope,
        correlationIds: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields', () => {
      const result = EvidenceEnvelopeSchema.safeParse({
        ...validEnvelope,
        injected: 'bad',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('State Machine Transitions (Section 6.3 - canonical)', () => {
    it('allows QUEUED -> PROVISIONING', () => {
      expect(validateTransition('QUEUED', 'PROVISIONING')).toBe(true);
    });

    it('allows QUEUED -> CLEANING_UP (cancel from queue)', () => {
      expect(validateTransition('QUEUED', 'CLEANING_UP')).toBe(true);
    });

    it('allows PROVISIONING -> RUNNING', () => {
      expect(validateTransition('PROVISIONING', 'RUNNING')).toBe(true);
    });

    it('allows PROVISIONING -> CLEANING_UP (cancel during provisioning)', () => {
      expect(validateTransition('PROVISIONING', 'CLEANING_UP')).toBe(true);
    });

    it('allows RUNNING -> EVALUATING', () => {
      expect(validateTransition('RUNNING', 'EVALUATING')).toBe(true);
    });

    it('allows RUNNING -> CLEANING_UP (failure/cancel/timeout)', () => {
      expect(validateTransition('RUNNING', 'CLEANING_UP')).toBe(true);
    });

    it('allows EVALUATING -> CLEANING_UP (cleanup required)', () => {
      expect(validateTransition('EVALUATING', 'CLEANING_UP')).toBe(true);
    });

    it('allows CLEANING_UP -> FINALIZED', () => {
      expect(validateTransition('CLEANING_UP', 'FINALIZED')).toBe(true);
    });

    it('REJECTS EVALUATING -> FINALIZED (cleanup is mandatory)', () => {
      expect(validateTransition('EVALUATING', 'FINALIZED')).toBe(false);
    });

    it('REJECTS CLEANING_UP -> RUNNING (no backward transition)', () => {
      expect(validateTransition('CLEANING_UP', 'RUNNING')).toBe(false);
    });

    it('REJECTS FINALIZED -> any state (terminal)', () => {
      expect(validateTransition('FINALIZED', 'QUEUED')).toBe(false);
      expect(validateTransition('FINALIZED', 'RUNNING')).toBe(false);
      expect(validateTransition('FINALIZED', 'EVALUATING')).toBe(false);
      expect(validateTransition('FINALIZED', 'CLEANING_UP')).toBe(false);
    });

    it('REJECTS QUEUED -> RUNNING (skip provisioning)', () => {
      expect(validateTransition('QUEUED', 'RUNNING')).toBe(false);
    });

    it('REJECTS EVALUATING -> RUNNING (no going backward)', () => {
      expect(validateTransition('EVALUATING', 'RUNNING')).toBe(false);
    });

    it('throws on unknown current state', () => {
      expect(() =>
        validateTransition('UNKNOWN_STATE' as never, 'PROVISIONING'),
      ).toThrow(/Unknown run state/);
    });
  });

  describe('RunStatus Schema', () => {
    it.each(['QUEUED', 'PROVISIONING', 'RUNNING', 'EVALUATING', 'CLEANING_UP', 'FINALIZED'])(
      'accepts %s',
      (status) => {
        expect(RunStatusSchema.safeParse(status).success).toBe(true);
      },
    );

    it('rejects invalid status', () => {
      expect(RunStatusSchema.safeParse('INVALID').success).toBe(false);
    });

    it('has EXACTLY 6 values', () => {
      expect(RunStatusSchema.options).toHaveLength(6);
    });
  });
});