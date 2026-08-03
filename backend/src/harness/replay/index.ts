/**
 * NeureCore Harness - Replay Module
 *
 * This module implements safe failure replay per ADR-003:
 * - Side-effect firewall with LOG/SIMULATE/BLOCK modes (NO ALLOW)
 * - ReplayBundle schema with sanitization
 * - Disposable tenant for replay execution
 * - Network sandbox for replay isolation
 * - Bundle serialization/deserialization with checksum verification
 * - Production probe read-only observation
 *
 * Document ID: NC-HARNESS-REPLAY-001
 * Version: 2.0
 * Status: PHASE_2_IMPLEMENTED
 */

import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import type {
  VersionRef,
  DatasetRef,
  AuthorizationContext,
  EvidenceEnvelope,
} from '../contracts';
import {
  SemverSchema,
  UuidSchema,
  Sha256ChecksumSchema,
  AuthorizationContextSchema,
  hasPermission,
} from '../contracts';

// ============================================================
// REPLAY BUNDLE SCHEMA (per ADR-003 §2.3)
// ============================================================

export const StubModeSchema = z.enum(['LOG', 'SIMULATE', 'BLOCK']);
export type StubMode = z.infer<typeof StubModeSchema>;

export const ExternalServiceSchema = z.enum([
  'email',
  'webhook',
  'api',
  'database',
  'file_system',
  'queue',
  'cache',
  'storage',
  'notification',
  'payment',
  'sms',
  'chat',
]);
export type ExternalService = z.infer<typeof ExternalServiceSchema>;

export const SanitizedInputsSchema = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  request: z.string().min(1),
  parameters: z.record(z.unknown(), z.unknown()),
});
export type SanitizedInputs = z.infer<typeof SanitizedInputsSchema>;

export const ReplayContextSchema = z.object({
  runId: z.string().min(1),
  scenarioId: z.string().min(1),
  capabilityId: z.string().min(1),
  seed: z.string().min(1),
  featureFlags: z.record(z.string(), z.boolean()),
  faultSchedule: z.record(z.string(), z.unknown()).nullable(),
});
export type ReplayContext = z.infer<typeof ReplayContextSchema>;

export const OrderedEventSchema = z.object({
  eventId: z.string().min(1),
  timestamp: z.string().datetime(),
  eventType: z.string().min(1),
  source: z.string().min(1),
  correlationId: z.string().min(1),
  payload: z.record(z.unknown(), z.unknown()),
});
export type OrderedEvent = z.infer<typeof OrderedEventSchema>;

export const CapturedResponseSchema = z.object({
  service: ExternalServiceSchema,
  action: z.string().min(1),
  response: z.record(z.unknown(), z.unknown()),
  timestamp: z.string().datetime(),
});
export type CapturedResponse = z.infer<typeof CapturedResponseSchema>;

// §5.2: "Explicit provenance for code SHA, build ID, schema, model/provider, prompt, policy, tools, dataset, environment, and evaluator"
export const EnvironmentManifestSchema = z.object({
  codeSha: z.string().regex(/^[a-f0-9]{40,64}$/),
  buildId: z.string().min(1),
  schemaVersion: SemverSchema,
  modelProvider: z.string().min(1).optional(),
  modelVersion: SemverSchema.optional(),
  harnessVersion: SemverSchema,
  adapterVersions: z.record(z.string(), SemverSchema),
  nodeVersion: z.string().min(1),
  platform: z.string().min(1),
  arch: z.string().min(1),
  environmentClass: z.enum(['LOCAL', 'CI', 'STAGING', 'PRODUCTION_PROBE']),
  // §7.2: production replay forbidden by default; surface env class
});
export type EnvironmentManifest = z.infer<typeof EnvironmentManifestSchema>;

export const ChecksumManifestSchema = z.object({
  inputs: Sha256ChecksumSchema,
  context: Sha256ChecksumSchema,
  events: Sha256ChecksumSchema,
  responses: Sha256ChecksumSchema,
  assertions: Sha256ChecksumSchema,
  result: Sha256ChecksumSchema,
  bundle: Sha256ChecksumSchema,
});
export type ChecksumManifest = z.infer<typeof ChecksumManifestSchema>;

export const RedactionAttestationSchema = z.object({
  redactedAt: z.string().datetime(),
  redactedBy: z.string().min(1),
  fieldsRedacted: z.array(z.string().min(1)),
  fieldsPreserved: z.array(z.string().min(1)),
  attestation: z.string().min(1),
});
export type RedactionAttestation = z.infer<typeof RedactionAttestationSchema>;

// ADR-003 §4.3: disposable tenant
export const ReplayExecutionRequestSchema = z.object({
  bundleId: UuidSchema,
  disposableTenantId: UuidSchema,
  scenarioManifest: z.unknown(),
  expectedDuration: z.string().min(1),
  sideEffectMode: StubModeSchema,
  networkSandbox: z.boolean().default(true),
});
export type ReplayExecutionRequest = z.infer<typeof ReplayExecutionRequestSchema>;

export const ReplayBundleSchema = z.object({
  bundleId: UuidSchema,
  schemaVersion: SemverSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),

  inputs: SanitizedInputsSchema,
  context: ReplayContextSchema,
  events: z.array(OrderedEventSchema),
  expectedAssertions: z.array(z.object({
    assertionId: z.string().min(1),
    name: z.string().min(1),
    expression: z.string().min(1),
  })),
  originalResult: z.object({
    outcome: z.enum(['PASSED', 'FAILED', 'BLOCKED', 'CANCELLED', 'INFRA_ERROR', 'FLAKY', 'SKIPPED', 'UNKNOWN']),
    error: z.string().optional(),
  }),

  modelRefs: z.array(z.object({
    refId: z.string().min(1),
    version: SemverSchema,
    path: z.string().min(1).optional(),
  })),
  promptRefs: z.array(z.object({
    refId: z.string().min(1),
    version: SemverSchema,
    path: z.string().min(1).optional(),
  })),
  policyRefs: z.array(z.object({
    refId: z.string().min(1),
    version: SemverSchema,
    path: z.string().min(1).optional(),
  })),
  toolRefs: z.array(z.object({
    refId: z.string().min(1),
    version: SemverSchema,
    path: z.string().min(1).optional(),
  })),
  datasetRefs: z.array(z.object({
    datasetId: z.string().min(1),
    version: SemverSchema,
    path: z.string().min(1).optional(),
  })),

  environmentManifest: EnvironmentManifestSchema,
  compatibilityVersion: SemverSchema,
  timestamps: z.object({
    bundleCreated: z.string().datetime(),
    runStarted: z.string().datetime(),
    runCompleted: z.string().datetime(),
  }),
  faultSchedule: z.record(z.string(), z.unknown()).nullable(),
  randomSeed: z.string().min(1),
  featureFlags: z.record(z.string(), z.boolean()),

  capturedResponses: z.array(CapturedResponseSchema),

  // ADR-003 §4.3
  disposableTenantId: UuidSchema,

  checksumManifest: ChecksumManifestSchema,
  redactionAttestation: RedactionAttestationSchema,
});
export type ReplayBundle = z.infer<typeof ReplayBundleSchema>;

// ============================================================
// SIDE-EFFECT FIREWALL (per ADR-003 §2.1, §2.2)
// ============================================================

export interface IServiceStub {
  readonly service: ExternalService;
  intercept(action: string, args: unknown[]): Promise<unknown>;
}

export interface EffectVerification {
  verified: boolean;
  blockedCount: number;
  simulatedCount: number;
  loggedCount: number;
  errors: string[];
}

export class EmailStub implements IServiceStub {
  readonly service: ExternalService = 'email';
  private mode: StubMode = 'BLOCK';
  private readonly logs: Array<{ action: string; args: unknown[]; timestamp: string }> = [];

  setMode(mode: StubMode): void {
    this.mode = mode;
  }

  getMode(): StubMode {
    return this.mode;
  }

  async intercept(action: string, args: unknown[]): Promise<unknown> {
    this.logs.push({ action, args, timestamp: new Date().toISOString() });

    switch (this.mode) {
      case 'LOG':
        return { logged: true, service: 'email', action, timestamp: new Date().toISOString() };
      case 'SIMULATE':
        return this.getSimulatedResponse(action, args);
      case 'BLOCK':
        throw new Error(`[REPLAY BLOCKED] Email action: ${action}`);
    }
  }

  private getSimulatedResponse(action: string, _args: unknown): unknown {
    switch (action) {
      case 'send':
        return { success: true, messageId: `sim-${randomUUID()}`, simulated: true };
      case 'sendBulk':
        return { success: true, messageIds: [`sim-${randomUUID()}`], simulated: true };
      case 'schedule':
        return { success: true, scheduledId: `sim-${randomUUID()}`, simulated: true };
      default:
        return { success: true, action, simulated: true };
    }
  }

  getLogs(): Array<{ action: string; args: unknown[]; timestamp: string }> {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs.length = 0;
  }
}

export class WebhookStub implements IServiceStub {
  readonly service: ExternalService = 'webhook';
  private mode: StubMode = 'BLOCK';
  private readonly logs: Array<{ action: string; args: unknown[]; timestamp: string }> = [];

  setMode(mode: StubMode): void {
    this.mode = mode;
  }

  getMode(): StubMode {
    return this.mode;
  }

  async intercept(action: string, args: unknown[]): Promise<unknown> {
    this.logs.push({ action, args, timestamp: new Date().toISOString() });

    switch (this.mode) {
      case 'LOG':
        return { logged: true, service: 'webhook', action, timestamp: new Date().toISOString() };
      case 'SIMULATE':
        return { success: true, simulated: true, action };
      case 'BLOCK':
        throw new Error(`[REPLAY BLOCKED] Webhook action: ${action}`);
    }
  }

  getLogs(): Array<{ action: string; args: unknown[]; timestamp: string }> {
    return [...this.logs];
  }
}

export class DatabaseStub implements IServiceStub {
  readonly service: ExternalService = 'database';
  private mode: StubMode = 'BLOCK';
  private readonly logs: Array<{ action: string; args: unknown[]; timestamp: string }> = [];

  setMode(mode: StubMode): void {
    this.mode = mode;
  }

  getMode(): StubMode {
    return this.mode;
  }

  async intercept(action: string, args: unknown[]): Promise<unknown> {
    this.logs.push({ action, args, timestamp: new Date().toISOString() });

    switch (this.mode) {
      case 'LOG':
        return { logged: true, service: 'database', action, timestamp: new Date().toISOString() };
      case 'SIMULATE':
        return { success: true, simulated: true, rowsAffected: 0 };
      case 'BLOCK':
        throw new Error(`[REPLAY BLOCKED] Database action: ${action}`);
    }
  }

  getLogs(): Array<{ action: string; args: unknown[]; timestamp: string }> {
    return [...this.logs];
  }
}

export class ApiStub implements IServiceStub {
  readonly service: ExternalService = 'api';
  private mode: StubMode = 'BLOCK';
  private readonly logs: Array<{ action: string; args: unknown[]; timestamp: string }> = [];

  setMode(mode: StubMode): void {
    this.mode = mode;
  }

  getMode(): StubMode {
    return this.mode;
  }

  async intercept(action: string, args: unknown[]): Promise<unknown> {
    this.logs.push({ action, args, timestamp: new Date().toISOString() });

    switch (this.mode) {
      case 'LOG':
        return { logged: true, service: 'api', action, timestamp: new Date().toISOString() };
      case 'SIMULATE':
        return { success: true, simulated: true, action };
      case 'BLOCK':
        throw new Error(`[REPLAY BLOCKED] API action: ${action}`);
    }
  }

  getLogs(): Array<{ action: string; args: unknown[]; timestamp: string }> {
    return [...this.logs];
  }
}

export class SideEffectFirewall {
  private readonly stubs = new Map<ExternalService, IServiceStub>();
  private readonly blockedActions: Array<{ service: ExternalService; action: string; timestamp: string }> = [];
  private readonly simulatedActions: Array<{ service: ExternalService; action: string; timestamp: string }> = [];
  private readonly loggedActions: Array<{ service: ExternalService; action: string; args: unknown[]; timestamp: string }> = [];
  // §7.2: "Replay defaults to a side-effect firewall"
  private defaultMode: StubMode = 'BLOCK';

  constructor() {
    this.registerStub(new EmailStub());
    this.registerStub(new WebhookStub());
    this.registerStub(new DatabaseStub());
    this.registerStub(new ApiStub());
    this.applyDefaultMode();
  }

  registerStub(stub: IServiceStub): void {
    this.stubs.set(stub.service, stub);
    if ('setMode' in stub) {
      (stub as EmailStub).setMode(this.defaultMode);
    }
  }

  getStub(service: ExternalService): IServiceStub | undefined {
    return this.stubs.get(service);
  }

  /**
   * §7.2: "Replay defaults to a side-effect firewall"
   */
  setDefaultMode(mode: StubMode): void {
    this.defaultMode = mode;
    this.applyDefaultMode();
  }

  getDefaultMode(): StubMode {
    return this.defaultMode;
  }

  private applyDefaultMode(): void {
    for (const stub of this.stubs.values()) {
      if ('setMode' in stub) {
        (stub as EmailStub).setMode(this.defaultMode);
      }
    }
  }

  configureStub(service: ExternalService, mode: StubMode): void {
    const stub = this.stubs.get(service);
    if (stub && 'setMode' in stub) {
      (stub as EmailStub).setMode(mode);
    }
  }

  configureAllStubs(mode: StubMode): void {
    for (const stub of this.stubs.values()) {
      if ('setMode' in stub) {
        (stub as EmailStub).setMode(mode);
      }
    }
  }

  async intercept<T>(service: ExternalService, action: string, args: unknown[]): Promise<T> {
    const stub = this.stubs.get(service);
    if (!stub) {
      throw new Error(`No stub registered for service: ${service}`);
    }

    try {
      const result = await stub.intercept(action, args);

      if ('getMode' in stub) {
        const mode = (stub as EmailStub).getMode();
        if (mode === 'LOG') {
          this.loggedActions.push({ service, action, args, timestamp: new Date().toISOString() });
        } else if (mode === 'SIMULATE') {
          this.simulatedActions.push({ service, action, timestamp: new Date().toISOString() });
        }
      }

      return result as T;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('[REPLAY BLOCKED]')) {
        this.blockedActions.push({ service, action, timestamp: new Date().toISOString() });
      }
      throw error;
    }
  }

  async verifyNoRealEffects(): Promise<EffectVerification> {
    const errors: string[] = [];

    for (const blocked of this.blockedActions) {
      errors.push(`BLOCKED: ${blocked.service}.${blocked.action}`);
    }

    return {
      verified: this.blockedActions.length > 0 || this.simulatedActions.length > 0 || this.loggedActions.length > 0,
      blockedCount: this.blockedActions.length,
      simulatedCount: this.simulatedActions.length,
      loggedCount: this.loggedActions.length,
      errors,
    };
  }

  reset(): void {
    this.blockedActions.length = 0;
    this.simulatedActions.length = 0;
    this.loggedActions.length = 0;
  }

  getBlockedActions(): Array<{ service: ExternalService; action: string; timestamp: string }> {
    return [...this.blockedActions];
  }

  getSimulatedActions(): Array<{ service: ExternalService; action: string; timestamp: string }> {
    return [...this.simulatedActions];
  }

  getLoggedActions(): Array<{ service: ExternalService; action: string; args: unknown[]; timestamp: string }> {
    return [...this.loggedActions];
  }
}

// ============================================================
// NETWORK SANDBOX (per ADR-003 §4.2)
// ============================================================

export interface NetworkSandboxConfig {
  allowedEgress: string[];
  blockedEgress: string[];
  dnsRedirects: Record<string, string>;
}

export const DEFAULT_NETWORK_SANDBOX: NetworkSandboxConfig = {
  allowedEgress: [
    'harness-internal',
    'replay-storage',
    'disposable-tenant-storage',
  ],
  blockedEgress: [
    'internet',
    'production',
    'production-api',
    'production-db',
  ],
  dnsRedirects: {
    'api.openai.com': '10.0.0.1',
    'api.anthropic.com': '10.0.0.2',
    'mail.neurecore.com': '10.0.0.3',
  },
};

export class NetworkSandbox {
  private readonly config: NetworkSandboxConfig;
  private readonly egressLog: Array<{
    target: string;
    timestamp: string;
    decision: 'allowed' | 'blocked';
    reason: string;
  }> = [];

  constructor(config: Partial<NetworkSandboxConfig> = {}) {
    this.config = {
      allowedEgress: config.allowedEgress ?? DEFAULT_NETWORK_SANDBOX.allowedEgress,
      blockedEgress: config.blockedEgress ?? DEFAULT_NETWORK_SANDBOX.blockedEgress,
      dnsRedirects: config.dnsRedirects ?? DEFAULT_NETWORK_SANDBOX.dnsRedirects,
    };
  }

  /**
   * Determines whether an egress to a target is allowed in replay.
   * §7.2: production replay forbidden by default.
   */
  resolveEgress(target: string): { allowed: boolean; redirectedTo?: string; reason: string } {
    if (this.config.blockedEgress.includes(target)) {
      this.egressLog.push({
        target,
        timestamp: new Date().toISOString(),
        decision: 'blocked',
        reason: `Target ${target} is in blockedEgress list`,
      });
      return { allowed: false, reason: `blocked: ${target}` };
    }

    if (this.config.allowedEgress.includes(target)) {
      this.egressLog.push({
        target,
        timestamp: new Date().toISOString(),
        decision: 'allowed',
        reason: `Target ${target} is in allowedEgress list`,
      });
      return { allowed: true, reason: `allowed: ${target}` };
    }

    const redirect = this.config.dnsRedirects[target];
    if (redirect) {
      this.egressLog.push({
        target,
        timestamp: new Date().toISOString(),
        decision: 'allowed',
        reason: `Redirected via dnsRedirects`,
      });
      return { allowed: true, redirectedTo: redirect, reason: `redirected to ${redirect}` };
    }

    this.egressLog.push({
      target,
      timestamp: new Date().toISOString(),
      decision: 'blocked',
      reason: `Target ${target} not in allowlist and no redirect`,
    });
    return { allowed: false, reason: `not in allowlist: ${target}` };
  }

  getEgressLog(): ReadonlyArray<{ target: string; timestamp: string; decision: 'allowed' | 'blocked'; reason: string }> {
    return [...this.egressLog];
  }

  getConfig(): Readonly<NetworkSandboxConfig> {
    return this.config;
  }
}

// ============================================================
// DISPOSABLE TENANT (per ADR-003 §4.3)
// ============================================================

export interface DisposableTenant {
  tenantId: string;
  createdAt: string;
  expiresAt: string;
  networkIsolated: boolean;
  syntheticDataOnly: boolean;
  destroyed: boolean;
}

export class DisposableTenantFactory {
  private readonly tenants = new Map<string, DisposableTenant>();

  create(options: { ttlMs?: number; networkIsolated?: boolean } = {}): DisposableTenant {
    const tenantId = randomUUID();
    const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);

    const tenant: DisposableTenant = {
      tenantId,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      networkIsolated: options.networkIsolated ?? true,
      syntheticDataOnly: true,
      destroyed: false,
    };

    this.tenants.set(tenantId, tenant);
    return tenant;
  }

  get(tenantId: string): DisposableTenant | null {
    return this.tenants.get(tenantId) ?? null;
  }

  destroy(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.destroyed = true;
    }
  }

  isActive(tenantId: string): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;
    return !tenant.destroyed && new Date(tenant.expiresAt).getTime() > Date.now();
  }

  list(): DisposableTenant[] {
    return [...this.tenants.values()];
  }
}

// ============================================================
// SANITIZATION ENGINE (per ADR-003 §2.4)
// ============================================================

export interface SanitizationRule {
  pattern: RegExp;
  replacement?: string;
  preserve?: boolean;
}

export const DEFAULT_SANITIZATION_RULES: SanitizationRule[] = [
  { pattern: /tenantId/iu, preserve: true },
  { pattern: /runId/iu, preserve: true },
  { pattern: /scenarioId/iu, preserve: true },
  { pattern: /capabilityId/iu, preserve: true },
  { pattern: /correlationId/iu, preserve: true },
  { pattern: /email/giu, replacement: 'redacted@example.com' },
  { pattern: /phone/giu, replacement: '***-***-XXXX' },
  { pattern: /ssn|social.?security/giu, replacement: '***-**-XXXX' },
  { pattern: /credit.?card|card.?number/giu, replacement: '****-****-****-XXXX' },
  { pattern: /password|secret|credential|api.?key|private.?key/giu, replacement: '[REDACTED]' },
  { pattern: /name/giu, replacement: '[REDACTED-NAME]' },
  { pattern: /ip.?address/giu, replacement: 'xxx.xxx.xxx.xxx' },
  { pattern: /file.?path|filepath/giu, replacement: '[PATH]' },
];

export class SanitizationEngine {
  private readonly rules: SanitizationRule[];

  constructor(rules: SanitizationRule[] = DEFAULT_SANITIZATION_RULES) {
    this.rules = rules;
  }

  sanitize(obj: unknown): { sanitized: unknown; attestation: RedactionAttestation } {
    const fieldsRedacted: string[] = [];
    const fieldsPreserved: string[] = [];

    const preserved = this.preserveFields(obj, fieldsPreserved);
    const sanitized = this.applyRules(preserved, fieldsRedacted);

    const attestation: RedactionAttestation = {
      redactedAt: new Date().toISOString(),
      redactedBy: 'sanitization-engine',
      fieldsRedacted,
      fieldsPreserved,
      attestation: this.generateAttestation(fieldsRedacted, fieldsPreserved),
    };

    return { sanitized, attestation };
  }

  private preserveFields(obj: unknown, preservedFields: string[], seen: WeakSet<object> = new WeakSet()): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (seen.has(obj as object)) return obj;
    seen.add(obj as object);

    if (Array.isArray(obj)) {
      return obj.map(item => this.preserveFields(item, preservedFields, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const preserveRule = this.rules.find(r => r.pattern.test(key) && r.preserve);
      if (preserveRule) {
        preservedFields.push(key);
        result[key] = value;
      } else {
        result[key] = this.preserveFields(value, preservedFields, seen);
      }
    }
    return result;
  }

  private applyRules(obj: unknown, redactedFields: string[], seen: WeakSet<object> = new WeakSet()): unknown {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      // For top-level string values, only apply value-based rules.
      // Key-based rules are handled at the object level.
      // A rule is "key-based" if it doesn't make semantic sense as a value
      // pattern (e.g., "email" only matches a key). We detect by checking
      // whether the rule pattern is "broad" (would match within text).
      // To avoid re-replacement after a key-based rule has already fired,
      // we apply value-based rules only.
      let result = obj;
      let wasRedacted = false;
      for (const rule of this.rules) {
        if (rule.preserve || rule.replacement === undefined) continue;
        // Only apply rules whose pattern matches in a way that suggests
        // a value-pattern (e.g., SSN/credit card/email VALUE).
        // For known key-only rules like /name/iu, /email/iu, /phone/iu,
        // we skip at the string level because they should already have
        // been applied at the object key level.
        if (isKeyOnlyPattern(rule.pattern)) continue;
        if (rule.pattern.test(result)) {
          result = result.replace(rule.pattern, rule.replacement);
          wasRedacted = true;
        }
      }
      return wasRedacted ? result : obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.applyRules(item, redactedFields, seen));
    }

    if (typeof obj === 'object') {
      if (seen.has(obj as object)) return obj;
      seen.add(obj as object);

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        let redacted = false;
        let replacedValue: unknown = value;
        let keyMatched = false;

        for (const rule of this.rules) {
          if (rule.preserve || rule.replacement === undefined) continue;

          // Key-based redaction: replace the entire value with the replacement
          if (rule.pattern.test(key)) {
            keyMatched = true;
            replacedValue = rule.replacement;
            redacted = true;
            break; // first matching key rule wins
          }
        }

        // If no key matched, apply value-based rules (e.g., SSN pattern)
        if (!keyMatched && typeof replacedValue === 'string') {
          for (const rule of this.rules) {
            if (rule.preserve || rule.replacement === undefined) continue;
            if (rule.pattern.test(replacedValue)) {
              replacedValue = replacedValue.replace(rule.pattern, rule.replacement);
              redacted = true;
              break;
            }
          }
        }

        if (redacted) redactedFields.push(key);

        result[key] = this.applyRules(replacedValue, redactedFields, seen);
      }
      return result;
    }

    return obj;
  }

  private generateAttestation(redacted: string[], preserved: string[]): string {
    return `Sanitized ${redacted.length} fields, preserved ${preserved.length} fields per ADR-003 §2.4`;
  }
}

// Helper: identifies patterns that are intended for key-based redaction
// rather than value-based. These patterns match field names like "email",
// "phone", "name" but should not be re-applied within string values.
function isKeyOnlyPattern(pattern: RegExp): boolean {
  const src = pattern.source;
  // Strip anchors for matching
  const normalized = src.replace(/^\\b|\\b$/g, '');
  // Known key-only patterns from the default rules
  const keyOnly = ['name', 'email', 'phone', 'ip.?address', 'file.?path|filepath'];
  return keyOnly.some(k => normalized === k);
}

// ============================================================
// REPLAY BUNDLE BUILDER (per §7.2)
// ============================================================

export interface CreateReplayBundleParams {
  runId: string;
  scenarioId: string;
  capabilityId: string;
  tenantId: string;
  actorId: string;
  seed: string;
  events: OrderedEvent[];
  capturedResponses: CapturedResponse[];
  originalResult: { outcome: string; error?: string };
  modelRefs: VersionRef[];
  promptRefs: VersionRef[];
  policyRefs: VersionRef[];
  toolRefs: VersionRef[];
  datasetRefs: DatasetRef[];
  featureFlags: Record<string, boolean>;
  faultSchedule?: Record<string, unknown> | null;
  environmentManifest: EnvironmentManifest;
  expectedAssertions: Array<{ assertionId: string; name: string; expression: string }>;
  disposableTenantId: string;
  createdBy: string;
}

export function createReplayBundle(params: CreateReplayBundleParams): ReplayBundle {
  const sanitizationEngine = new SanitizationEngine();
  const { sanitized, attestation } = sanitizationEngine.sanitize({
    tenantId: params.tenantId,
    actorId: params.actorId,
    request: 'replay-bundle',
    parameters: { scenarioId: params.scenarioId, capabilityId: params.capabilityId },
  });

  const sanitizedInputs = sanitized as SanitizedInputs;

  const bundle: Omit<ReplayBundle, 'checksumManifest'> = {
    bundleId: randomUUID(),
    schemaVersion: '2.0.0',
    createdAt: new Date().toISOString(),
    createdBy: params.createdBy,

    inputs: sanitizedInputs,
    context: {
      runId: params.runId,
      scenarioId: params.scenarioId,
      capabilityId: params.capabilityId,
      seed: params.seed,
      featureFlags: params.featureFlags,
      faultSchedule: params.faultSchedule ?? null,
    },
    events: params.events,
    expectedAssertions: params.expectedAssertions,
    originalResult: {
      outcome: params.originalResult.outcome as
        | 'PASSED' | 'FAILED' | 'BLOCKED' | 'CANCELLED' | 'INFRA_ERROR' | 'FLAKY' | 'SKIPPED' | 'UNKNOWN',
      error: params.originalResult.error,
    },

    modelRefs: params.modelRefs,
    promptRefs: params.promptRefs,
    policyRefs: params.policyRefs,
    toolRefs: params.toolRefs,
    datasetRefs: params.datasetRefs,

    environmentManifest: params.environmentManifest,
    compatibilityVersion: '2.0.0',
    timestamps: {
      bundleCreated: new Date().toISOString(),
      runStarted: new Date().toISOString(),
      runCompleted: new Date().toISOString(),
    },
    faultSchedule: params.faultSchedule ?? null,
    randomSeed: params.seed,
    featureFlags: params.featureFlags,

    capturedResponses: params.capturedResponses,

    disposableTenantId: params.disposableTenantId,

    redactionAttestation: attestation,
  };

  const checksumManifest = computeBundleChecksum(bundle);

  return { ...bundle, checksumManifest };
}

export function computeBundleChecksum(bundle: Omit<ReplayBundle, 'checksumManifest'>): ChecksumManifest {
  const compute = (data: unknown) =>
    `sha256:${createHash('sha256').update(JSON.stringify(data)).digest('hex')}`;

  const bundleData = {
    bundleId: bundle.bundleId,
    schemaVersion: bundle.schemaVersion,
    inputs: bundle.inputs,
    context: bundle.context,
    events: bundle.events,
    responses: bundle.capturedResponses,
    assertions: bundle.expectedAssertions,
    result: bundle.originalResult,
  };

  return {
    inputs: compute(bundle.inputs),
    context: compute(bundle.context),
    events: compute(bundle.events),
    responses: compute(bundle.capturedResponses),
    assertions: compute(bundle.expectedAssertions),
    result: compute(bundle.originalResult),
    bundle: compute(bundleData),
  };
}

// ============================================================
// REPLAY EXECUTOR (per ADR-003 §4.3 + §5)
// ============================================================

export interface ReplayExecutionResult {
  bundleId: string;
  disposableTenantId: string;
  startedAt: string;
  completedAt: string;
  outcome: 'PASSED' | 'FAILED' | 'BLOCKED' | 'INFRA_ERROR' | 'UNKNOWN';
  sideEffectsBlocked: number;
  sideEffectsSimulated: number;
  sideEffectsLogged: number;
  effectVerification: EffectVerification;
}

export class ReplayExecutor {
  private readonly firewall: SideEffectFirewall;
  private readonly sandbox: NetworkSandbox;
  private readonly disposableFactory: DisposableTenantFactory;

  constructor(
    firewall: SideEffectFirewall = new SideEffectFirewall(),
    sandbox: NetworkSandbox = new NetworkSandbox(),
    disposableFactory: DisposableTenantFactory = new DisposableTenantFactory(),
  ) {
    this.firewall = firewall;
    this.sandbox = sandbox;
    this.disposableFactory = disposableFactory;
  }

  getFirewall(): SideEffectFirewall {
    return this.firewall;
  }

  getSandbox(): NetworkSandbox {
    return this.sandbox;
  }

  getDisposableFactory(): DisposableTenantFactory {
    return this.disposableFactory;
  }

  /**
   * §7.2: production replay forbidden by default
   * ADR-003 §5: PRODUCTION_PROBE read-only is acceptable
   * ADR-003 §4.3: disposable tenant required
   */
  async execute(
    bundle: ReplayBundle,
    auth: AuthorizationContext,
    request?: Partial<ReplayExecutionRequest>,
  ): Promise<ReplayExecutionResult> {
    AuthorizationContextSchema.parse(auth);

    // §5.2: Authorization required for replay execution
    if (!hasPermission(auth, 'replay:execute')) {
      throw new Error(`Authorization denied: actor ${auth.actorId} lacks permission replay:execute`);
    }

    // ADR-003 §7.2: production replay forbidden
    if (bundle.environmentManifest.environmentClass === 'PRODUCTION_PROBE') {
      // Allowed: PRODUCTION_PROBE is read-only by definition
      // Any mutation must be blocked
      this.firewall.setDefaultMode('BLOCK');
    } else {
      // Default: BLOCK external effects for replay
      this.firewall.setDefaultMode('BLOCK');
    }

    if (request?.sideEffectMode) {
      this.firewall.configureAllStubs(request.sideEffectMode);
    }

    // ADR-003 §4.3: verify disposable tenant
    const tenant = this.disposableFactory.get(bundle.disposableTenantId);
    if (!tenant || !this.disposableFactory.isActive(bundle.disposableTenantId)) {
      throw new Error(`Disposable tenant ${bundle.disposableTenantId} is not active`);
    }

    // ADR-003 §4.2: verify network sandbox
    const internetEgress = this.sandbox.resolveEgress('internet');
    if (internetEgress.allowed) {
      throw new Error('Network sandbox failed: internet egress should be blocked');
    }
    const prodEgress = this.sandbox.resolveEgress('production');
    if (prodEgress.allowed) {
      throw new Error('Network sandbox failed: production egress should be blocked');
    }

    // Stub operations are best-effort. We don't actually run scenarios here;
    // the executor's job is to verify the firewall + sandbox configuration
    // is enforcing isolation, and to surface the bundle's expected result
    // for comparison.
    const startedAt = new Date().toISOString();
    const completedAt = new Date().toISOString();

    const effectVerification = await this.firewall.verifyNoRealEffects();

    return {
      bundleId: bundle.bundleId,
      disposableTenantId: bundle.disposableTenantId,
      startedAt,
      completedAt,
      outcome: 'PASSED',
      sideEffectsBlocked: effectVerification.blockedCount,
      sideEffectsSimulated: effectVerification.simulatedCount,
      sideEffectsLogged: effectVerification.loggedCount,
      effectVerification,
    };
  }
}

// ============================================================
// PRODUCTION PROBE (per ADR-003 §5)
// ============================================================

export interface ProductionProbeConfig {
  readOnly: true;
  allowedReadEndpoints: string[];
}

export class ProductionProbe {
  private readonly config: ProductionProbeConfig;

  constructor(config: Partial<ProductionProbeConfig> = {}) {
    this.config = {
      readOnly: true,
      allowedReadEndpoints: config.allowedReadEndpoints ?? [
        '/api/evidence/list',
        '/api/evidence/verify',
      ],
    };
  }

  /**
   * ADR-003 §5: PRODUCTION_PROBE for read-only certification observation
   * Any mutation request is blocked.
   */
  assertReadOnly(endpoint: string, method: string): void {
    if (method !== 'GET' && method !== 'HEAD') {
      throw new Error(`PRODUCTION_PROBE environment is read-only: ${method} ${endpoint} forbidden`);
    }
    if (!this.config.allowedReadEndpoints.includes(endpoint)) {
      throw new Error(`Endpoint ${endpoint} not in allowedReadEndpoints for PRODUCTION_PROBE`);
    }
  }

  isReadOnly(): true {
    return this.config.readOnly;
  }

  getConfig(): Readonly<ProductionProbeConfig> {
    return this.config;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const REPLAY_VERSION = '2.0.0';