import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { type EvidenceEnvelope, type Sha256ChecksumSchema } from '../contracts';
import {
  type Phase9ReleaseWaiver,
  type RollbackDrillRequirement,
  type RiskTierGatePolicy,
  type CapabilityRegistryEntry,
  type ChangedSurfaceSelectorInput,
  type ChangedSurfaceSelectorOutput,
  type ResolvedEvidenceBundle,
  type CertificateOfCapability,
  VerdictEvaluationSchema,
  PHASE9_VERSION,
  type VerdictEvaluation,
  RiskTierGatePolicySchema,
  CapabilityRegistryEntrySchema,
  ChangedSurfaceSelectorInputSchema,
  ChangedSurfaceSelectorOutputSchema,
  ResolvedEvidenceBundleSchema,
  ReleaseGateVerdictSchema,
  type ReleaseGateVerdict,
  RollbackDrillRequirementSchema,
  Phase9ReleaseWaiverSchema,
  CertificateOfCapabilitySchema,
} from './contracts';

// ============================================================
// CAPABILITY REGISTRY PORT
// ============================================================

export interface CapabilityRegistry {
  get(capabilityId: string): CapabilityRegistryEntry | null;
  list(): CapabilityRegistryEntry[];
  register(entry: CapabilityRegistryEntry): void;
}

export class InMemoryCapabilityRegistry implements CapabilityRegistry {
  private readonly map = new Map<string, CapabilityRegistryEntry>();
  get(capabilityId: string): CapabilityRegistryEntry | null {
    return this.map.get(capabilityId) ?? null;
  }
  list(): CapabilityRegistryEntry[] {
    return [...this.map.values()];
  }
  register(entry: CapabilityRegistryEntry): void {
    const parsed = CapabilityRegistryEntrySchema.parse(entry);
    if (this.map.has(parsed.capabilityId)) {
      throw new Error(`Capability ${parsed.capabilityId} already registered`);
    }
    this.map.set(parsed.capabilityId, parsed);
  }
}

// ============================================================
// EVIDENCE RESOLVER PORT
// ============================================================

export interface EvidenceResolution {
  capabilityId: string;
  bundle: ResolvedEvidenceBundle;
  finalizedRunIds: string[];
  missingRunIds: string[];
  expiredEvidenceIds: string[];
  failedEvidenceIds: string[];
  reasons: string[];
}

export interface EvidenceResolver {
  resolve(input: {
    capabilityId: string;
    runIds: string[];
    evidenceEnvelopes: EvidenceEnvelope[];
    finalizedRunIds: string[];
    now?: Date;
  }): EvidenceResolution;
}

export const PHASE9_EVIDENCE_RESOLVER_VERSION = '1.0.0';

export class InMemoryEvidenceResolver implements EvidenceResolver {
  private readonly finalized = new Set<string>();
  private readonly revoked = new Set<string>();
  private readonly failed = new Set<string>();

  markFinalized(runId: string): void {
    this.finalized.add(runId);
  }
  markExpired(evidenceId: string): void {
    this.revoked.add(evidenceId);
  }
  markFailed(evidenceId: string): void {
    this.failed.add(evidenceId);
  }

  resolve(input: {
    capabilityId: string;
    runIds: string[];
    evidenceEnvelopes: EvidenceEnvelope[];
    finalizedRunIds: string[];
    now?: Date;
  }): EvidenceResolution {
    const now = input.now ?? new Date();
    const bundleInput = {
      schemaVersion: '1.0.0' as const,
      capabilityId: input.capabilityId,
      contractVersion: '1.0.0' as const,
      resolvedAt: now.toISOString(),
      runIds: input.runIds,
      evidenceEnvelopes: input.evidenceEnvelopes,
      finalizedRunIds: input.finalizedRunIds.filter((id) =>
        this.finalized.has(id),
      ),
      evidenceResolverHash: 'sha256:0'.repeat(8) as never,
      notes: [],
    };
    const reasons: string[] = [];
    const missingRunIds: string[] = [];
    for (const id of input.runIds) {
      if (!this.finalized.has(id)) {
        missingRunIds.push(id);
        reasons.push(`runId ${id} not finalized`);
      }
    }
    const expiredEvidenceIds: string[] = [];
    for (const env of input.evidenceEnvelopes) {
      if (this.revoked.has(env.evidenceId)) {
        expiredEvidenceIds.push(env.evidenceId);
        reasons.push(`evidence ${env.evidenceId} expired`);
      }
    }
    const failedEvidenceIds: string[] = [];
    for (const env of input.evidenceEnvelopes) {
      if (this.failed.has(env.evidenceId)) {
        failedEvidenceIds.push(env.evidenceId);
        reasons.push(`evidence ${env.evidenceId} failed verification`);
      }
    }
    const bundle = ResolvedEvidenceBundleSchema.parse({
      ...bundleInput,
      evidenceResolverHash:
        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    });
    return {
      capabilityId: input.capabilityId,
      bundle,
      finalizedRunIds: input.finalizedRunIds.filter((id) =>
        this.finalized.has(id),
      ),
      missingRunIds,
      expiredEvidenceIds,
      failedEvidenceIds,
      reasons,
    };
  }
}

// ============================================================
// SIGNATURE AUTHORITY PORT (HMAC-SHA256 keyed by signer)
// ============================================================

export const PHASE9_SIGNATURE_AUTHORITY_VERSION = '1.0.0';

export interface SignatureAuthority {
  readonly signerRole: string;
  readonly signerId: string;
  issueSignature(payload: {
    capabilityId: string;
    certificateId: string;
    verdict: string;
    issuedAt: string;
  }): { signature: string; publicKey: string };
  verifySignature(input: {
    payload: {
      capabilityId: string;
      certificateId: string;
      verdict: string;
      issuedAt: string;
    };
    signature: string;
    publicKey: string;
  }): boolean;
}

export class SupportSignatureAuthority implements SignatureAuthority {
  constructor(
    public readonly signerRole: string,
    public readonly signerId: string,
    private readonly key: string,
  ) {}
  private kmac(key: string, payload: string): string {
    return createHmac('sha256', key).update(payload).digest('hex');
  }
  issueSignature(payload: {
    capabilityId: string;
    certificateId: string;
    verdict: string;
    issuedAt: string;
  }): { signature: string; publicKey: string } {
    const text = `${payload.capabilityId}|${payload.certificateId}|${payload.verdict}|${payload.issuedAt}`;
    const sig = this.kmac(this.key, text);
    return {
      signature: `phase9:hmac-sha256:${sig}`,
      publicKey: this.key,
    };
  }
  verifySignature(input: {
    payload: {
      capabilityId: string;
      certificateId: string;
      verdict: string;
      issuedAt: string;
    };
    signature: string;
    publicKey: string;
  }): boolean {
    if (input.publicKey !== this.key) return false;
    const text = `${input.payload.capabilityId}|${input.payload.certificateId}|${input.payload.verdict}|${input.payload.issuedAt}`;
    const expected = this.kmac(this.key, text);
    const provided = input.signature.replace(/^phase9:hmac-sha256:/, '');
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex'),
    );
  }
}

// ============================================================
// WAIVERS LEDGER PORT
// ============================================================

export type WaiverStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface WaiversLedger {
  issue(waiver: Phase9ReleaseWaiver): Phase9ReleaseWaiver;
  revoke(waiverId: string, actor: string, reason: string): Phase9ReleaseWaiver;
  status(waiverId: string, now?: Date): WaiverStatus;
  list(): Phase9ReleaseWaiver[];
  get(waiverId: string): Phase9ReleaseWaiver | null;
}

export const PHASE9_WAIVERS_LEDGER_VERSION = '1.0.0';

export class InMemoryWaiversLedger implements WaiversLedger {
  private readonly map = new Map<string, Phase9ReleaseWaiver>();
  issue(waiver: Phase9ReleaseWaiver): Phase9ReleaseWaiver {
    const parsed = Phase9ReleaseWaiverSchema.parse(waiver);
    if (this.map.has(parsed.waiverId)) {
      throw new Error(`Waiver ${parsed.waiverId} already issued`);
    }
    this.map.set(parsed.waiverId, parsed);
    return parsed;
  }
  revoke(waiverId: string, actor: string, reason: string): Phase9ReleaseWaiver {
    const existing = this.map.get(waiverId);
    if (!existing) throw new Error(`Waiver ${waiverId} not found`);
    if (existing.revokedAt) {
      throw new Error(`Waiver ${waiverId} already revoked`);
    }
    const updated = Phase9ReleaseWaiverSchema.parse({
      ...existing,
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
      notes: [...existing.notes, `revoked by ${actor}: ${reason}`],
    });
    this.map.set(waiverId, updated);
    return updated;
  }
  status(waiverId: string, now: Date = new Date()): WaiverStatus {
    const w = this.map.get(waiverId);
    if (!w) throw new Error(`Waiver ${waiverId} not found`);
    if (w.revokedAt) return 'REVOKED';
    if (Date.parse(w.expiresAt) <= now.getTime()) return 'EXPIRED';
    return 'ACTIVE';
  }
  list(): Phase9ReleaseWaiver[] {
    return [...this.map.values()];
  }
  get(waiverId: string): Phase9ReleaseWaiver | null {
    return this.map.get(waiverId) ?? null;
  }
}

// ============================================================
// ROLLBACK REGISTRY PORT
// ============================================================

export interface RollbackRegistry {
  recordDrill(drill: RollbackDrillRequirement): RollbackDrillRequirement;
  get(drillId: string): RollbackDrillRequirement | null;
  lastSuccessfulDrillAt(capabilityId: string): string | null;
}

export class InMemoryRollbackRegistry implements RollbackRegistry {
  private readonly map = new Map<string, RollbackDrillRequirement>();
  recordDrill(drill: RollbackDrillRequirement): RollbackDrillRequirement {
    const parsed = RollbackDrillRequirementSchema.parse(drill);
    this.map.set(parsed.drillId, parsed);
    return parsed;
  }
  get(drillId: string): RollbackDrillRequirement | null {
    return this.map.get(drillId) ?? null;
  }
  lastSuccessfulDrillAt(capabilityId: string): string | null {
    let max: string | null = null;
    for (const drill of this.map.values()) {
      if (drill.capabilityId !== capabilityId) continue;
      if (drill.status !== 'PASSED') continue;
      if (!drill.lastSuccessfulDrillAt) continue;
      if (max === null || drill.lastSuccessfulDrillAt > max) {
        max = drill.lastSuccessfulDrillAt;
      }
    }
    return max;
  }
}

// ============================================================
// REQUIRED SUITE SELECTOR PORT
// ============================================================

export interface RequiredSuiteSelector {
  select(input: ChangedSurfaceSelectorInput): ChangedSurfaceSelectorOutput;
  policyFor(
    riskTier: z.infer<typeof RiskTierGatePolicySchema>['riskTier'],
  ): RiskTierGatePolicy;
}

export const PHASE9_REQUIRED_SUITE_SELECTOR_VERSION = '1.0.0';

export const DEFAULT_PHASE9_FULL_SUITES: Readonly<
  Record<
    z.infer<typeof RiskTierGatePolicySchema>['riskTier'],
    readonly string[]
  >
> = {
  CRITICAL: [
    'phase9.certification',
    'phase9.tenant-isolation',
    'phase9.security',
    'phase9.compliance',
    'phase9.hitl',
    'phase9.performance',
    'phase9.broswer-e2e',
    'phase9.simulation',
    'phase9.rollback-drill',
  ],
  HIGH: [
    'phase9.certification',
    'phase9.tenant-isolation',
    'phase9.security',
    'phase9.compliance',
    'phase9.performance',
    'phase9.rollback-drill',
  ],
  MEDIUM: [
    'phase9.certification',
    'phase9.tenant-isolation',
    'phase9.security',
    'phase9.compliance',
  ],
  LOW: ['phase9.certification', 'phase9.tenant-isolation'],
} as const;

export const CRITICAL_SURFACE_KINDS: ReadonlyArray<
  z.infer<typeof ChangedSurfaceSelectorOutputSchema>['requiredSuiteIds'][number]
> = ['CRITICAL', 'HIGH', 'AI', 'SECURITY', 'ISOLATION', 'ROLLBACK'];

export const DEFAULT_LANE_BLOCKING: Readonly<Record<string, boolean>> = {
  DEVELOPER: false,
  PR_FAST: true,
  PR_AI: true,
  MAINLINE: true,
  NIGHTLY: false,
  WEEKLY_SOAK: true,
  RELEASE: true,
};

export class DefaultRequiredSuiteSelector implements RequiredSuiteSelector {
  constructor(private readonly policies: ReadonlyArray<RiskTierGatePolicy>) {}
  policyFor(
    riskTier: z.infer<typeof RiskTierGatePolicySchema>['riskTier'],
  ): RiskTierGatePolicy {
    const found = this.policies.find((p) => p.riskTier === riskTier);
    if (!found) {
      throw new Error(`No policy registered for riskTier ${riskTier}`);
    }
    return found;
  }
  select(input: ChangedSurfaceSelectorInput): ChangedSurfaceSelectorOutput {
    const parsed = ChangedSurfaceSelectorInputSchema.parse(input);
    const reasons: string[] = [];
    const riskTier = parsed.changedSurfaces
      .map((s) => s.riskTier)
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .reduce<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null>((acc, r) => {
        if (acc === null) return r;
        const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
        return order.indexOf(r) < order.indexOf(acc) ? r : acc;
      }, null);
    const tier = riskTier ?? 'LOW';
    const policy = this.policyFor(tier);
    const requiredSuiteIds = new Set<string>(policy.requiredSuiteIds);
    const blockingLanes = new Set<string>(['MAINLINE']);
    const selectedLanes = new Set<string>(['DEVELOPER']);
    const criticalSurfaces: string[] = [];
    for (const s of parsed.changedSurfaces) {
      if (s.riskTier === 'CRITICAL' || s.riskTier === 'HIGH') {
        criticalSurfaces.push(s.path);
        selectedLanes.add('PR_FAST');
        blockingLanes.add('PR_FAST');
        selectedLanes.add('RELEASE');
        blockingLanes.add('RELEASE');
      }
      if (s.kind === 'PROMPT' || s.kind === 'DATASET') {
        selectedLanes.add('PR_AI');
        blockingLanes.add('PR_AI');
        requiredSuiteIds.add('phase9.evaluation');
      }
      if (s.kind === 'POLICY') {
        requiredSuiteIds.add('phase9.compliance');
      }
      if (s.kind === 'CAPABILITY_REGISTRY') {
        requiredSuiteIds.add('phase9.certification');
      }
      if (s.path.includes('isolation') || s.path.includes('security')) {
        requiredSuiteIds.add('phase9.tenant-isolation');
        requiredSuiteIds.add('phase9.security');
      }
      if (s.path.includes('rollback')) {
        requiredSuiteIds.add('phase9.rollback-drill');
      }
    }
    if (tier === 'CRITICAL' || tier === 'HIGH') {
      requiredSuiteIds.add('phase9.rollback-drill');
      selectedLanes.add('NIGHTLY');
      blockingLanes.add('NIGHTLY');
    }
    if (criticalSurfaces.length > 0) {
      reasons.push(
        `critical surfaces detected: ${criticalSurfaces.join(', ')}`,
      );
    }
    return ChangedSurfaceSelectorOutputSchema.parse({
      capabilityId: parsed.capabilityId,
      selectedLanes: [...selectedLanes],
      blockingLanes: [...blockingLanes],
      requiredSuiteIds: [...requiredSuiteIds],
      criticalSurfaces,
      reasons,
      evaluatedAt: new Date().toISOString(),
    });
  }
}

// ============================================================
// VERDICT AUTHORITY PORT (independent)
// ============================================================

export interface VerdictAuthority {
  evaluate(input: {
    capabilityId: string;
    riskTier: RiskTierGatePolicy['riskTier'];
    environmentClass: z.infer<
      typeof VerdictEvaluationSchema
    >['environmentClass'];
    resolved: EvidenceResolution;
    policy: RiskTierGatePolicy;
    approvals: Array<{
      signerId: string;
      signerRole: string;
      signedAt: string;
      signature: string;
      publicKey: string;
    }>;
    waivers: Phase9ReleaseWaiver[];
    rollbackDrill: RollbackDrillRequirement | null;
    capability: CapabilityRegistryEntry;
    certificate?: CertificateOfCapability | null;
  }): VerdictEvaluation;
}

export const PHASE9_VERDICT_AUTHORITY_VERSION = '1.0.0';

export class DefaultVerdictAuthority implements VerdictAuthority {
  evaluate(input: {
    capabilityId: string;
    riskTier: RiskTierGatePolicy['riskTier'];
    environmentClass: z.infer<
      typeof VerdictEvaluationSchema
    >['environmentClass'];
    resolved: EvidenceResolution;
    policy: RiskTierGatePolicy;
    approvals: Array<{
      signerId: string;
      signerRole: string;
      signedAt: string;
      signature: string;
      publicKey: string;
    }>;
    waivers: Phase9ReleaseWaiver[];
    rollbackDrill: RollbackDrillRequirement | null;
    capability: CapabilityRegistryEntry;
    certificate?: CertificateOfCapability | null;
  }): VerdictEvaluation {
    const reasons: string[] = [];
    const missingEvidence: string[] = [];
    const unresolvedRisks: string[] = [];
    const caveats: string[] = [];
    const now = new Date();

    if (input.resolved.missingRunIds.length > 0) {
      missingEvidence.push(
        ...input.resolved.missingRunIds.map(
          (id) => `runId=${id} not finalized`,
        ),
      );
      reasons.push('insufficient finalized evidence');
    }
    if (input.resolved.expiredEvidenceIds.length > 0) {
      missingEvidence.push(
        ...input.resolved.expiredEvidenceIds.map(
          (id) => `evidence=${id} expired`,
        ),
      );
      reasons.push('expired evidence detected');
    }
    if (input.resolved.failedEvidenceIds.length > 0) {
      unresolvedRisks.push(
        ...input.resolved.failedEvidenceIds.map(
          (id) => `evidence=${id} failed verification`,
        ),
      );
      reasons.push('failed verification');
    }

    if (
      input.environmentClass === 'PRODUCTION_PROBE' ||
      input.environmentClass === 'PRODUCTION'
    ) {
      // PRODUCTION_PROBE/PRODUCTION classes are NEVER simulated; they require real evidence.
      const sim = input.resolved.bundle.evidenceEnvelopes.find((e) =>
        e.correlationIds.some((c) => c.startsWith('simulated:')),
      );
      if (sim) {
        missingEvidence.push(`simulated evidence leaked (${sim.evidenceId})`);
        reasons.push(
          'simulated evidence present in production-targeted environment',
        );
      }
    }

    const requiredRoles = new Set(
      (
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
      )[input.riskTier],
    );
    const presentRoles = new Set(input.approvals.map((a) => a.signerRole));
    const missingRoles = [...requiredRoles].filter((r) => !presentRoles.has(r));
    if (missingRoles.length > 0) {
      missingEvidence.push(
        ...missingRoles.map((r) => `missing signature for role ${r}`),
      );
      reasons.push(
        `missing required signatures for ${input.riskTier}: ${missingRoles.join(', ')}`,
      );
    }

    if (input.riskTier === 'CRITICAL' || input.riskTier === 'HIGH') {
      if (!input.rollbackDrill) {
        missingEvidence.push('rollbackDrillRef missing');
        reasons.push(
          'CRITICAL/HIGH capability requires rollback drill reference',
        );
      } else if (input.rollbackDrill.status !== 'PASSED') {
        missingEvidence.push(
          `rollback drill status=${input.rollbackDrill.status}`,
        );
        reasons.push(
          `CRITICAL/HIGH capability requires PASSED rollback drill (got ${input.rollbackDrill.status})`,
        );
      }
    }

    const nowMs = now.getTime();
    const activeWaivers = input.waivers.filter((w) => {
      if (w.revokedAt) return false;
      if (Date.parse(w.expiresAt) <= nowMs) return false;
      return true;
    });
    const activeIssues = input.waivers.filter((w) => {
      if (w.revokedAt) return true;
      if (Date.parse(w.expiresAt) <= nowMs) return true;
      return false;
    });
    if (activeIssues.length > 0) {
      for (const w of activeIssues) {
        if (w.revokedAt) {
          reasons.push(`waiver ${w.waiverId} revoked`);
        } else {
          reasons.push(`waiver ${w.waiverId} expired (${w.expiresAt})`);
        }
      }
    }

    if (
      input.environmentClass === 'SIMULATED' ||
      input.environmentClass === 'LOCAL'
    ) {
      caveats.push(
        `environmentClass=${input.environmentClass} cannot authorize production release`,
      );
    }

    const blocking =
      missingEvidence.length > 0 ||
      unresolvedRisks.length > 0 ||
      activeIssues.length > 0 ||
      (input.environmentClass === 'SIMULATED' &&
        input.policy.rollbackDrillRequired);
    let verdict: z.infer<typeof VerdictEvaluationSchema>['verdict'];
    if (blocking) {
      verdict = 'INSUFFICIENT_EVIDENCE';
    } else if (unresolvedRisks.length > 0 || activeWaivers.length > 0) {
      verdict = 'BLOCKED';
    } else {
      verdict = 'PASSED';
    }

    const chainHash = computeEvaluatorChainHash({
      capabilityId: input.capabilityId,
      riskTier: input.riskTier,
      environmentClass: input.environmentClass,
      missingEvidence,
      unresolvedRisks,
      caveats,
      activeWaivers: activeWaivers.map((w) => w.waiverId),
      rollbackDrillRef: input.rollbackDrill?.drillId ?? null,
    });

    const certificate =
      verdict === 'PASSED' && input.certificate
        ? CertificateOfCapabilitySchema.parse(input.certificate)
        : null;

    return {
      schemaVersion: '1.0.0' as const,
      capabilityId: input.capabilityId,
      riskTier: input.riskTier,
      environmentClass: input.environmentClass,
      verdict,
      reasons,
      missingEvidence,
      unresolvedRisks,
      caveats,
      certificate,
      evaluatedAt: now.toISOString(),
      evaluatorChainHash: chainHash,
    };
  }
}

export function computeEvaluatorChainHash(input: {
  capabilityId: string;
  riskTier: RiskTierGatePolicy['riskTier'];
  environmentClass: z.infer<typeof VerdictEvaluationSchema>['environmentClass'];
  missingEvidence: string[];
  unresolvedRisks: string[];
  caveats: string[];
  activeWaivers: string[];
  rollbackDrillRef: string | null;
}): z.infer<typeof Sha256ChecksumSchema> {
  const payload = JSON.stringify({
    capabilityId: input.capabilityId,
    riskTier: input.riskTier,
    environmentClass: input.environmentClass,
    missingEvidence: [...input.missingEvidence].sort(),
    unresolvedRisks: [...input.unresolvedRisks].sort(),
    caveats: [...input.caveats].sort(),
    activeWaivers: [...input.activeWaivers].sort(),
    rollbackDrillRef: input.rollbackDrillRef,
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}` as never;
}

// ============================================================
// PRODUCTION ADAPTER REGISTRY (UNREGISTERED by default)
// ============================================================

export type Phase9ProductionAdapter =
  | 'CAPABILITY_REGISTRY'
  | 'EVIDENCE_RESOLVER'
  | 'SIGNATURE_AUTHORITY'
  | 'WAIVERS_LEDGER'
  | 'ROLLBACK_REGISTRY'
  | 'REQUIRED_SUITE_SELECTOR'
  | 'VERDICT_AUTHORITY';

export const PHASE9_UNREGISTERED_ADAPTERS: ReadonlyArray<Phase9ProductionAdapter> =
  [
    'CAPABILITY_REGISTRY',
    'EVIDENCE_RESOLVER',
    'SIGNATURE_AUTHORITY',
    'WAIVERS_LEDGER',
    'ROLLBACK_REGISTRY',
    'REQUIRED_SUITE_SELECTOR',
    'VERDICT_AUTHORITY',
  ] as const;

export interface ProductionAdapterRegistry {
  register(adapter: Phase9ProductionAdapter, port: object): void;
  resolve(adapter: Phase9ProductionAdapter): object | null;
  list(): Phase9ProductionAdapter[];
  statusOf(adapter: Phase9ProductionAdapter): 'REGISTERED' | 'UNREGISTERED';
}

export class InMemoryProductionAdapterRegistry implements ProductionAdapterRegistry {
  private readonly map = new Map<Phase9ProductionAdapter, object>();
  register(adapter: Phase9ProductionAdapter, port: object): void {
    if (this.map.has(adapter)) {
      throw new Error(`Phase 9 adapter ${adapter} already registered`);
    }
    this.map.set(adapter, port);
  }
  resolve(adapter: Phase9ProductionAdapter): object | null {
    return this.map.get(adapter) ?? null;
  }
  list(): Phase9ProductionAdapter[] {
    return [...this.map.keys()];
  }
  statusOf(adapter: Phase9ProductionAdapter): 'REGISTERED' | 'UNREGISTERED' {
    return this.map.has(adapter) ? 'REGISTERED' : 'UNREGISTERED';
  }
}

export function stampUnregisteredAdapters(): {
  schemaVersion: typeof PHASE9_VERSION;
  generatedAt: string;
  adapters: Array<{
    adapter: Phase9ProductionAdapter;
    status: 'UNREGISTERED';
    reason: string;
  }>;
} {
  return {
    schemaVersion: PHASE9_VERSION,
    generatedAt: new Date().toISOString(),
    adapters: PHASE9_UNREGISTERED_ADAPTERS.map((a) => ({
      adapter: a,
      status: 'UNREGISTERED' as const,
      reason: 'No production adapter registered for Phase 9 conformance',
    })),
  };
}

// ============================================================
// RE-EXPORTS
// ============================================================

export { ReleaseGateVerdictSchema };
export type { ReleaseGateVerdict };
export const _phase9TestIds = {
  waiverId: (): string => randomUUID(),
  drillId: (): string => randomUUID(),
};
