/**
 * Service Gateway V2 — Core Interfaces
 *
 * Phase 0: Baseline capability registry
 * Implements ISP/DIP per NC-AWL-IMP-1 §2 and §3
 */

// ── ISP narrow ports ─────────────────────────────────────────────────────────

export interface IReadCapability<P, R> {
  capability: string;
  validate(input: unknown): P;
  execute(ctx: ReadContext, input: P): Promise<R>;
}

export interface ReadContext {
  tenantId: string;
  actorId: string;
  correlationId: string;
}

export interface IIntentClassifier {
  classify(input: IntentInput): Promise<IntentDecision>;
}

export interface IntentInput {
  message: string;
  context?: Record<string, unknown>;
}

export type IntentType = 'READ' | 'MUTATION' | 'ADVICE' | 'NAVIGATION' | 'HELP' | 'UNSUPPORTED';

export interface IntentDecision {
  intent: IntentType;
  entity?: string;
  operation?: string;
  confidence: number;
  ruleId?: string;
  candidates?: IntentDecision[];
}

export interface IParameterExtractor<P> {
  extract(input: ExtractionInput): Promise<P>;
}

export interface ExtractionInput {
  message: string;
  schema: unknown;
}

export interface IMutationDispatcher {
  createGovernedRun(input: MutationRequest): Promise<WorkRunView>;
}

export interface MutationRequest {
  request: string;
  scope?: { projectId?: string; customerId?: string };
}

export interface WorkRunView {
  id: string;
  tenantId: string;
  status: string;
  currentStepIndex: number;
}

export interface IRecommendationProvider {
  recommend(input: RecommendationInput): Promise<Recommendation[]>;
}

export interface RecommendationInput {
  tenantId: string;
  context: Record<string, unknown>;
}

export interface SupportingEvidence {
  sourceType: string;
  sourceId: string;
  tenantId: string;
  observedAt: string;
  excerptHash: string;
}

export interface RankedAction {
  capability: string;
  effect: 'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_WRITE';
}

export interface Recommendation {
  id: string;
  tenantId: string;
  title: string;
  confidence: number;
  reasoning: string[];
  expiresAt: string;
  goal?: string;
  rankedAction?: RankedAction;
  expectedBenefit?: string;
  risk?: string;
  supportingEvidence: SupportingEvidence[];
  policyRequirements: string[];
  registeredMutationCapability?: string;
}

export interface IPredictionProvider {
  predict(input: PredictionInput): Promise<Prediction>;
}

export interface PredictionInput {
  tenantId: string;
  subject: { type: string; id: string };
  predictionType: string;
}

export interface Prediction {
  id: string;
  tenantId: string;
  subject: { type: string; id: string };
  predictionType: string;
  value: unknown;
  confidence: number;
  model: { id: string; version: string };
  featureSnapshotId: string;
  generatedAt: string;
  expiresAt: string;
  explanation: string[];
  limitations: string[];
}

export interface IChannelReceiver {
  receive(input: unknown): Promise<InboundMessage>;
}

export interface InboundMessage {
  tenantId: string;
  channel: string;
  senderId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface IChannelSender {
  send(message: OutboundMessage): Promise<DeliveryReceipt>;
}

export interface OutboundMessage {
  tenantId: string;
  channel: string;
  recipientId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DeliveryReceipt {
  success: boolean;
  deliveryId?: string;
  error?: string;
}

export interface ITenantIsolationProbe {
  execute(caseDefinition: IsolationCase): Promise<IsolationResult>;
}

export interface IsolationCase {
  tenantId: string;
  boundary: string;
  foreignId?: string;
}

export interface IsolationResult {
  allowed: boolean;
  evidence: string[];
  boundary: string;
  tenantId: string;
  foreignId?: string;
  errorCode?: string;
  errorMessage?: string;
  denied?: boolean;
}

// ── Capability descriptor for the registry ─────────────────────────────────

export type CapabilityEffect = 'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_WRITE' | 'ADVICE';

export interface CapabilityDescriptor<P = unknown, R = unknown> {
  identifier: string;
  ownerModule: string;
  effect: CapabilityEffect;
  schemaVersion: string;
  tenantScope: 'TENANT' | 'GLOBAL';
  responseProjection: string;
  deprecationState: 'ACTIVE' | 'DEPRECATED' | 'REMOVED';
  capability: IReadCapability<P, R>;
}

// ── Routing decision log ─────────────────────────────────────────────────────

export interface RoutingDecision {
  ruleVersion: string;
  ruleId: string;
  intent: IntentType;
  capability: string;
  confidence: number;
  timestamp: string;
  evidence: string[];
}

// ── Canonical Read Capability Descriptor (Phase 1B) ─────────────────────────
//
// Every active read capability must satisfy this shape. Phase 1B of the
// service-gateway-v2 plan canonicalizes what a "read capability" actually
// carries so that:
//   - the registry can enforce descriptor-shape invariants at boot time;
//   - the SafeProjector can strip / redact fields per sensitivity class
//     before envelopes leave the gateway;
//   - the routing audit log can persist the same shape regardless of which
//     service provided the underlying adapter.
//
// `effect` is restricted to 'READ' on this descriptor because the read
// registry refuses anything else.
export type SensitivityClass =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

export type EnvelopeStrategy = 'table' | 'metrics' | 'detail' | 'timeline';

export interface ReadCapabilityCanonicalDescriptor {
  capability: string;
  description: string;
  paramsSchema: unknown;
  serviceToken: unknown;
  adapter: (service: unknown, tenantId: string, params: unknown) => Promise<unknown>;
  authorizationScope: string[];
  sensitivityClass: SensitivityClass;
  maxPageSize: number;
  timeoutMs: number;
  envelopeStrategy: EnvelopeStrategy;
  effect: 'READ';
}

export const SENSITIVITY_CLASSES: ReadonlyArray<SensitivityClass> = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
];

export const ENVELOPE_STRATEGIES: ReadonlyArray<EnvelopeStrategy> = [
  'table',
  'metrics',
  'detail',
  'timeline',
];

export const DEFAULT_MAX_PAGE_SIZE = 50;
export const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Validate a single canonical field and return either the resolved value
 * (with default applied) or an array of human-readable error strings.
 *
 * `input` may be either the legacy IServiceCapability shape (only the
 * legacy fields populated) or an already-canonical descriptor. The helper
 * fills missing canonical fields from defaults so existing entries pass
 * without rewrites.
 */
export function validateCanonicalDescriptor(
  input: Record<string, unknown>,
): { ok: true; descriptor: ReadCapabilityCanonicalDescriptor } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const capName = String(input['capability'] ?? '');
  if (!capName) errors.push('capability is required');

  const description = String(input['description'] ?? '');

  const serviceToken = input['serviceToken'];
  if (serviceToken === undefined || serviceToken === null) {
    errors.push('serviceToken is required');
  }

  const paramsSchema = input['paramsSchema'];
  if (!paramsSchema) errors.push('paramsSchema is required');

  const adapter = input['adapter'];
  if (typeof adapter !== 'function') {
    errors.push('adapter must be a function');
  }

  const authorizationScopeRaw = input['authorizationScope'];
  const authorizationScope = Array.isArray(authorizationScopeRaw)
    ? authorizationScopeRaw.map((s) => String(s))
    : ['tenant.read'];

  const sensitivityClassRaw = String(input['sensitivityClass'] ?? 'INTERNAL');
  if (!SENSITIVITY_CLASSES.includes(sensitivityClassRaw as SensitivityClass)) {
    errors.push(
      `sensitivityClass must be one of ${SENSITIVITY_CLASSES.join(', ')} (got '${sensitivityClassRaw}')`,
    );
  }
  const sensitivityClass = sensitivityClassRaw as SensitivityClass;

  const rawMaxPageSize = Number(input['maxPageSize']);
  const maxPageSize =
    Number.isInteger(rawMaxPageSize) && rawMaxPageSize > 0
      ? rawMaxPageSize
      : DEFAULT_MAX_PAGE_SIZE;
  if (maxPageSize > 500) {
    errors.push(`maxPageSize must be ≤ 500 (got ${maxPageSize})`);
  }

  const rawTimeout = Number(input['timeoutMs']);
  const timeoutMs =
    Number.isInteger(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_TIMEOUT_MS;

  const envelopeStrategyRaw = String(
    input['envelopeStrategy'] ?? inferEnvelopeStrategy(capName),
  );
  if (!ENVELOPE_STRATEGIES.includes(envelopeStrategyRaw as EnvelopeStrategy)) {
    errors.push(
      `envelopeStrategy must be one of ${ENVELOPE_STRATEGIES.join(', ')} (got '${envelopeStrategyRaw}')`,
    );
  }
  const envelopeStrategy = envelopeStrategyRaw as EnvelopeStrategy;

  if (input['effect'] !== undefined && input['effect'] !== 'READ') {
    errors.push(`effect on read descriptors must be 'READ' (got '${input['effect']}')`);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    descriptor: {
      capability: capName,
      description,
      paramsSchema,
      serviceToken,
      adapter: adapter as ReadCapabilityCanonicalDescriptor['adapter'],
      authorizationScope,
      sensitivityClass,
      maxPageSize,
      timeoutMs,
      envelopeStrategy,
      effect: 'READ',
    },
  };
}

function inferEnvelopeStrategy(capabilityName: string): EnvelopeStrategy {
  if (/Detail|ById|^get[A-Z]/.test(capabilityName)) return 'detail';
  if (/Summary|Dashboard|Status/.test(capabilityName)) return 'metrics';
  if (/Timeline|Event|History/.test(capabilityName)) return 'timeline';
  return 'table';
}

/**
 * Detect duplicate canonical identifiers across multiple descriptors.
 */
export function findDuplicateCapabilities(
  descriptors: ReadonlyArray<Pick<ReadCapabilityCanonicalDescriptor, 'capability'>>,
): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const d of descriptors) {
    if (seen.has(d.capability)) dups.add(d.capability);
    seen.add(d.capability);
  }
  return Array.from(dups);
}

// ── Architecture test types ─────────────────────────────────────────────────

export enum ArchitectureRule {
  NO_DIRECT_PRISMA_IN_GATEWAY = 'NO_DIRECT_PRISMA_IN_GATEWAY',
  NO_DUPLICATE_REGISTRY = 'NO_DUPLICATE_REGISTRY',
  NO_WRITE_IN_READ_CATALOGUE = 'NO_WRITE_IN_READ_CATALOGUE',
  NO_PROVIDER_IN_ADAPTER = 'NO_PROVIDER_IN_ADAPTER',
  NO_NEW_ANY_OR_DEBUG = 'NO_NEW_ANY_OR_DEBUG',
}

export interface ArchitectureViolation {
  rule: ArchitectureRule;
  file: string;
  line?: number;
  description: string;
}

// ── Injection tokens ──────────────────────────────────────────────────────────

export const READ_CAPABILITY_REGISTRY = Symbol('READ_CAPABILITY_REGISTRY');
export const INTENT_CLASSIFIER = Symbol('INTENT_CLASSIFIER');
export const PARAMETER_EXTRACTOR = Symbol('PARAMETER_EXTRACTOR');
export const MUTATION_DISPATCHER = Symbol('MUTATION_DISPATCHER');
export const RECOMMENDATION_PROVIDER = Symbol('RECOMMENDATION_PROVIDER');
export const PREDICTION_PROVIDER = Symbol('PREDICTION_PROVIDER');
export const CHANNEL_RECEIVER = Symbol('CHANNEL_RECEIVER');
export const CHANNEL_SENDER = Symbol('CHANNEL_SENDER');
export const TENANT_ISOLATION_PROBE = Symbol('TENANT_ISOLATION_PROBE');
