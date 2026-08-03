/**
 * NeureCore Harness — Phase 9 production adapter registry wiring.
 *
 * Registers all 7 Phase 9 production adapters against a
 * `ProductionAdapterRegistry`. Sources:
 * - CAPABILITY_REGISTRY  — reads capability inventory from
 *   /etc/neurecore/phase9/capabilities.json when present, otherwise
 *   from memory-bank-arc/harness/harness-capability-inventory.yaml.
 * - EVIDENCE_RESOLVER     — backed by `EvidenceStore` +
 *   `StagingEvidenceSource`.
 * - SIGNATURE_AUTHORITY   — reads signer keys from
 *   PHASE9_SIGNER_<role>_KEY env vars or
 *   /etc/neurecore/phase9/signers.json; falls back to in-memory
 *   `SupportSignatureAuthority`. Stamps as PRODUCTION_KEY_PROVIDED
 *   when an env var is present.
 * - WAIVERS_LEDGER        — file-backed at
 *   /etc/neurecore/phase9/waivers.json (file lock semantics:
 *   read-on-issue, write-on-revoke). Fallback in-memory.
 * - ROLLBACK_REGISTRY     — file-backed at
 *   /etc/neurecore/phase9/rollbacks.json. Fallback in-memory.
 * - REQUIRED_SUITE_SELECTOR — `DefaultRequiredSuiteSelector` with the
 *   approved Phase 9 policies.
 * - VERDICT_AUTHORITY      — `DefaultVerdictAuthority`.
 *
 * Document ID: NC-HARNESS-PHASE9-PRODUCTION-ADAPTER-001
 * Version: 1.0
 * Status: PHASE_9_IMPLEMENTED
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  type CapabilityRegistry,
  type EvidenceResolver,
  type Phase9ProductionAdapter,
  type ProductionAdapterRegistry,
  type RequiredSuiteSelector,
  type RollbackRegistry,
  type SignatureAuthority,
  type VerdictAuthority,
  type WaiversLedger,
  DefaultRequiredSuiteSelector,
  DefaultVerdictAuthority,
  InMemoryCapabilityRegistry,
  InMemoryEvidenceResolver,
  InMemoryRollbackRegistry,
  InMemoryWaiversLedger,
  SupportSignatureAuthority,
} from '../ports';
import {
  CapabilityRegistryEntrySchema,
  type CapabilityRegistryEntry,
  PHASE9_VERSION,
  type RiskTierGatePolicy,
} from '../contracts';
import { defaultPhase9Policies } from '../runners';
import {
  StagingEvidenceSourceImpl,
  type StagingEvidenceSource,
} from './staging-evidence-source';
import type { EvidenceStore } from '../../evidence';

export interface AdapterRegistrationStamp {
  adapter: Phase9ProductionAdapter;
  status: 'REGISTERED';
  signer: string;
  environmentClass: string;
  registeredAt: string;
  source: string;
  notes: string[];
}

export interface Phase9StagingAdapterBundle {
  registry: ProductionAdapterRegistry;
  stamps: AdapterRegistrationStamp[];
  evidenceSource: StagingEvidenceSource;
  capabilityRegistry: CapabilityRegistry;
  evidenceResolver: EvidenceResolver;
  signatureAuthority: SignatureAuthority;
  waiversLedger: WaiversLedger;
  rollbackRegistry: RollbackRegistry;
  requiredSuiteSelector: RequiredSuiteSelector;
  verdictAuthority: VerdictAuthority;
  policies: RiskTierGatePolicy[];
}

const PHASE9_PROD_CONFIG_DIRS = [
  '/etc/neurecore/phase9',
  process.env.PHASE9_PROD_CONFIG_DIR ?? '',
].filter(Boolean);

const SIGNER_ROLES = [
  'EVALUATOR',
  'QA_LEAD',
  'DOMAIN_OWNER',
  'SECURITY',
  'COMPLIANCE',
  'ARCHITECTURE',
] as const;

type SignerRoleT = (typeof SIGNER_ROLES)[number];

function resolveConfigPath(filename: string): string | null {
  for (const dir of PHASE9_PROD_CONFIG_DIRS) {
    const candidate = path.join(dir, filename);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readOptionalJson<T>(filename: string): T | null {
  const p = resolveConfigPath(filename);
  if (!p) return null;
  const raw = readFileSync(p, 'utf-8');
  return JSON.parse(raw) as T;
}

interface SignerEntry {
  signerId: string;
  signerRole: SignerRoleT;
  key: string;
}

function readSignerKeys(): Map<SignerRoleT, SignerEntry> {
  const result = new Map<SignerRoleT, SignerEntry>();
  for (const role of SIGNER_ROLES) {
    const envKey = process.env[`PHASE9_SIGNER_${role}_KEY`];
    if (envKey) {
      result.set(role, {
        signerId:
          process.env[`PHASE9_SIGNER_${role}_ID`] ??
          `phase9-${role.toLowerCase()}`,
        signerRole: role,
        key: envKey,
      });
      continue;
    }
  }
  const file = readOptionalJson<SignerEntry[]>('signers.json');
  if (file) {
    for (const entry of file) {
      if (SIGNER_ROLES.includes(entry.signerRole)) {
        result.set(entry.signerRole, entry);
      }
    }
  }
  return result;
}

function isProductionKeyProvided(role: SignerRoleT): boolean {
  return Boolean(process.env[`PHASE9_SIGNER_${role}_KEY`]);
}

function buildSignatureAuthority(
  signerKeys: Map<SignerRoleT, SignerEntry>,
  role: SignerRoleT,
  fallbackSignerId: string,
): SignatureAuthority {
  const entry = signerKeys.get(role);
  if (entry) {
    return new SupportSignatureAuthority(role, entry.signerId, entry.key);
  }
  return new SupportSignatureAuthority(
    role,
    fallbackSignerId,
    `in-memory-fallback-${role.toLowerCase()}-${randomUUID()}`,
  );
}

// ============================================================
// CAPABILITY REGISTRY ADAPTER
// ============================================================

interface CapabilitiesJsonFile {
  capabilities: Array<{
    capabilityId: string;
    capabilityVersion?: string;
    name?: string;
    description?: string;
    riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    ownerId?: string;
    ownerRole?: string;
    requiredSuites?: string[];
    surfaces?: string[];
    notes?: string[];
  }>;
}

function buildCapabilityRegistry(environmentClass: string): {
  registry: CapabilityRegistry;
  source: string;
} {
  const registry = new InMemoryCapabilityRegistry();
  const jsonFile = readOptionalJson<CapabilitiesJsonFile>('capabilities.json');
  if (jsonFile?.capabilities) {
    for (const c of jsonFile.capabilities) {
      const entry: CapabilityRegistryEntry =
        CapabilityRegistryEntrySchema.parse({
          schemaVersion: PHASE9_VERSION,
          capabilityId: c.capabilityId,
          capabilityVersion: c.capabilityVersion ?? '1.0.0',
          name: c.name ?? c.capabilityId,
          description: c.description ?? `Phase 9 capability ${c.capabilityId}`,
          riskTier: c.riskTier,
          owner: {
            ownerId: c.ownerId ?? 'phase9-production-adapter',
            ownerRole: c.ownerRole ?? 'RELEASE_ENGINEERING',
            confirmedAt: new Date().toISOString(),
          },
          environmentScope: { environmentClass },
          requiredSuites: c.requiredSuites ?? ['phase9.certification'],
          surfaces: c.surfaces ?? ['src/harness/phase9/'],
          notes: c.notes ?? [],
        });
      registry.register(entry);
    }
    return { registry, source: '/etc/neurecore/phase9/capabilities.json' };
  }
  // Fallback: read harness-capability-inventory.yaml for the CAP-XXX
  // records. The YAML reader below extracts the `capabilityRecords`
  // block.
  const yamlPath = path.join(
    process.env.PHASE9_HARNESS_ROOT ??
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        'memory-bank-arc',
        'harness',
      ),
    'harness-capability-inventory.yaml',
  );
  if (existsSync(yamlPath)) {
    const text = readFileSync(yamlPath, 'utf-8');
    const records = parseCapabilityRecordsYaml(text);
    for (const r of records) {
      const entry: CapabilityRegistryEntry =
        CapabilityRegistryEntrySchema.parse({
          schemaVersion: PHASE9_VERSION,
          capabilityId: r.id,
          capabilityVersion: '1.0.0',
          name: r.id,
          description: `Phase 9 capability ${r.id} (from harness-capability-inventory.yaml)`,
          riskTier: r.riskTier,
          owner: {
            ownerId: 'harness-inventory-fallback',
            ownerRole: 'RELEASE_ENGINEERING',
            confirmedAt: new Date().toISOString(),
          },
          environmentScope: { environmentClass },
          requiredSuites: ['phase9.certification'],
          surfaces: ['src/harness/phase9/'],
          notes: [`imported from harness-capability-inventory.yaml`],
        });
      registry.register(entry);
    }
    return { registry, source: yamlPath };
  }
  return { registry, source: 'in-memory-empty' };
}

interface CapabilityRecordYaml {
  id: string;
  riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

function parseCapabilityRecordsYaml(text: string): CapabilityRecordYaml[] {
  // Locate the "capabilityRecords:" top-level block and parse each
  // "- { id: CAP-XXX, ... }" entry that follows. The harness YAML
  // uses a compact one-line form for the 65 capability records.
  const out: CapabilityRecordYaml[] = [];
  const marker = '\ncapabilityRecords:';
  const idx = text.indexOf(marker);
  if (idx === -1) return out;
  const rest = text.slice(idx);
  const lines = rest.split('\n');
  for (const line of lines) {
    const m = line.match(
      /^\s*-\s*\{\s*id:\s*(CAP-\d+)\s*,\s*[^}]*riskTier:\s*(CRITICAL|HIGH|MEDIUM|LOW)/,
    );
    if (m) {
      out.push({
        id: m[1],
        riskTier: m[2] as CapabilityRecordYaml['riskTier'],
      });
    }
  }
  return out;
}

// ============================================================
// WAIVERS LEDGER ADAPTER
// ============================================================

class FileBackedWaiversLedger implements WaiversLedger {
  private map = new Map<string, ReturnType<Phase9ReleaseWaiverCast>>();
  private readonly filePath: string | null;
  private loaded = false;

  constructor(filePath: string | null) {
    this.filePath = filePath;
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.filePath || !existsSync(this.filePath)) return;
    const raw = readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Array<
      ReturnType<Phase9ReleaseWaiverCast>
    >;
    for (const w of parsed) this.map.set(w.waiverId, w);
  }

  private persist(): void {
    if (!this.filePath) return;
    const tmp = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(
      tmp,
      JSON.stringify([...this.map.values()], null, 2),
      'utf-8',
    );
    renameSync(tmp, this.filePath);
  }

  issue(
    waiver: ReturnType<Phase9ReleaseWaiverCast>,
  ): ReturnType<Phase9ReleaseWaiverCast> {
    this.load();
    if (this.map.has(waiver.waiverId)) {
      throw new Error(`Waiver ${waiver.waiverId} already issued`);
    }
    this.map.set(waiver.waiverId, waiver);
    this.persist();
    return waiver;
  }

  revoke(
    waiverId: string,
    actor: string,
    reason: string,
  ): ReturnType<Phase9ReleaseWaiverCast> {
    this.load();
    const existing = this.map.get(waiverId);
    if (!existing) throw new Error(`Waiver ${waiverId} not found`);
    if (existing.revokedAt)
      throw new Error(`Waiver ${waiverId} already revoked`);
    const updated: ReturnType<Phase9ReleaseWaiverCast> = {
      ...existing,
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
      notes: [...existing.notes, `revoked by ${actor}: ${reason}`],
    };
    this.map.set(waiverId, updated);
    this.persist();
    return updated;
  }

  status(
    waiverId: string,
    now: Date = new Date(),
  ): 'ACTIVE' | 'REVOKED' | 'EXPIRED' {
    this.load();
    const w = this.map.get(waiverId);
    if (!w) throw new Error(`Waiver ${waiverId} not found`);
    if (w.revokedAt) return 'REVOKED';
    if (Date.parse(w.expiresAt) <= now.getTime()) return 'EXPIRED';
    return 'ACTIVE';
  }

  list(): ReturnType<Phase9ReleaseWaiverCast>[] {
    this.load();
    return [...this.map.values()];
  }

  get(waiverId: string): ReturnType<Phase9ReleaseWaiverCast> | null {
    this.load();
    return this.map.get(waiverId) ?? null;
  }
}

type Phase9ReleaseWaiverCast = () => import('../contracts').Phase9ReleaseWaiver;

// ============================================================
// ROLLBACK REGISTRY ADAPTER
// ============================================================

class FileBackedRollbackRegistry implements RollbackRegistry {
  private map = new Map<
    string,
    import('../contracts').RollbackDrillRequirement
  >();
  private readonly filePath: string | null;
  private loaded = false;

  constructor(filePath: string | null) {
    this.filePath = filePath;
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.filePath || !existsSync(this.filePath)) return;
    const raw = readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Array<
      import('../contracts').RollbackDrillRequirement
    >;
    for (const d of parsed) this.map.set(d.drillId, d);
  }

  private persist(): void {
    if (!this.filePath) return;
    const tmp = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    writeFileSync(
      tmp,
      JSON.stringify([...this.map.values()], null, 2),
      'utf-8',
    );
    renameSync(tmp, this.filePath);
  }

  recordDrill(
    drill: import('../contracts').RollbackDrillRequirement,
  ): import('../contracts').RollbackDrillRequirement {
    this.load();
    this.map.set(drill.drillId, drill);
    this.persist();
    return drill;
  }

  get(drillId: string): import('../contracts').RollbackDrillRequirement | null {
    this.load();
    return this.map.get(drillId) ?? null;
  }

  lastSuccessfulDrillAt(capabilityId: string): string | null {
    this.load();
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
// REGISTRATION
// ============================================================

export function registerPhase9ProductionAdapters(
  registry: ProductionAdapterRegistry,
  options: {
    environmentClass?: string;
    signer?: string;
    evidenceResolver?: EvidenceResolver;
    evidenceStore?: EvidenceStore;
    evidenceSource?: StagingEvidenceSource;
  } = {},
): AdapterRegistrationStamp[] {
  const environmentClass = options.environmentClass ?? 'STAGING';
  const signer = options.signer ?? 'phase9-production-adapter';
  const registeredAt = new Date().toISOString();
  const stamps: AdapterRegistrationStamp[] = [];

  // CAPABILITY_REGISTRY
  const { registry: capabilityRegistry, source: capSource } =
    buildCapabilityRegistry(environmentClass);
  registry.register('CAPABILITY_REGISTRY', capabilityRegistry);
  stamps.push({
    adapter: 'CAPABILITY_REGISTRY',
    status: 'REGISTERED',
    signer,
    environmentClass,
    registeredAt,
    source: capSource,
    notes: [],
  });

  // EVIDENCE_RESOLVER
  const evidenceResolver =
    options.evidenceResolver ?? new InMemoryEvidenceResolver();
  registry.register('EVIDENCE_RESOLVER', evidenceResolver);
  const evidenceSource = options.evidenceSource ?? null;
  const evidenceResolverNotes: string[] = [];
  if (evidenceSource) {
    evidenceResolverNotes.push(
      `StagingEvidenceSource attached (${evidenceSource.listFinalizedRunIds().length} finalized runIds)`,
    );
  } else {
    evidenceResolverNotes.push(
      'StagingEvidenceSource not attached; in-memory resolver only',
    );
  }
  stamps.push({
    adapter: 'EVIDENCE_RESOLVER',
    status: 'REGISTERED',
    signer,
    environmentClass,
    registeredAt,
    source: 'InMemoryEvidenceResolver + StagingEvidenceSource',
    notes: evidenceResolverNotes,
  });

  // SIGNATURE_AUTHORITY (per-role; we register a single composite that
  // exposes the union of keys). For the production adapter registry,
  // we register the role-specific SupportSignatureAuthority for the
  // role that this adapter binds to (EVALUATOR by default).
  const signerKeys = readSignerKeys();
  const primaryRole: SignerRoleT =
    (process.env.PHASE9_PRIMARY_SIGNER_ROLE as SignerRoleT) ?? 'EVALUATOR';
  const signatureAuthority = buildSignatureAuthority(
    signerKeys,
    primaryRole,
    'phase9-default-signer',
  );
  registry.register('SIGNATURE_AUTHORITY', signatureAuthority);
  const sigNotes: string[] = [];
  for (const role of SIGNER_ROLES) {
    if (isProductionKeyProvided(role)) {
      sigNotes.push(`${role}: PRODUCTION_KEY_PROVIDED`);
    } else if (signerKeys.has(role)) {
      sigNotes.push(`${role}: signers.json`);
    } else {
      sigNotes.push(`${role}: in-memory fallback`);
    }
  }
  stamps.push({
    adapter: 'SIGNATURE_AUTHORITY',
    status: 'REGISTERED',
    signer,
    environmentClass,
    registeredAt,
    source:
      'PHASE9_SIGNER_<role>_KEY env / /etc/neurecore/phase9/signers.json / in-memory fallback',
    notes: sigNotes,
  });

  // WAIVERS_LEDGER
  const waiversPath = resolveConfigPath('waivers.json');
  const waiversLedger: WaiversLedger = waiversPath
    ? new FileBackedWaiversLedger(waiversPath)
    : new InMemoryWaiversLedger();
  registry.register('WAIVERS_LEDGER', waiversLedger);
  stamps.push({
    adapter: 'WAIVERS_LEDGER',
    status: 'REGISTERED',
    signer,
    environmentClass,
    registeredAt,
    source: waiversPath ?? 'in-memory fallback',
    notes: waiversPath
      ? [`file-backed at ${waiversPath}`]
      : ['in-memory fallback (no /etc/neurecore/phase9/waivers.json)'],
  });

  // ROLLBACK_REGISTRY
  const rollbacksPath = resolveConfigPath('rollbacks.json');
  const rollbackRegistry: RollbackRegistry = rollbacksPath
    ? new FileBackedRollbackRegistry(rollbacksPath)
    : new InMemoryRollbackRegistry();
  registry.register('ROLLBACK_REGISTRY', rollbackRegistry);
  stamps.push({
    adapter: 'ROLLBACK_REGISTRY',
    status: 'REGISTERED',
    signer,
    environmentClass,
    registeredAt,
    source: rollbacksPath ?? 'in-memory fallback',
    notes: rollbacksPath
      ? [`file-backed at ${rollbacksPath}`]
      : ['in-memory fallback (no /etc/neurecore/phase9/rollbacks.json)'],
  });

  // REQUIRED_SUITE_SELECTOR
  const policies = defaultPhase9Policies();
  const requiredSuiteSelector: RequiredSuiteSelector =
    new DefaultRequiredSuiteSelector(policies);
  registry.register('REQUIRED_SUITE_SELECTOR', requiredSuiteSelector);
  stamps.push({
    adapter: 'REQUIRED_SUITE_SELECTOR',
    status: 'REGISTERED',
    signer,
    environmentClass,
    registeredAt,
    source: 'DefaultRequiredSuiteSelector with defaultPhase9Policies()',
    notes: [],
  });

  // VERDICT_AUTHORITY
  const verdictAuthority: VerdictAuthority = new DefaultVerdictAuthority();
  registry.register('VERDICT_AUTHORITY', verdictAuthority);
  stamps.push({
    adapter: 'VERDICT_AUTHORITY',
    status: 'REGISTERED',
    signer,
    environmentClass,
    registeredAt,
    source: 'DefaultVerdictAuthority',
    notes: [],
  });

  return stamps;
}

// ============================================================
// STAGING BUNDLE (in-process wiring for STAGING-class evidence)
// ============================================================

export interface LoadStagingAdaptersOptions {
  evidenceStore: EvidenceStore;
  signer?: string;
  capabilitiesJsonPath?: string;
}

export function loadStagingAdapters(
  options: LoadStagingAdaptersOptions,
): Phase9StagingAdapterBundle {
  const registry: ProductionAdapterRegistry =
    new (class implements ProductionAdapterRegistry {
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
      statusOf(
        adapter: Phase9ProductionAdapter,
      ): 'REGISTERED' | 'UNREGISTERED' {
        return this.map.has(adapter) ? 'REGISTERED' : 'UNREGISTERED';
      }
    })();

  const evidenceSource: StagingEvidenceSource = new StagingEvidenceSourceImpl(
    options.evidenceStore,
  );
  // The evidence resolver is a separate concept; the
  // StagingEvidenceSource is the source of truth for STAGING
  // evidence. We still register the resolver so the bundle exposes
  // the standard 7-adapter surface.

  const stamps = registerPhase9ProductionAdapters(registry, {
    environmentClass: 'STAGING',
    signer: options.signer ?? 'phase9-staging-adapter',
    evidenceSource,
  });

  // Re-resolve the registered ports so the bundle exposes them.
  const capabilityRegistry = registry.resolve(
    'CAPABILITY_REGISTRY',
  ) as CapabilityRegistry;
  const evidenceResolver = registry.resolve(
    'EVIDENCE_RESOLVER',
  ) as EvidenceResolver;
  const signatureAuthority = registry.resolve(
    'SIGNATURE_AUTHORITY',
  ) as SignatureAuthority;
  const waiversLedger = registry.resolve('WAIVERS_LEDGER') as WaiversLedger;
  const rollbackRegistry = registry.resolve(
    'ROLLBACK_REGISTRY',
  ) as RollbackRegistry;
  const requiredSuiteSelector = registry.resolve(
    'REQUIRED_SUITE_SELECTOR',
  ) as RequiredSuiteSelector;
  const verdictAuthority = registry.resolve(
    'VERDICT_AUTHORITY',
  ) as VerdictAuthority;

  // Mark every finalized runId on the resolver so that
  // `EvidenceResolver.resolve` does not report `runId ... not finalized`.
  for (const runId of evidenceSource.listFinalizedRunIds()) {
    if (
      typeof (
        evidenceResolver as unknown as { markFinalized?: (id: string) => void }
      ).markFinalized === 'function'
    ) {
      (
        evidenceResolver as unknown as { markFinalized: (id: string) => void }
      ).markFinalized(runId);
    }
  }

  // Suppress unused param warnings; signatureAuthority/requiredSuiteSelector
  // are exposed through the bundle.
  void signatureAuthority;
  void requiredSuiteSelector;

  return {
    registry,
    stamps,
    evidenceSource,
    capabilityRegistry,
    evidenceResolver,
    signatureAuthority,
    waiversLedger,
    rollbackRegistry,
    requiredSuiteSelector,
    verdictAuthority,
    policies: defaultPhase9Policies(),
  };
}

export const _phase9ProdAdapterInternals = {
  parseCapabilityRecordsYaml,
};
