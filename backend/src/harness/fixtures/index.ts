/**
 * NeureCore Harness - Shared Fixtures & Builders (Phase 3)
 *
 * Implements the Shared Fixture Package required by §10 Phase 3 and the
 * Test Harness closure listed in §4 and §9 row "Test":
 *   "Shared fixtures, builders, clocks, IDs, tenant provisioning, cleanup,
 *    adapter conformance"
 *
 * SOLID alignment:
 *   - SRP: deterministic builders only; no execution or evidence logic.
 *   - OCP: new builders added by composition; existing factories untouched.
 *   - DIP: ports only (no Prisma / Playwright / Redis deps).
 *
 * §5.2 invariants enforced here:
 *   - "Clock, random seed, IDs, provider responses, and fault schedule are
 *     controllable where determinism is required."
 *   - "Idempotent orchestration and cleanup; retries cannot duplicate
 *     business effects."
 *   - "Cleanup failure is a run failure and triggers an orphan-resource alert."
 *
 * Document ID: NC-HARNESS-FIXTURES-001
 * Version: 1.0
 * Status: PHASE_3_IMPLEMENTED
 */

import { randomBytes } from 'crypto';
import { z } from 'zod';
import {
  UuidSchema,
  IsoDateTimeSchema,
  Sha256ChecksumSchema,
  SemverSchema,
  AuthorizationContextSchema,
  AuthorizationRoleSchema,
  type AuthorizationContext,
} from '../contracts';

// ============================================================
// DETERMINISTIC CLOCK (§5.2 controllable clocks)
// ============================================================

export interface IClock {
  now(): Date;
  advance(deltaMs: number): void;
  set(iso: string): void;
  reset(): void;
}

export const SystemClockSchema = z.object({
  kind: z.literal('SYSTEM'),
});

export const FrozenClockSchema = z.object({
  kind: z.literal('FROZEN'),
  initialIso: IsoDateTimeSchema,
});

export const ManualClockSchema = z.object({
  kind: z.literal('MANUAL'),
  initialIso: IsoDateTimeSchema,
});

export const ClockConfigSchema = z.discriminatedUnion('kind', [
  SystemClockSchema,
  FrozenClockSchema,
  ManualClockSchema,
]);

export type ClockConfig = z.infer<typeof ClockConfigSchema>;

export class FrozenClock implements IClock {
  private current: Date;
  constructor(initialIso?: string) {
    this.current = initialIso ? new Date(initialIso) : new Date(0);
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  advance(deltaMs: number): void {
    this.current = new Date(this.current.getTime() + deltaMs);
  }
  set(iso: string): void {
    this.current = new Date(iso);
  }
  reset(): void {
    this.current = new Date(0);
  }
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  advance(_deltaMs: number): void {
    // No-op: real wall-clock
  }
  set(_iso: string): void {
    throw new Error(
      'SystemClock cannot be set; use FrozenClock or ManualClock',
    );
  }
  reset(): void {
    // No-op
  }
}

export function createClock(config: ClockConfig = { kind: 'SYSTEM' }): IClock {
  switch (config.kind) {
    case 'FROZEN':
      return new FrozenClock(config.initialIso);
    case 'MANUAL':
      return new FrozenClock(config.initialIso);
    case 'SYSTEM':
      return new SystemClock();
  }
}

// ============================================================
// DETERMINISTIC RNG (seeded §5.2)
// ============================================================

export interface IRng {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
  nextString(length: number): string;
  nextBoolean(): boolean;
  pick<T>(items: readonly T[]): T;
}

export class SeededRng implements IRng {
  private state: number;
  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed : hashSeed(seed);
  }
  nextInt(min: number, max: number): number {
    if (max < min) throw new Error('max must be >= min');
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }
  nextFloat(): number {
    // xorshift32
    let x = this.state | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;
    return ((this.state >>> 0) % 1_000_000) / 1_000_000;
  }
  nextString(length: number): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[this.nextInt(0, alphabet.length - 1)];
    }
    return out;
  }
  nextBoolean(): boolean {
    return this.nextInt(0, 1) === 1;
  }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from empty array');
    return items[this.nextInt(0, items.length - 1)];
  }
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

// ============================================================
// DETERMINISTIC ID FACTORY (§5.2 "IDs ... are controllable")
// ============================================================

export const DeterministicIdSchema = z
  .string()
  .regex(/^[a-z0-9_]+-[0-9a-f]{8,}$/, 'Deterministic id format violation');

export type DeterministicId = z.infer<typeof DeterministicIdSchema>;

export interface IIdFactory {
  next(prefix: string): DeterministicId;
  reset(): void;
}

export class SequentialIdFactory implements IIdFactory {
  private counter = 0;
  constructor(private readonly seed = 'harness') {}
  next(prefix: string): DeterministicId {
    this.counter += 1;
    const suffix = this.counter.toString(16).padStart(8, '0');
    const id = `${prefix}-${suffix}`;
    return DeterministicIdSchema.parse(id);
  }
  reset(): void {
    this.counter = 0;
  }
}

export class HashIdFactory implements IIdFactory {
  private counter = 0;
  constructor(private readonly seed: string) {}
  next(prefix: string): DeterministicId {
    this.counter += 1;
    const h = hashSeed(`${this.seed}:${this.counter}`);
    const suffix = Math.abs(h).toString(16).padStart(8, '0');
    const id = `${prefix}-${suffix}`;
    return DeterministicIdSchema.parse(id);
  }
  reset(): void {
    this.counter = 0;
  }
}

export function createIdFactory(
  kind: 'sequential' | 'hash',
  seed?: string,
): IIdFactory {
  if (kind === 'sequential') return new SequentialIdFactory(seed);
  return new HashIdFactory(seed ?? 'harness');
}

// ============================================================
// TENANT PROVISIONER (§5.2 "tenant-scoped by default")
// ============================================================

export const TenantFixtureSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().min(1).default('accounting'),
  isolationTier: z
    .enum(['STANDARD', 'ELEVATED', 'DISPOSABLE'])
    .default('STANDARD'),
  featureFlags: z.record(z.boolean()).default({}),
  createdAt: IsoDateTimeSchema,
  seed: z.string().optional(),
});

export type TenantFixture = z.infer<typeof TenantFixtureSchema>;

export const TenantProvisionRequestSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  isolationTier: z.enum(['STANDARD', 'ELEVATED', 'DISPOSABLE']).optional(),
  featureFlags: z.record(z.boolean()).optional(),
  seed: z.string().optional(),
});

export type TenantProvisionRequest = z.infer<
  typeof TenantProvisionRequestSchema
>;

export interface ITenantProvisioner {
  provision(req?: TenantProvisionRequest): TenantFixture;
  get(tenantId: string): TenantFixture | null;
  list(): TenantFixture[];
  /**
   * §5.2 "Cleanup failure is a run failure" — cleanup returns an explicit
   * report. Orphan resources surface to the caller.
   */
  teardown(tenantId: string): TeardownReport;
  disposeAll(): TeardownReport;
}

export const TeardownReportSchema = z.object({
  tenantId: z.string().min(1),
  removed: z.number().int().nonnegative(),
  orphaned: z.array(z.string().min(1)),
  failures: z.array(z.string().min(1)),
  durationMs: z.number().nonnegative(),
  success: z.boolean(),
});

export type TeardownReport = z.infer<typeof TeardownReportSchema>;

export class InMemoryTenantProvisioner implements ITenantProvisioner {
  private readonly tenants = new Map<string, TenantFixture>();
  private readonly resourcesByTenant = new Map<string, Set<string>>();
  private readonly idFactory: IIdFactory;

  constructor(idFactory?: IIdFactory) {
    this.idFactory = idFactory ?? new SequentialIdFactory('tenant');
  }

  provision(req: TenantProvisionRequest = {}): TenantFixture {
    const tenantId = this.idFactory.next('tnt');
    const fixture = TenantFixtureSchema.parse({
      tenantId,
      name: req.name ?? `Fixture Tenant ${tenantId}`,
      industry: req.industry ?? 'accounting',
      isolationTier: req.isolationTier ?? 'STANDARD',
      featureFlags: req.featureFlags ?? {},
      createdAt: new Date(0).toISOString(),
      seed: req.seed,
    });
    this.tenants.set(tenantId, fixture);
    this.resourcesByTenant.set(tenantId, new Set());
    return fixture;
  }

  registerResource(tenantId: string, resourceId: string): void {
    const set = this.resourcesByTenant.get(tenantId);
    if (!set) throw new Error(`Unknown tenant ${tenantId}`);
    set.add(resourceId);
  }

  get(tenantId: string): TenantFixture | null {
    return this.tenants.get(tenantId) ?? null;
  }

  list(): TenantFixture[] {
    return [...this.tenants.values()];
  }

  teardown(tenantId: string): TeardownReport {
    const started = Date.now();
    const set = this.resourcesByTenant.get(tenantId);
    const tenant = this.tenants.get(tenantId);
    if (!tenant || !set) {
      return {
        tenantId,
        removed: 0,
        orphaned: [],
        failures: [`tenant ${tenantId} not found`],
        durationMs: Date.now() - started,
        success: false,
      };
    }
    const orphaned: string[] = [];
    const failures: string[] = [];
    for (const resourceId of set) {
      if (!this.tryRemove(resourceId)) {
        orphaned.push(resourceId);
      }
    }
    set.clear();
    this.tenants.delete(tenantId);
    this.resourcesByTenant.delete(tenantId);
    return {
      tenantId,
      removed: tenant ? 1 : 0,
      orphaned,
      failures,
      durationMs: Date.now() - started,
      success: orphaned.length === 0 && failures.length === 0,
    };
  }

  disposeAll(): TeardownReport {
    const started = Date.now();
    let removed = 0;
    const orphaned: string[] = [];
    const failures: string[] = [];
    for (const tenantId of [...this.tenants.keys()]) {
      const report = this.teardown(tenantId);
      removed += report.removed;
      orphaned.push(...report.orphaned);
      failures.push(...report.failures);
    }
    return {
      tenantId: '*',
      removed,
      orphaned,
      failures,
      durationMs: Date.now() - started,
      success: orphaned.length === 0 && failures.length === 0,
    };
  }

  private tryRemove(_resourceId: string): boolean {
    return true;
  }
}

// ============================================================
// DATA BUILDERS (§10 Phase 3 "deterministic tenant/data builders")
// ============================================================

export interface IDataBuilder<T> {
  with(overrides: Partial<T>): this;
  build(): T;
  buildMany(count: number): T[];
}

class BaseBuilder<T extends object> implements IDataBuilder<T> {
  protected current: Partial<T> = {};
  constructor(
    protected readonly defaults: T,
    protected readonly onBuild?: () => void,
  ) {
    this.current = { ...defaults };
  }
  with(overrides: Partial<T>): this {
    this.current = { ...this.current, ...overrides };
    return this;
  }
  build(): T {
    if (this.onBuild) this.onBuild();
    return { ...this.defaults, ...this.current } as T;
  }
  buildMany(count: number): T[] {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('count must be a non-negative integer');
    }
    const baseDefaults = { ...this.defaults };
    const baseOverrides = { ...this.current };
    return Array.from({ length: count }, () => {
      if (this.onBuild) this.onBuild();
      return { ...baseDefaults, ...baseOverrides } as T;
    });
  }
}

export const UserFixtureSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  email: z.string().email(),
  role: AuthorizationRoleSchema,
  createdAt: IsoDateTimeSchema,
});

export type UserFixture = z.infer<typeof UserFixtureSchema>;

export class UserBuilder extends BaseBuilder<UserFixture> {
  private latestId: string | null = null;
  constructor(
    private readonly idFactory: IIdFactory,
    private readonly tenantId: string,
    overrides: Partial<UserFixture> = {},
  ) {
    super({
      userId: 'usr-pending',
      tenantId,
      email: 'fixture@example.com',
      role: 'TENANT_USER',
      createdAt: new Date(0).toISOString(),
      ...overrides,
    });
  }
  build(): UserFixture {
    this.latestId = this.idFactory.next('usr');
    const out = super.build();
    return { ...out, userId: this.latestId };
  }
  buildMany(count: number): UserFixture[] {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('count must be a non-negative integer');
    }
    return Array.from({ length: count }, () => this.build());
  }
}

export const ProjectFixtureSchema = z.object({
  projectId: z.string().min(1),
  tenantId: z.string().min(1),
  ownerId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  dueDate: IsoDateTimeSchema.optional(),
  createdAt: IsoDateTimeSchema,
  checksum: Sha256ChecksumSchema.optional(),
});

export type ProjectFixture = z.infer<typeof ProjectFixtureSchema>;

export class ProjectBuilder extends BaseBuilder<ProjectFixture> {
  private latestId: string | null = null;
  constructor(
    private readonly idFactory: IIdFactory,
    private readonly tenantId: string,
    private readonly ownerId: string,
    overrides: Partial<ProjectFixture> = {},
  ) {
    super({
      projectId: 'proj-pending',
      tenantId,
      ownerId,
      name: 'Fixture Project',
      status: 'DRAFT',
      createdAt: new Date(0).toISOString(),
      ...overrides,
    });
  }
  build(): ProjectFixture {
    this.latestId = this.idFactory.next('proj');
    const out = super.build();
    return { ...out, projectId: this.latestId };
  }
  buildMany(count: number): ProjectFixture[] {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('count must be a non-negative integer');
    }
    return Array.from({ length: count }, () => this.build());
  }
}

// ============================================================
// FIXTURE PACKAGE AGGREGATOR (§10 Phase 3 "Shared fixture package")
// ============================================================

export const FixturePackageConfigSchema = z.object({
  seed: z.string().min(1).default('harness-fixture'),
  clock: ClockConfigSchema.default({
    kind: 'FROZEN',
    initialIso: '1970-01-01T00:00:00.000Z',
  }),
  idFactoryKind: z.enum(['sequential', 'hash']).default('sequential'),
});

export type FixturePackageConfig = z.infer<typeof FixturePackageConfigSchema>;

export interface IFixturePackage {
  readonly clock: IClock;
  readonly rng: IRng;
  readonly ids: IIdFactory;
  readonly tenants: ITenantProvisioner;
  user(tenantId: string, overrides?: Partial<UserFixture>): UserBuilder;
  project(
    tenantId: string,
    ownerId: string,
    overrides?: Partial<ProjectFixture>,
  ): ProjectBuilder;
  reset(): void;
  disposeAll(): TeardownReport;
}

export class FixturePackage implements IFixturePackage {
  readonly clock: IClock;
  readonly rng: IRng;
  readonly ids: IIdFactory;
  readonly tenants: InMemoryTenantProvisioner;

  constructor(config: Partial<FixturePackageConfig> = {}) {
    const parsed = FixturePackageConfigSchema.parse({
      seed: 'harness-fixture',
      clock: { kind: 'FROZEN', initialIso: '1970-01-01T00:00:00.000Z' },
      idFactoryKind: 'sequential',
      ...config,
    });
    this.clock = createClock(parsed.clock);
    this.rng = new SeededRng(parsed.seed);
    this.ids = createIdFactory(parsed.idFactoryKind, parsed.seed);
    this.tenants = new InMemoryTenantProvisioner(this.ids);
  }

  user(tenantId: string, overrides: Partial<UserFixture> = {}): UserBuilder {
    return new UserBuilder(this.ids, tenantId, overrides);
  }

  project(
    tenantId: string,
    ownerId: string,
    overrides: Partial<ProjectFixture> = {},
  ): ProjectBuilder {
    return new ProjectBuilder(this.ids, tenantId, ownerId, overrides);
  }

  reset(): void {
    this.ids.reset();
    this.tenants.disposeAll();
    this.clock.reset();
  }

  disposeAll(): TeardownReport {
    return this.tenants.disposeAll();
  }
}

// ============================================================
// AUTHORIZATION CONTEXT BUILDER
// ============================================================

export function buildAuthContext(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return AuthorizationContextSchema.parse({
    actorId: 'fixture-actor',
    actorType: 'SYSTEM',
    actorRoles: ['SYSTEM'],
    tenantId: '00000000-0000-0000-0000-000000000001',
    correlationId: 'corr-fixture',
    permissions: ['evidence:read'],
    ...overrides,
  });
}

// ============================================================
// CLEANUP RELIABILITY METRICS (§10 Phase 3 "cleanup reliability meet agreed thresholds")
// ============================================================

export const CleanupMetricsSchema = z.object({
  runs: z.number().int().nonnegative(),
  cleanups: z.number().int().nonnegative(),
  orphans: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
  orphanRate: z.number().nonnegative(),
  failureRate: z.number().nonnegative(),
  passesReliabilityThreshold: z.boolean(),
});

export type CleanupMetrics = z.infer<typeof CleanupMetricsSchema>;

export const DEFAULT_CLEANUP_THRESHOLDS = {
  /** §10 Phase 3 exit: "fixture and cleanup reliability meet agreed thresholds" */
  maxOrphanRate: 0.0,
  maxFailureRate: 0.01,
  minRuns: 1,
} as const;

export function computeCleanupMetrics(
  reports: readonly TeardownReport[],
  thresholds: {
    maxOrphanRate: number;
    maxFailureRate: number;
    minRuns: number;
  } = DEFAULT_CLEANUP_THRESHOLDS,
): CleanupMetrics {
  const cleanups = reports.length;
  const orphans = reports.reduce((acc, r) => acc + r.orphaned.length, 0);
  const failures = reports.filter((r) => !r.success).length;
  const orphanRate = cleanups === 0 ? 0 : orphans / cleanups;
  const failureRate = cleanups === 0 ? 0 : failures / cleanups;
  const passesReliabilityThreshold =
    cleanups >= thresholds.minRuns &&
    orphanRate <= thresholds.maxOrphanRate &&
    failureRate <= thresholds.maxFailureRate;
  return CleanupMetricsSchema.parse({
    runs: cleanups,
    cleanups,
    orphans,
    failures,
    orphanRate,
    failureRate,
    passesReliabilityThreshold,
  });
}

// ============================================================
// FLAKE CONTROL CONTRACT (§11 "Flaky... never silently count as pass")
// ============================================================

export const FlakeObservationSchema = z.object({
  scenarioId: z.string().min(1),
  runId: z.string().min(1),
  observedAt: IsoDateTimeSchema,
  outcome: z.enum(['PASSED', 'FAILED']),
  flakeSuspected: z.boolean().default(false),
  reason: z.string().optional(),
});

export type FlakeObservation = z.infer<typeof FlakeObservationSchema>;

export const FlakeThresholdsSchema = z.object({
  /**
   * §11 "Flaky ... never silently count as pass": a scenario is FLAKY
   * when its pass rate over a window falls below this threshold while it
   * is not 0% (which would be a stable failure).
   */
  minPassRateForStable: z.number().min(0).max(1).default(0.98),
  minSampleSize: z.number().int().nonnegative().default(5),
});

export type FlakeThresholds = z.infer<typeof FlakeThresholdsSchema>;

export function classifyFlakiness(
  observations: readonly FlakeObservation[],
  thresholds: FlakeThresholds = FlakeThresholdsSchema.parse({}),
): 'STABLE_PASS' | 'STABLE_FAIL' | 'FLAKY' | 'INSUFFICIENT_EVIDENCE' {
  if (observations.length < thresholds.minSampleSize)
    return 'INSUFFICIENT_EVIDENCE';
  const passed = observations.filter((o) => o.outcome === 'PASSED').length;
  const rate = passed / observations.length;
  if (rate >= thresholds.minPassRateForStable) return 'STABLE_PASS';
  if (rate === 0) return 'STABLE_FAIL';
  return 'FLAKY';
}

// Re-export used primitives
export { UuidSchema, IsoDateTimeSchema, Sha256ChecksumSchema, SemverSchema };

/**
 * Generate a SHA-256 content checksum in harness envelope format.
 * Provided here as a convenience for fixture payloads.
 */
export function fixtureChecksum(input: string): string {
  // crypto is a Node built-in; using dynamic import keeps this file portable
  // for tests that run under jest without a type-only import warning.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  const digest = crypto.createHash('sha256').update(input).digest('hex');
  return `sha256:${digest}`;
}

let _randomBytesUsed = false;
export function _markRandomBytesUsed(): void {
  _randomBytesUsed = true;
}
export function _resetRandomBytesUsed(): void {
  _randomBytesUsed = false;
}
export function _consumeRandomBytes(size: number): Buffer {
  _randomBytesUsed = true;
  return randomBytes(size);
}
