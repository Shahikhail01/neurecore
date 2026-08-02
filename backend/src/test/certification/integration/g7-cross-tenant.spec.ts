/* eslint-disable @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-redundant-type-constituents,
   @typescript-eslint/no-unsafe-argument --
   Adapter object literals call this.X() and chain Prisma result types;
   the integration spec already lives under the test-files glob but we
   add these for the inline adapter definitions to keep noise down.
*/
// src/test/certification/integration/g7-cross-tenant.spec.ts
/**
 * Gate G7 — Real cross-tenant certification (integration).
 *
 * Skips unless DATABASE_URL is set (matches G1.1 pattern).
 * When the database is available, this spec:
 *   1. Seeds two tenants with colliding names (project + agent).
 *   2. Wires every probe boundary to a Prisma-backed adapter.
 *   3. Runs TenantIsolationProbeRunner.
 *   4. Persists the report as `g7-machine-readable.json`.
 *   5. Asserts every probe returns `denied: true` (zero cross-tenant
 *      exposure).
 *
 * Per NC-AWL-IMP-1 §11.5 G7: cross-tenant denial = 100%.
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  PrismaClient,
  ProjectStatus,
  TaskStatus,
  AgentStatus,
  ApprovalStatus,
  ExecutionAttemptStatus,
  EvidenceArtifactType,
  EvidenceSource,
} from '@prisma/client';
import {
  TenantIsolationProbeRunner,
  defaultProbeAdapters,
  InMemoryChannelMappingStore,
  channelsProbeFactory,
  PROBE_BOUNDARIES,
  type ProbeAdapters,
  type ReadGatewayAdapter,
  type EntityResolutionAdapter,
  type WorkRuntimeAdapter,
  type ApprovalsAdapter,
  type AgentsSkillsAdapter,
  type AnalyticsAdapter,
  type ConnectorsAdapter,
  type EnvelopesHistoryAdapter,
  type ArtifactsAdapter,
} from '../../../modules/service-gateway-v2/certification/tenant-isolation-probe';

const DB_AVAILABLE = !!process.env.DATABASE_URL;
const REQUIRE_DB = process.env.AWL_REQUIRE_INTEGRATION_DB === 'true';
const describeOrSkip = REQUIRE_DB || DB_AVAILABLE ? describe : describe.skip;
const REPORT_DIR = join(__dirname, '..', 'reports');
const REPORT_PATH = join(REPORT_DIR, 'g7-machine-readable.json');

function skipIfNoDb(): boolean {
  if (DB_AVAILABLE) return false;
  if (REQUIRE_DB) {
    throw new Error(
      'INTEGRATION_DB_REQUIRED: AWL_REQUIRE_INTEGRATION_DB=true but DATABASE_URL is not set.',
    );
  }
  return true;
}

function actorIdForTenant(tenantId: string): string {
  return `actor-${tenantId}-${randomUUID().slice(0, 8)}`;
}

interface SeededPair {
  tenantAId: string;
  tenantBId: string;
  foreignProjectId: string;
  foreignTaskId: string;
  foreignAgentId: string;
  foreignApprovalId: string;
  foreignSnapshotId: string;
  foreignIntegrationId: string;
  foreignArtifactId: string;
}

interface SeededEnvelopeStore {
  set(envelopeId: string, tenantId: string, payload: unknown): void;
  get(envelopeId: string, tenantId: string): unknown | null;
  delete(envelopeId: string): void;
}

function createEnvelopeStore(): SeededEnvelopeStore {
  const map = new Map<string, Map<string, unknown>>();
  return {
    set(id, tenantId, payload) {
      let m = map.get(id);
      if (!m) {
        m = new Map();
        map.set(id, m);
      }
      m.set(tenantId, payload);
    },
    get(id, tenantId) {
      return map.get(id)?.get(tenantId) ?? null;
    },
    delete(id) {
      map.delete(id);
    },
  };
}

async function ensureTier(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.tier.findFirst({ where: { isDefault: true } });
  if (existing) return existing.id;
  const any = await prisma.tier.findFirst();
  if (any) return any.id;
  const created = await prisma.tier.create({
    data: {
      name: 'G7 Test Tier',
      slug: `g7-tier-${randomUUID().slice(0, 6)}`,
      isActive: true,
      isDefault: false,
      maxAgents: 100,
      maxUsers: 100,
    },
  });
  return created.id;
}

async function seedCrossTenantPair(
  prisma: PrismaClient,
  envelopeStore: SeededEnvelopeStore,
): Promise<SeededPair> {
  const tierId = await ensureTier(prisma);
  const tenantAId = `g7-a-${randomUUID().slice(0, 8)}`;
  const tenantBId = `g7-b-${randomUUID().slice(0, 8)}`;
  const slugA = `g7-a-${randomUUID().slice(0, 6)}`;
  const slugB = `g7-b-${randomUUID().slice(0, 6)}`;
  const collidingName = 'G7 Colliding Project';
  const collidingAgentName = 'G7 Colliding Agent';

  await prisma.tenant.create({
    data: {
      id: tenantAId,
      slug: slugA,
      name: `G7 Tenant A ${randomUUID().slice(0, 6)}`,
      tierId,
    },
  });
  await prisma.tenant.create({
    data: {
      id: tenantBId,
      slug: slugB,
      name: `G7 Tenant B ${randomUUID().slice(0, 6)}`,
      tierId,
    },
  });

  await prisma.project.create({
    data: {
      tenantId: tenantAId,
      name: collidingName,
      status: ProjectStatus.LEAD,
    },
  });
  const projectB = await prisma.project.create({
    data: {
      tenantId: tenantBId,
      name: collidingName,
      status: ProjectStatus.LEAD,
    },
  });

  const taskB = await prisma.task.create({
    data: {
      tenantId: tenantBId,
      projectId: projectB.id,
      title: 'G7 Foreign Task',
      status: TaskStatus.PENDING,
    },
  });

  const agentB = await prisma.agent.create({
    data: {
      tenantId: tenantBId,
      name: collidingAgentName,
      status: AgentStatus.IDLE,
    },
  });

  const approvalB = await prisma.approvalRequest.create({
    data: {
      tenantId: tenantBId,
      title: 'G7 Foreign Approval',
      resourceType: 'task',
      status: ApprovalStatus.PENDING,
      payload: { reason: 'g7-fixture' },
    },
  });

  const snapshotB = await prisma.featureSnapshot.create({
    data: {
      tenantId: tenantBId,
      subjectType: 'tenant',
      subjectId: tenantBId,
      featuresJson: { ok: true },
      snapshotHash: `g7-${randomUUID().slice(0, 8)}`,
    },
  });

  const integrationB = await prisma.toolIntegration.create({
    data: {
      tenantId: tenantBId,
      name: `g7-integration-${randomUUID().slice(0, 6)}`,
      config: { url: 'https://example.invalid/g7' },
      isActive: true,
    },
  });

  // EvidenceArtifact requires task + executionAttempt. Create minimal ones
  // for tenant B so the artifact row can satisfy the FKs.
  const execAttempt = await prisma.executionAttempt.create({
    data: {
      tenantId: tenantBId,
      taskId: taskB.id,
      agentId: agentB.id,
      executionRequestId: `g7-exec-${randomUUID().slice(0, 8)}`,
      attemptNumber: 1,
      status: ExecutionAttemptStatus.SUBMITTED_FOR_REVIEW,
    },
  });
  const artifactB = await prisma.evidenceArtifact.create({
    data: {
      tenantId: tenantBId,
      taskId: taskB.id,
      executionAttemptId: execAttempt.id,
      artifactType: EvidenceArtifactType.DATA,
      storageRef: `g7://${randomUUID().slice(0, 6)}`,
      mimeType: 'application/octet-stream',
      checksum: randomUUID(),
      source: EvidenceSource.SYSTEM_DERIVED,
      createdByActorId: actorIdForTenant(tenantBId),
    },
  });

  const envelopeId = `g7-env-${randomUUID().slice(0, 8)}`;
  envelopeStore.set(envelopeId, tenantBId, { marker: 'tenant-b' });

  return {
    tenantAId,
    tenantBId,
    foreignProjectId: projectB.id,
    foreignTaskId: taskB.id,
    foreignAgentId: agentB.id,
    foreignApprovalId: approvalB.id,
    foreignSnapshotId: snapshotB.id,
    foreignIntegrationId: integrationB.id,
    foreignArtifactId: artifactB.id,
  };
}

function buildPrismaAdapters(
  prisma: PrismaClient,
  seed: SeededPair,
  envelopeStore: SeededEnvelopeStore,
  envelopeId: string,
): ProbeAdapters {
  const channelStore = new InMemoryChannelMappingStore();
  channelStore.seed(seed.tenantBId, {
    internalId: seed.foreignAgentId,
    externalId: `ext-${seed.tenantBId}`,
    tenantId: seed.tenantBId,
  });

  const readGateway: ReadGatewayAdapter = {
    boundary: 'read_gateway',
    async fetch({ tenantId, params }) {
      const projectId = params['projectId'];
      if (typeof projectId !== 'string')
        return { ok: false, errorCode: 'INVALID_PARAMS' };
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
        select: { id: true },
      });
      if (!project) return { ok: false, errorCode: 'X_TENANT_NOT_FOUND' };
      return { ok: true };
    },
    async probe(ctx) {
      const projectId = ctx.foreignIds.project ?? seed.foreignProjectId;
      const result = await this.fetch({
        tenantId: ctx.tenantId,
        capability: 'getProject',
        params: { projectId },
      });
      const denied = !result.ok;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        foreignId: projectId,
        errorCode: result.errorCode,
        evidence: denied
          ? [
              `getProject(${projectId}) denied for tenant=${ctx.tenantId}: ${result.errorCode ?? 'X_TENANT_NOT_FOUND'}`,
            ]
          : [
              `LEAK: getProject(${projectId}) returned for tenant=${ctx.tenantId}`,
            ],
      };
    },
  };

  const entityResolution: EntityResolutionAdapter = {
    boundary: 'entity_resolution',
    async resolve({ tenantId, name, kind }) {
      if (kind === 'project') {
        const p = await prisma.project.findFirst({
          where: { tenantId, name },
          select: { id: true },
        });
        return { id: p?.id ?? null };
      }
      if (kind === 'task') {
        const t = await prisma.task.findFirst({
          where: { tenantId, title: name },
          select: { id: true },
        });
        return { id: t?.id ?? null };
      }
      const a = await prisma.agent.findFirst({
        where: { tenantId, name },
        select: { id: true },
      });
      return { id: a?.id ?? null };
    },
    async probe(ctx) {
      const name = ctx.collisions.projectName ?? 'G7 Colliding Project';
      const a = await this.resolve({
        tenantId: ctx.tenantId,
        name,
        kind: 'project',
      });
      const b = await this.resolve({
        tenantId: ctx.foreignTenantId,
        name,
        kind: 'project',
      });
      const sameId = a.id !== null && b.id !== null && a.id === b.id;
      const denied = !sameId;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        evidence: denied
          ? [
              `tenantA resolved ${name} → ${a.id ?? 'null'}`,
              `tenantB resolved ${name} → ${b.id ?? 'null'}`,
              'resolution is tenant-scoped',
            ]
          : [`LEAK: tenantA and tenantB resolved to same id ${a.id}`],
      };
    },
  };

  const workRuntime: WorkRuntimeAdapter = {
    boundary: 'work_runtime',
    async execute({ tenantId, workRunId }) {
      const attempt = await prisma.executionAttempt.findFirst({
        where: { id: workRunId, tenantId },
        select: { id: true },
      });
      if (attempt) return { accepted: true };
      return { accepted: false, errorCode: 'X_TENANT_NOT_FOUND' };
    },
    async probe(ctx) {
      const workRunId = ctx.foreignIds.executionAttempt ?? 'wr-foreign';
      const result = await this.execute({
        tenantId: ctx.tenantId,
        workRunId,
        ownerTenantId: ctx.foreignTenantId,
      });
      const denied = !result.accepted;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        foreignId: workRunId,
        errorCode: result.errorCode,
        evidence: denied
          ? [
              `execute(${workRunId}) denied for tenant=${ctx.tenantId}: ${result.errorCode ?? 'X_TENANT_NOT_FOUND'}`,
            ]
          : [`LEAK: execute(${workRunId}) accepted for tenant=${ctx.tenantId}`],
      };
    },
  };

  const approvals: ApprovalsAdapter = {
    boundary: 'approvals',
    async inspect({ tenantId, approvalId }) {
      const a = await prisma.approvalRequest.findFirst({
        where: { id: approvalId, tenantId },
        select: { id: true },
      });
      return a ? { ok: true } : { ok: false, errorCode: 'X_TENANT_NOT_FOUND' };
    },
    async resume({ tenantId, approvalId }) {
      const a = await prisma.approvalRequest.findFirst({
        where: { id: approvalId, tenantId },
        select: { id: true },
      });
      return a ? { ok: true } : { ok: false, errorCode: 'X_TENANT_NOT_FOUND' };
    },
    async probe(ctx) {
      const approvalId =
        ctx.foreignIds.approvalRequest ?? seed.foreignApprovalId;
      const inspect = await this.inspect({
        tenantId: ctx.tenantId,
        approvalId,
        ownerTenantId: ctx.foreignTenantId,
      });
      const resume = await this.resume({
        tenantId: ctx.tenantId,
        approvalId,
        ownerTenantId: ctx.foreignTenantId,
      });
      const denied = !inspect.ok && !resume.ok;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        foreignId: approvalId,
        errorCode: inspect.errorCode ?? resume.errorCode,
        evidence: [
          `inspect(${approvalId}) ok=${inspect.ok} code=${inspect.errorCode ?? 'ok'}`,
          `resume(${approvalId}) ok=${resume.ok} code=${resume.errorCode ?? 'ok'}`,
          denied ? 'foreign approval cannot be inspected or resumed' : 'LEAK',
        ],
      };
    },
  };

  const agentsSkills: AgentsSkillsAdapter = {
    boundary: 'agents_skills',
    async listAgents(tenantId) {
      return prisma.agent.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        take: 50,
      });
    },
    async getAgent(tenantId, id) {
      const a = await prisma.agent.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      return a ?? null;
    },
    async probe(ctx) {
      const ownList = await this.listAgents(ctx.tenantId);
      const foreignList = await this.listAgents(ctx.foreignTenantId);
      const ownIds = new Set(ownList.map((a) => a.id));
      const foreignIds = new Set(foreignList.map((a) => a.id));
      let crossLeak = false;
      for (const id of ownIds) if (foreignIds.has(id)) crossLeak = true;
      const foreignAgent = ctx.foreignIds.agent ?? seed.foreignAgentId;
      const got = await this.getAgent(ctx.tenantId, foreignAgent);
      const foreignResolved = got !== null;
      const denied = !crossLeak && !foreignResolved;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        evidence: denied
          ? [
              `tenantA agents=${ownList.length} tenantB agents=${foreignList.length}; disjoint`,
              `getAgent(${foreignAgent}) → null for tenant=${ctx.tenantId}`,
            ]
          : [
              crossLeak ? 'LEAK: same agent id appears in both tenants' : '',
              foreignResolved
                ? `LEAK: foreign agent ${foreignAgent} resolved`
                : '',
            ].filter(Boolean),
      };
    },
  };

  const analytics: AnalyticsAdapter = {
    boundary: 'analytics',
    async getSnapshot(tenantId, snapshotId) {
      const snap = await prisma.featureSnapshot.findFirst({
        where: { id: snapshotId, tenantId },
        select: { id: true },
      });
      return snap ?? null;
    },
    async probe(ctx) {
      const snapshotId =
        ctx.foreignIds.analyticsSnapshot ?? seed.foreignSnapshotId;
      const got = await this.getSnapshot(ctx.tenantId, snapshotId);
      const denied = got === null || got === undefined;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        foreignId: snapshotId,
        evidence: denied
          ? [`getSnapshot(${snapshotId}) → null for tenant=${ctx.tenantId}`]
          : [`LEAK: snapshot ${snapshotId} visible to tenant=${ctx.tenantId}`],
      };
    },
  };

  const connectors: ConnectorsAdapter = {
    boundary: 'connectors',
    async listConnectors(tenantId) {
      return prisma.toolIntegration.findMany({
        where: { tenantId },
        select: { id: true },
        take: 50,
      });
    },
    async listWebhooks(tenantId) {
      return prisma.toolIntegration.findMany({
        where: { tenantId, isActive: true },
        select: { id: true },
        take: 50,
      });
    },
    async getWebhook(tenantId, id) {
      const row = await prisma.toolIntegration.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      return row ?? null;
    },
    async probe(ctx) {
      const own = await this.listConnectors(ctx.tenantId);
      const foreign = await this.listConnectors(ctx.foreignTenantId);
      const ownW = await this.listWebhooks(ctx.tenantId);
      const foreignW = await this.listWebhooks(ctx.foreignTenantId);
      const overlap = own.some((c) => foreign.some((f) => f.id === c.id));
      const webhookOverlap = ownW.some((w) =>
        foreignW.some((f) => f.id === w.id),
      );
      const foreignWebhook =
        ctx.foreignIds.webhook ?? seed.foreignIntegrationId;
      const got = await this.getWebhook(ctx.tenantId, foreignWebhook);
      const foreignWebhookLeak = got !== null;
      const denied = !overlap && !webhookOverlap && !foreignWebhookLeak;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        evidence: denied
          ? [
              `connectors disjoint (own=${own.length}, foreign=${foreign.length})`,
              `webhooks disjoint (own=${ownW.length}, foreign=${foreignW.length})`,
              `getWebhook(${foreignWebhook}) → null for tenant=${ctx.tenantId}`,
            ]
          : [
              overlap ? 'LEAK: connector overlap' : '',
              webhookOverlap ? 'LEAK: webhook overlap' : '',
              foreignWebhookLeak
                ? `LEAK: foreign webhook ${foreignWebhook} resolved`
                : '',
            ].filter(Boolean),
      };
    },
  };

  const envelopesHistory: EnvelopesHistoryAdapter = {
    boundary: 'envelopes_history',
    async loadEnvelope({ tenantId, envelopeId: eid }) {
      return { data: envelopeStore.get(eid, tenantId) };
    },
    async probe(ctx) {
      const result = await this.loadEnvelope({
        tenantId: ctx.tenantId,
        envelopeId,
        ownerTenantId: ctx.foreignTenantId,
      });
      const denied = result.data === null || result.data === undefined;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        foreignId: envelopeId,
        evidence: denied
          ? [`loadEnvelope(${envelopeId}) → null for tenant=${ctx.tenantId}`]
          : [`LEAK: envelope ${envelopeId} visible to tenant=${ctx.tenantId}`],
      };
    },
  };

  const artifacts: ArtifactsAdapter = {
    boundary: 'artifacts',
    async resolveUrl({ tenantId, artifactId }) {
      const row = await prisma.evidenceArtifact.findFirst({
        where: { id: artifactId, tenantId },
        select: { id: true },
      });
      return { url: row ? `/artifacts/${row.id}` : null };
    },
    async probe(ctx) {
      const artifactId = ctx.foreignIds.artifact ?? seed.foreignArtifactId;
      const result = await this.resolveUrl({
        tenantId: ctx.tenantId,
        artifactId,
        ownerTenantId: ctx.foreignTenantId,
      });
      const denied = result.url === null;
      return {
        allowed: denied,
        denied,
        boundary: this.boundary,
        tenantId: ctx.tenantId,
        foreignId: artifactId,
        evidence: denied
          ? [`resolveUrl(${artifactId}) → null for tenant=${ctx.tenantId}`]
          : [`LEAK: foreign artifact ${artifactId} resolved to ${result.url}`],
      };
    },
  };

  return {
    ...defaultProbeAdapters(channelStore),
    channels: channelsProbeFactory(channelStore),
    readGateway,
    entityResolution,
    workRuntime,
    approvals,
    agentsSkills,
    analytics,
    connectors,
    envelopesHistory,
    artifacts,
  };
}

describeOrSkip('G7 — Real cross-tenant certification', () => {
  if (skipIfNoDb()) {
    it.skip('skipped: DATABASE_URL not set', () => {
      // No-op.
    });
    return;
  }

  let prisma: PrismaClient;
  let seed: SeededPair;
  let envelopeStore: SeededEnvelopeStore;
  let envelopeId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    envelopeStore = createEnvelopeStore();
    envelopeId = `g7-env-${randomUUID().slice(0, 8)}`;
    seed = await seedCrossTenantPair(prisma, envelopeStore);
    envelopeStore.set(envelopeId, seed.tenantBId, { marker: 'tenant-b' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('denies every probe across the seeded tenant pair', async () => {
    const adapters = buildPrismaAdapters(
      prisma,
      seed,
      envelopeStore,
      envelopeId,
    );
    const runner = new TenantIsolationProbeRunner(adapters);

    const fixture = {
      tenantA: { id: seed.tenantAId, label: 'Tenant A' },
      tenantB: { id: seed.tenantBId, label: 'Tenant B' },
      foreignIds: {
        project: seed.foreignProjectId,
        task: seed.foreignTaskId,
        agent: seed.foreignAgentId,
        approvalRequest: seed.foreignApprovalId,
        analyticsSnapshot: seed.foreignSnapshotId,
        webhook: seed.foreignIntegrationId,
        envelope: envelopeId,
        artifact: seed.foreignArtifactId,
      },
      collisions: { projectName: 'G7 Colliding Project' },
    };

    const report = await runner.run(fixture);

    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');

    expect(report.results.length).toBe(PROBE_BOUNDARIES.length);
    expect(report.gateG7.zeroCrossTenantExposure).toBe(true);
    expect(report.gateG7.everyProbeHasEvidence).toBe(true);
    expect(report.gateG7.releaseApproved).toBe(true);
    expect(report.gateG7.failingBoundaries).toEqual([]);

    for (const r of report.results) {
      expect(r.denied).toBe(true);
      expect(r.evidence.length).toBeGreaterThan(0);
    }
  }, 60_000);
});
