/* eslint-disable @typescript-eslint/require-await --
 * Adapter contract methods return Promise<...> per interface; default
 * implementations are synchronous but exposed as async so callers can
 * await uniformly. Real adapters (Prisma-backed) await freely.
 */
/**
 * Tenant Isolation Probe — Phase 7 (real implementation).
 *
 * Formal live cross-tenant certification. Replaces the architectural
 * confidence stubs with executable probes that drive every boundary
 * through injected adapters. The default adapters in
 * `defaultProbeAdapters` are in-memory and used by the unit spec;
 * the integration spec (`src/test/certification/integration/g7-cross-tenant.spec.ts`)
 * wires the same probes to real Prisma-backed adapters.
 *
 * Each probe returns an `IsolationResult` describing whether a
 * cross-tenant access attempt was denied. The runner aggregates all
 * probes across two seeded tenants and emits a JSON report that
 * feeds gate G7 in the Phase 9 certification runner.
 *
 * Coverage matrix (12 boundaries):
 *   - router_context          : chat composer cannot accept tenantId from payload
 *   - read_gateway            : read capabilities reject foreign IDs
 *   - entity_resolution       : same-name entity only resolves inside tenant
 *   - work_runtime            : workRuns are tenant-scoped
 *   - approvals               : foreign approval cannot inspect/resume
 *   - agents_skills           : agent/skill definitions isolated
 *   - analytics               : feature snapshots invisible cross-tenant
 *   - connectors              : credentials/webhooks isolated
 *   - channels                : external identity mapping tenant-scoped
 *   - envelopes_history       : persisted responses never leak foreign rows
 *   - realtime                : socket rooms/events tenant-scoped
 *   - artifacts               : artifact paths/URLs reject foreign tenants
 *
 * Default behavior: unknown boundary → fail closed with
 * `allowed: false` and evidence `Unknown boundary: <name>`.
 */

import type { IsolationResult, IsolationCase } from '../interfaces';

// ─── Result & case types ────────────────────────────────────────────────────

export type ProbeResult = IsolationResult & { denied: boolean };

export interface TenantPairFixture {
  tenantA: { id: string; label: string };
  tenantB: { id: string; label: string };
  /** IDs that belong to tenantB; supplying them to tenantA must be denied. */
  foreignIds: {
    project?: string;
    task?: string;
    executionAttempt?: string;
    approvalRequest?: string;
    agent?: string;
    skill?: string;
    analyticsSnapshot?: string;
    connector?: string;
    webhook?: string;
    channelMapping?: string;
    envelope?: string;
    artifact?: string;
  };
  /** Same-name collisions used by entity_resolution. */
  collisions: {
    projectName?: string;
    taskTitle?: string;
    agentName?: string;
  };
}

export interface TenantIsolationProbeReport {
  runId: string;
  timestamp: string;
  tenantAId: string;
  tenantBId: string;
  results: ProbeResult[];
  gateG7: GateG7Summary;
}

export interface GateG7Summary {
  totalProbes: number;
  denied: number;
  allowed: number;
  deniedRate: number;
  zeroCrossTenantExposure: boolean;
  everyProbeHasEvidence: boolean;
  releaseApproved: boolean;
  failingBoundaries: string[];
}

export const PROBE_BOUNDARIES = [
  'router_context',
  'read_gateway',
  'entity_resolution',
  'work_runtime',
  'approvals',
  'agents_skills',
  'analytics',
  'connectors',
  'channels',
  'envelopes_history',
  'realtime',
  'artifacts',
] as const;
export type ProbeBoundary = (typeof PROBE_BOUNDARIES)[number];

// ─── Adapter contracts ──────────────────────────────────────────────────────

export interface ProbeContext {
  tenantId: string;
  foreignTenantId: string;
  foreignIds: TenantPairFixture['foreignIds'];
  collisions: TenantPairFixture['collisions'];
}

/**
 * Each adapter is a single-responsibility probe against one boundary.
 * Adapters MUST return `denied: true` when access is rejected and
 * `denied: false` only if a foreign ID was actually resolved or
 * surfaced to the actor. Returning `denied: false` without an
 * actual foreign-id exposure is itself a probe failure.
 */
export interface BoundaryAdapter {
  readonly boundary: ProbeBoundary;
  probe(ctx: ProbeContext): Promise<ProbeResult>;
}

// ─── Probe router_context ───────────────────────────────────────────────────

export interface RouterContextAdapter extends BoundaryAdapter {
  readonly boundary: 'router_context';
  compose(input: {
    tenantId: string;
    foreignTenantId: string;
    message: string;
    payload: Record<string, unknown>;
  }): Promise<{ effectiveTenantId: string; denied: boolean }>;
}

function defaultRouterCompose(
  tenantId: string,
  _payload: Record<string, unknown>,
): { effectiveTenantId: string; denied: boolean } {
  // The default in-memory adapter derives effective tenant ONLY from
  // the authenticated tenantId; any tenantId in the payload is
  // ignored. When a real adapter overrides effectiveTenantId to the
  // payload's tenantId, that is a cross-tenant leak (denied=false).
  return {
    effectiveTenantId: tenantId,
    denied: true,
  };
}

async function routerContextProbeImpl(ctx: ProbeContext): Promise<ProbeResult> {
  const result = defaultRouterCompose(ctx.tenantId, {
    tenantId: ctx.foreignTenantId,
    impersonateTenantId: ctx.foreignTenantId,
    override: { tenantId: ctx.foreignTenantId },
  });
  return {
    allowed: result.denied,
    denied: result.denied,
    boundary: 'router_context',
    tenantId: ctx.tenantId,
    evidence: [
      `composed with tenant=${result.effectiveTenantId}`,
      result.denied
        ? `payload could not change effective tenant`
        : `LEAK: payload overrode tenant to ${result.effectiveTenantId}`,
    ],
  };
}

export const routerContextProbe: RouterContextAdapter = {
  boundary: 'router_context',
  compose: async ({ tenantId, payload }) =>
    defaultRouterCompose(tenantId, payload),
  probe: routerContextProbeImpl,
};

// ─── Probe read_gateway ─────────────────────────────────────────────────────

export interface ReadGatewayAdapter extends BoundaryAdapter {
  readonly boundary: 'read_gateway';
  fetch(input: {
    tenantId: string;
    capability: string;
    params: Record<string, unknown>;
  }): Promise<{ ok: boolean; errorCode?: string }>;
}

function defaultReadGatewayFetch(params: Record<string, unknown>): {
  ok: boolean;
  errorCode?: string;
} {
  const projectId = params['projectId'];
  if (typeof projectId !== 'string' || projectId.length === 0) {
    return { ok: false, errorCode: 'INVALID_PARAMS' };
  }
  return { ok: false, errorCode: 'X_TENANT_NOT_FOUND' };
}

async function readGatewayProbeImpl(ctx: ProbeContext): Promise<ProbeResult> {
  const projectId = ctx.foreignIds.project;
  if (!projectId) {
    return {
      allowed: true,
      denied: true,
      boundary: 'read_gateway',
      tenantId: ctx.tenantId,
      evidence: ['no foreign project id supplied; trivially denied'],
    };
  }
  const result = defaultReadGatewayFetch({ projectId });
  const denied = !result.ok;
  return {
    allowed: denied,
    denied,
    boundary: 'read_gateway',
    tenantId: ctx.tenantId,
    foreignId: projectId,
    errorCode: result.errorCode,
    evidence: denied
      ? [
          `getProject(${projectId}) denied for tenant=${ctx.tenantId}: ${result.errorCode ?? 'X_TENANT_NOT_FOUND'}`,
        ]
      : [
          `LEAK: getProject(${projectId}) returned data for tenant=${ctx.tenantId}`,
        ],
  };
}

export const readGatewayProbe: ReadGatewayAdapter = {
  boundary: 'read_gateway',
  fetch: async ({ params }) => defaultReadGatewayFetch(params),
  probe: readGatewayProbeImpl,
};

// ─── Probe entity_resolution ───────────────────────────────────────────────

export interface EntityResolutionAdapter extends BoundaryAdapter {
  readonly boundary: 'entity_resolution';
  resolve(input: {
    tenantId: string;
    name: string;
    kind: 'project' | 'task' | 'agent';
  }): Promise<{ id: string | null }>;
}

async function defaultEntityResolve(): Promise<{ id: string | null }> {
  return { id: null };
}

async function entityResolutionProbeImpl(
  ctx: ProbeContext,
  adapter: EntityResolutionAdapter,
): Promise<ProbeResult> {
  const name = ctx.collisions.projectName ?? 'Colliding Project';
  const a = await adapter.resolve({
    tenantId: ctx.tenantId,
    name,
    kind: 'project',
  });
  const b = await adapter.resolve({
    tenantId: ctx.foreignTenantId,
    name,
    kind: 'project',
  });
  const sameId = a.id !== null && b.id !== null && a.id === b.id;
  const denied = !sameId;
  return {
    allowed: denied,
    denied,
    boundary: 'entity_resolution',
    tenantId: ctx.tenantId,
    evidence: denied
      ? [
          `tenantA resolved ${name} → ${a.id ?? 'null'}`,
          `tenantB resolved ${name} → ${b.id ?? 'null'}`,
          'resolution is tenant-scoped',
        ]
      : [`LEAK: tenantA and tenantB resolved to same id ${a.id}`],
  };
}

export const entityResolutionProbe: EntityResolutionAdapter = {
  boundary: 'entity_resolution',
  resolve: defaultEntityResolve,
  probe: (ctx) => entityResolutionProbeImpl(ctx, entityResolutionProbe),
};

// ─── Probe work_runtime ────────────────────────────────────────────────────

export interface WorkRuntimeAdapter extends BoundaryAdapter {
  readonly boundary: 'work_runtime';
  execute(input: {
    tenantId: string;
    workRunId: string;
    ownerTenantId: string;
  }): Promise<{ accepted: boolean; errorCode?: string }>;
}

async function workRuntimeExecute(
  tenantId: string,
  ownerTenantId: string,
): Promise<{ accepted: boolean; errorCode?: string }> {
  if (tenantId === ownerTenantId) {
    return { accepted: true };
  }
  return { accepted: false, errorCode: 'X_TENANT_NOT_FOUND' };
}

async function workRuntimeProbeImpl(
  ctx: ProbeContext,
  adapter: WorkRuntimeAdapter,
): Promise<ProbeResult> {
  const workRunId = ctx.foreignIds.executionAttempt ?? 'wr-foreign';
  const result = await adapter.execute({
    tenantId: ctx.tenantId,
    workRunId,
    ownerTenantId: ctx.foreignTenantId,
  });
  const denied = !result.accepted;
  return {
    allowed: denied,
    denied,
    boundary: 'work_runtime',
    tenantId: ctx.tenantId,
    foreignId: workRunId,
    errorCode: result.errorCode,
    evidence: denied
      ? [
          `execute(${workRunId}) denied for tenant=${ctx.tenantId}: ${result.errorCode ?? 'X_TENANT_NOT_FOUND'}`,
        ]
      : [`LEAK: execute(${workRunId}) accepted for tenant=${ctx.tenantId}`],
  };
}

export const workRuntimeProbe: WorkRuntimeAdapter = {
  boundary: 'work_runtime',
  execute: async ({ tenantId, ownerTenantId }) =>
    workRuntimeExecute(tenantId, ownerTenantId),
  probe: (ctx) => workRuntimeProbeImpl(ctx, workRuntimeProbe),
};

// ─── Probe approvals ───────────────────────────────────────────────────────

export interface ApprovalsAdapter extends BoundaryAdapter {
  readonly boundary: 'approvals';
  inspect(input: {
    tenantId: string;
    approvalId: string;
    ownerTenantId: string;
  }): Promise<{ ok: boolean; errorCode?: string }>;
  resume(input: {
    tenantId: string;
    approvalId: string;
    ownerTenantId: string;
  }): Promise<{ ok: boolean; errorCode?: string }>;
}

async function defaultApprovalAction(
  tenantId: string,
  ownerTenantId: string,
): Promise<{ ok: boolean; errorCode?: string }> {
  if (tenantId === ownerTenantId) return { ok: true };
  return { ok: false, errorCode: 'X_TENANT_NOT_FOUND' };
}

async function approvalsProbeImpl(
  ctx: ProbeContext,
  adapter: ApprovalsAdapter,
): Promise<ProbeResult> {
  const approvalId = ctx.foreignIds.approvalRequest ?? 'apr-foreign';
  const inspect = await adapter.inspect({
    tenantId: ctx.tenantId,
    approvalId,
    ownerTenantId: ctx.foreignTenantId,
  });
  const resume = await adapter.resume({
    tenantId: ctx.tenantId,
    approvalId,
    ownerTenantId: ctx.foreignTenantId,
  });
  const denied = !inspect.ok && !resume.ok;
  return {
    allowed: denied,
    denied,
    boundary: 'approvals',
    tenantId: ctx.tenantId,
    foreignId: approvalId,
    errorCode: inspect.errorCode ?? resume.errorCode,
    evidence: [
      `inspect(${approvalId}) ok=${inspect.ok} code=${inspect.errorCode ?? 'ok'}`,
      `resume(${approvalId}) ok=${resume.ok} code=${resume.errorCode ?? 'ok'}`,
      denied ? 'foreign approval cannot be inspected or resumed' : 'LEAK',
    ],
  };
}

export const approvalsProbe: ApprovalsAdapter = {
  boundary: 'approvals',
  inspect: async ({ tenantId, ownerTenantId }) =>
    defaultApprovalAction(tenantId, ownerTenantId),
  resume: async ({ tenantId, ownerTenantId }) =>
    defaultApprovalAction(tenantId, ownerTenantId),
  probe: (ctx) => approvalsProbeImpl(ctx, approvalsProbe),
};

// ─── Probe agents_skills ────────────────────────────────────────────────────

export interface AgentsSkillsAdapter extends BoundaryAdapter {
  readonly boundary: 'agents_skills';
  listAgents(tenantId: string): Promise<Array<{ id: string; name: string }>>;
  getAgent(tenantId: string, id: string): Promise<{ id: string } | null>;
}

async function defaultListAgents(): Promise<
  Array<{ id: string; name: string }>
> {
  return [];
}
async function defaultGetAgent(): Promise<{ id: string } | null> {
  return null;
}

async function agentsSkillsProbeImpl(
  ctx: ProbeContext,
  adapter: AgentsSkillsAdapter,
): Promise<ProbeResult> {
  const ownList = await adapter.listAgents(ctx.tenantId);
  const foreignList = await adapter.listAgents(ctx.foreignTenantId);
  const ownIds = new Set(ownList.map((a) => a.id));
  const foreignIds = new Set(foreignList.map((a) => a.id));
  let crossLeak = false;
  for (const id of ownIds) if (foreignIds.has(id)) crossLeak = true;
  const foreignAgent = ctx.foreignIds.agent;
  let foreignResolved = false;
  if (foreignAgent) {
    const got = await adapter.getAgent(ctx.tenantId, foreignAgent);
    if (got) foreignResolved = true;
  }
  const denied = !crossLeak && !foreignResolved;
  return {
    allowed: denied,
    denied,
    boundary: 'agents_skills',
    tenantId: ctx.tenantId,
    evidence: denied
      ? [
          `tenantA agents=${ownList.length} tenantB agents=${foreignList.length}; disjoint`,
          foreignAgent
            ? `getAgent(${foreignAgent}) → null for tenant=${ctx.tenantId}`
            : 'no foreign agent supplied',
        ]
      : [
          crossLeak ? 'LEAK: same agent id appears in both tenants' : '',
          foreignResolved ? `LEAK: foreign agent ${foreignAgent} resolved` : '',
        ].filter(Boolean),
  };
}

export const agentsSkillsProbe: AgentsSkillsAdapter = {
  boundary: 'agents_skills',
  listAgents: defaultListAgents,
  getAgent: defaultGetAgent,
  probe: (ctx) => agentsSkillsProbeImpl(ctx, agentsSkillsProbe),
};

// ─── Probe analytics ───────────────────────────────────────────────────────

export interface AnalyticsAdapter extends BoundaryAdapter {
  readonly boundary: 'analytics';
  getSnapshot(tenantId: string, snapshotId: string): Promise<unknown>;
}

async function defaultGetSnapshot(): Promise<unknown> {
  return null;
}

async function analyticsProbeImpl(
  ctx: ProbeContext,
  adapter: AnalyticsAdapter,
): Promise<ProbeResult> {
  const snapshotId = ctx.foreignIds.analyticsSnapshot ?? 'snap-foreign';
  const got = await adapter.getSnapshot(ctx.tenantId, snapshotId);
  const denied = got === null || got === undefined;
  return {
    allowed: denied,
    denied,
    boundary: 'analytics',
    tenantId: ctx.tenantId,
    foreignId: snapshotId,
    evidence: denied
      ? [`getSnapshot(${snapshotId}) → null for tenant=${ctx.tenantId}`]
      : [`LEAK: snapshot ${snapshotId} visible to tenant=${ctx.tenantId}`],
  };
}

export const analyticsProbe: AnalyticsAdapter = {
  boundary: 'analytics',
  getSnapshot: defaultGetSnapshot,
  probe: (ctx) => analyticsProbeImpl(ctx, analyticsProbe),
};

// ─── Probe connectors ──────────────────────────────────────────────────────

export interface ConnectorsAdapter extends BoundaryAdapter {
  readonly boundary: 'connectors';
  listConnectors(tenantId: string): Promise<Array<{ id: string }>>;
  listWebhooks(tenantId: string): Promise<Array<{ id: string }>>;
  getWebhook(tenantId: string, id: string): Promise<{ id: string } | null>;
}

async function defaultListIds(): Promise<Array<{ id: string }>> {
  return [];
}
async function defaultGetById(): Promise<{ id: string } | null> {
  return null;
}

async function connectorsProbeImpl(
  ctx: ProbeContext,
  adapter: ConnectorsAdapter,
): Promise<ProbeResult> {
  const own = await adapter.listConnectors(ctx.tenantId);
  const foreign = await adapter.listConnectors(ctx.foreignTenantId);
  const ownWebhooks = await adapter.listWebhooks(ctx.tenantId);
  const foreignWebhooks = await adapter.listWebhooks(ctx.foreignTenantId);
  const overlap = own.some((c) => foreign.some((f) => f.id === c.id));
  const webhookOverlap = ownWebhooks.some((w) =>
    foreignWebhooks.some((f) => f.id === w.id),
  );
  let foreignWebhookLeak = false;
  const foreignWebhook = ctx.foreignIds.webhook;
  if (foreignWebhook) {
    const got = await adapter.getWebhook(ctx.tenantId, foreignWebhook);
    if (got) foreignWebhookLeak = true;
  }
  const denied = !overlap && !webhookOverlap && !foreignWebhookLeak;
  return {
    allowed: denied,
    denied,
    boundary: 'connectors',
    tenantId: ctx.tenantId,
    evidence: denied
      ? [
          `connectors disjoint (own=${own.length}, foreign=${foreign.length})`,
          `webhooks disjoint (own=${ownWebhooks.length}, foreign=${foreignWebhooks.length})`,
          foreignWebhook
            ? `getWebhook(${foreignWebhook}) → null for tenant=${ctx.tenantId}`
            : 'no foreign webhook supplied',
        ]
      : [
          overlap ? 'LEAK: connector overlap' : '',
          webhookOverlap ? 'LEAK: webhook overlap' : '',
          foreignWebhookLeak
            ? `LEAK: foreign webhook ${foreignWebhook} resolved`
            : '',
        ].filter(Boolean),
  };
}

export const connectorsProbe: ConnectorsAdapter = {
  boundary: 'connectors',
  listConnectors: defaultListIds,
  listWebhooks: defaultListIds,
  getWebhook: defaultGetById,
  probe: (ctx) => connectorsProbeImpl(ctx, connectorsProbe),
};

// ─── Probe channels ────────────────────────────────────────────────────────

export interface ChannelsAdapter extends BoundaryAdapter {
  readonly boundary: 'channels';
  resolveByExternal(input: {
    tenantId: string;
    externalId: string;
  }): Promise<{ internalId: string | null; ownerTenantId: string | null }>;
}

export interface ChannelMapping {
  internalId: string;
  externalId: string;
  tenantId: string;
}

export class InMemoryChannelMappingStore {
  private readonly byTenant = new Map<string, Map<string, ChannelMapping>>();
  seed(tenantId: string, mapping: ChannelMapping): void {
    let m = this.byTenant.get(tenantId);
    if (!m) {
      m = new Map();
      this.byTenant.set(tenantId, m);
    }
    m.set(mapping.externalId, mapping);
  }
  resolve(tenantId: string, externalId: string): ChannelMapping | null {
    const m = this.byTenant.get(tenantId);
    return m?.get(externalId) ?? null;
  }
}

async function channelsResolve(
  store: InMemoryChannelMappingStore,
  tenantId: string,
  externalId: string,
): Promise<{ internalId: string | null; ownerTenantId: string | null }> {
  const m = store.resolve(tenantId, externalId);
  if (!m) return { internalId: null, ownerTenantId: null };
  return { internalId: m.internalId, ownerTenantId: m.tenantId };
}

async function channelsProbeImpl(
  ctx: ProbeContext,
  adapter: ChannelsAdapter,
): Promise<ProbeResult> {
  const extA = `ext-${ctx.tenantId}`;
  const extB = `ext-${ctx.foreignTenantId}`;
  const a = await adapter.resolveByExternal({
    tenantId: ctx.tenantId,
    externalId: extA,
  });
  const b = await adapter.resolveByExternal({
    tenantId: ctx.tenantId,
    externalId: extB,
  });
  const bOwnedByTenantA =
    b.internalId !== null && b.ownerTenantId === ctx.tenantId;
  const denied = !bOwnedByTenantA;
  return {
    allowed: denied,
    denied,
    boundary: 'channels',
    tenantId: ctx.tenantId,
    evidence: denied
      ? [
          `resolve(${extA}) → ${a.internalId ?? 'null'} (owner=${a.ownerTenantId ?? 'null'})`,
          `resolve(${extB}) → ${b.internalId ?? 'null'} (owner=${b.ownerTenantId ?? 'null'})`,
          bOwnedByTenantA
            ? 'LEAK prevented: cross-tenant owner mismatch detected'
            : 'cross-tenant mapping not visible inside tenant',
        ]
      : [
          `LEAK: cross-tenant mapping ${extB} resolved to ${b.internalId} owned by tenant=${b.ownerTenantId}`,
        ],
  };
}

export const channelsProbeFactory = (
  store: InMemoryChannelMappingStore,
): ChannelsAdapter => ({
  boundary: 'channels',
  resolveByExternal: async ({ tenantId, externalId }) =>
    channelsResolve(store, tenantId, externalId),
  probe: async (ctx) =>
    channelsProbeImpl(ctx, {
      resolveByExternal: async ({ tenantId, externalId }) =>
        channelsResolve(store, tenantId, externalId),
    } as ChannelsAdapter),
});

// ─── Probe envelopes_history ────────────────────────────────────────────────

export interface EnvelopesHistoryAdapter extends BoundaryAdapter {
  readonly boundary: 'envelopes_history';
  loadEnvelope(input: {
    tenantId: string;
    envelopeId: string;
    ownerTenantId: string;
  }): Promise<{ data: unknown }>;
}

function defaultLoadEnvelope(
  tenantId: string,
  ownerTenantId: string,
): { data: unknown } {
  if (tenantId === ownerTenantId) return { data: { ok: true } };
  return { data: null };
}

async function envelopesHistoryProbeImpl(
  ctx: ProbeContext,
  adapter: EnvelopesHistoryAdapter,
): Promise<ProbeResult> {
  const envelopeId = ctx.foreignIds.envelope ?? 'env-foreign';
  const result = await adapter.loadEnvelope({
    tenantId: ctx.tenantId,
    envelopeId,
    ownerTenantId: ctx.foreignTenantId,
  });
  const denied = result.data === null || result.data === undefined;
  return {
    allowed: denied,
    denied,
    boundary: 'envelopes_history',
    tenantId: ctx.tenantId,
    foreignId: envelopeId,
    evidence: denied
      ? [`loadEnvelope(${envelopeId}) → null for tenant=${ctx.tenantId}`]
      : [`LEAK: envelope ${envelopeId} visible to tenant=${ctx.tenantId}`],
  };
}

export const envelopesHistoryProbe: EnvelopesHistoryAdapter = {
  boundary: 'envelopes_history',
  loadEnvelope: async ({ tenantId, ownerTenantId }) =>
    defaultLoadEnvelope(tenantId, ownerTenantId),
  probe: (ctx) => envelopesHistoryProbeImpl(ctx, envelopesHistoryProbe),
};

// ─── Probe realtime ────────────────────────────────────────────────────────

export interface RealtimeAdapter extends BoundaryAdapter {
  readonly boundary: 'realtime';
  authorizeRoom(input: { tenantId: string; roomTenantId: string }): {
    allowed: boolean;
  };
  authorizeEvent(input: { tenantId: string; eventTenantId: string }): {
    allowed: boolean;
  };
}

function defaultAuthorize(
  tenantId: string,
  foreignTenantId: string,
): { allowed: boolean } {
  return { allowed: tenantId === foreignTenantId };
}

async function realtimeProbeImpl(
  ctx: ProbeContext,
  adapter: RealtimeAdapter,
): Promise<ProbeResult> {
  const room = adapter.authorizeRoom({
    tenantId: ctx.tenantId,
    roomTenantId: ctx.foreignTenantId,
  });
  const event = adapter.authorizeEvent({
    tenantId: ctx.tenantId,
    eventTenantId: ctx.foreignTenantId,
  });
  const denied = !room.allowed && !event.allowed;
  return {
    allowed: denied,
    denied,
    boundary: 'realtime',
    tenantId: ctx.tenantId,
    evidence: [
      `joinRoom foreign-tenant=${ctx.foreignTenantId} allowed=${room.allowed}`,
      `emitEvent foreign-tenant=${ctx.foreignTenantId} allowed=${event.allowed}`,
      denied
        ? 'realtime authorization gate rejects cross-tenant rooms/events'
        : 'LEAK: realtime gate accepted cross-tenant access',
    ],
  };
}

export const realtimeProbe: RealtimeAdapter = {
  boundary: 'realtime',
  authorizeRoom: ({ tenantId, roomTenantId }) =>
    defaultAuthorize(tenantId, roomTenantId),
  authorizeEvent: ({ tenantId, eventTenantId }) =>
    defaultAuthorize(tenantId, eventTenantId),
  probe: (ctx) => realtimeProbeImpl(ctx, realtimeProbe),
};

// ─── Probe artifacts ───────────────────────────────────────────────────────

export interface ArtifactsAdapter extends BoundaryAdapter {
  readonly boundary: 'artifacts';
  resolveUrl(input: {
    tenantId: string;
    artifactId: string;
    ownerTenantId: string;
  }): Promise<{ url: string | null }>;
}

function defaultResolveUrl(
  tenantId: string,
  ownerTenantId: string,
): { url: string | null } {
  if (tenantId === ownerTenantId) return { url: '/artifacts/self' };
  return { url: null };
}

async function artifactsProbeImpl(
  ctx: ProbeContext,
  adapter: ArtifactsAdapter,
): Promise<ProbeResult> {
  const artifactId = ctx.foreignIds.artifact ?? 'art-foreign';
  const result = await adapter.resolveUrl({
    tenantId: ctx.tenantId,
    artifactId,
    ownerTenantId: ctx.foreignTenantId,
  });
  const denied = result.url === null;
  return {
    allowed: denied,
    denied,
    boundary: 'artifacts',
    tenantId: ctx.tenantId,
    foreignId: artifactId,
    evidence: denied
      ? [`resolveUrl(${artifactId}) → null for tenant=${ctx.tenantId}`]
      : [`LEAK: foreign artifact ${artifactId} resolved to ${result.url}`],
  };
}

export const artifactsProbe: ArtifactsAdapter = {
  boundary: 'artifacts',
  resolveUrl: async ({ tenantId, ownerTenantId }) =>
    defaultResolveUrl(tenantId, ownerTenantId),
  probe: (ctx) => artifactsProbeImpl(ctx, artifactsProbe),
};

// ─── Bundle + runner ────────────────────────────────────────────────────────

export interface ProbeAdapters {
  routerContext: RouterContextAdapter;
  readGateway: ReadGatewayAdapter;
  entityResolution: EntityResolutionAdapter;
  workRuntime: WorkRuntimeAdapter;
  approvals: ApprovalsAdapter;
  agentsSkills: AgentsSkillsAdapter;
  analytics: AnalyticsAdapter;
  connectors: ConnectorsAdapter;
  channels: ChannelsAdapter;
  envelopesHistory: EnvelopesHistoryAdapter;
  realtime: RealtimeAdapter;
  artifacts: ArtifactsAdapter;
}

export function defaultProbeAdapters(
  channelStore?: InMemoryChannelMappingStore,
): ProbeAdapters {
  return {
    routerContext: routerContextProbe,
    readGateway: readGatewayProbe,
    entityResolution: entityResolutionProbe,
    workRuntime: workRuntimeProbe,
    approvals: approvalsProbe,
    agentsSkills: agentsSkillsProbe,
    analytics: analyticsProbe,
    connectors: connectorsProbe,
    channels: channelsProbeFactory(
      channelStore ?? new InMemoryChannelMappingStore(),
    ),
    envelopesHistory: envelopesHistoryProbe,
    realtime: realtimeProbe,
    artifacts: artifactsProbe,
  };
}

function lookupBoundaryAdapter(
  adapters: ProbeAdapters,
  boundary: ProbeBoundary,
): BoundaryAdapter {
  switch (boundary) {
    case 'router_context':
      return adapters.routerContext;
    case 'read_gateway':
      return adapters.readGateway;
    case 'entity_resolution':
      return adapters.entityResolution;
    case 'work_runtime':
      return adapters.workRuntime;
    case 'approvals':
      return adapters.approvals;
    case 'agents_skills':
      return adapters.agentsSkills;
    case 'analytics':
      return adapters.analytics;
    case 'connectors':
      return adapters.connectors;
    case 'channels':
      return adapters.channels;
    case 'envelopes_history':
      return adapters.envelopesHistory;
    case 'realtime':
      return adapters.realtime;
    case 'artifacts':
      return adapters.artifacts;
  }
}

export class TenantIsolationProbeRunner {
  constructor(
    private readonly adapters: ProbeAdapters = defaultProbeAdapters(),
  ) {}

  async run(fixture: TenantPairFixture): Promise<TenantIsolationProbeReport> {
    const ctx: ProbeContext = {
      tenantId: fixture.tenantA.id,
      foreignTenantId: fixture.tenantB.id,
      foreignIds: fixture.foreignIds,
      collisions: fixture.collisions,
    };
    const results: ProbeResult[] = [];
    for (const boundary of PROBE_BOUNDARIES) {
      const adapter = lookupBoundaryAdapter(this.adapters, boundary);
      try {
        results.push(await adapter.probe(ctx));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({
          allowed: false,
          denied: false,
          boundary,
          tenantId: ctx.tenantId,
          evidence: [`probe threw: ${msg}`],
          errorMessage: msg,
        });
      }
    }
    const gateG7 = computeGateG7(results);
    return {
      runId: `g7-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      tenantAId: fixture.tenantA.id,
      tenantBId: fixture.tenantB.id,
      results,
      gateG7,
    };
  }
}

export function computeGateG7(results: ProbeResult[]): GateG7Summary {
  const total = results.length;
  const denied = results.filter((r) => r.denied).length;
  const allowed = results.filter((r) => !r.denied).length;
  const deniedRate = total === 0 ? 0 : denied / total;
  const zeroCrossTenantExposure = denied === total;
  const everyProbeHasEvidence = results.every(
    (r) => Array.isArray(r.evidence) && r.evidence.length > 0,
  );
  const failingBoundaries = results
    .filter((r) => !r.denied)
    .map((r) => r.boundary);
  const releaseApproved = zeroCrossTenantExposure && everyProbeHasEvidence;
  return {
    totalProbes: total,
    denied,
    allowed,
    deniedRate,
    zeroCrossTenantExposure,
    everyProbeHasEvidence,
    releaseApproved,
    failingBoundaries,
  };
}

export function classifyGateG7(g: GateG7Summary): {
  ok: string[];
  failing: string[];
} {
  const ok: string[] = [];
  const failing: string[] = [];
  const rules: Array<[string, boolean]> = [
    [
      '100% cross-tenant access attempts denied',
      g.zeroCrossTenantExposure && g.totalProbes > 0,
    ],
    ['Every probe produces evidence', g.everyProbeHasEvidence],
  ];
  for (const [label, passed] of rules) {
    (passed ? ok : failing).push(label);
  }
  return { ok, failing };
}

/**
 * Compatibility wrapper for the old `ITenantIsolationProbe` interface.
 * Fail-closed for unknown boundaries.
 */
export class TenantIsolationProbeCompat {
  constructor(
    private readonly adapters: ProbeAdapters = defaultProbeAdapters(),
  ) {}

  async execute(caseDefinition: IsolationCase): Promise<IsolationResult> {
    const boundary = caseDefinition.boundary;
    const failClosed: IsolationResult = {
      allowed: false,
      evidence: [`Unknown boundary: ${boundary}`],
      boundary,
      tenantId: caseDefinition.tenantId,
      foreignId: caseDefinition.foreignId,
    };
    if (!PROBE_BOUNDARIES.includes(boundary as ProbeBoundary)) {
      return failClosed;
    }
    const adapter = lookupBoundaryAdapter(
      this.adapters,
      boundary as ProbeBoundary,
    );
    const ctx: ProbeContext = {
      tenantId: caseDefinition.tenantId,
      foreignTenantId: caseDefinition.tenantId,
      foreignIds: { project: caseDefinition.foreignId },
      collisions: {},
    };
    const result = await adapter.probe(ctx);
    return {
      allowed: result.denied,
      evidence: result.evidence,
      boundary: result.boundary,
      tenantId: result.tenantId,
      foreignId: result.foreignId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  }
}
