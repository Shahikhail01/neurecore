import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';
import {
  CreateHarnessChangeSchema,
  CreateHarnessReplaySchema,
  CreateHarnessRunSchema,
  CreateHarnessWaiverSchema,
  RevokeSchema,
  type CreateHarnessChange,
  type CreateHarnessReplay,
  type CreateHarnessRun,
  type CreateHarnessWaiver,
} from './contracts';

const HARNESS_SUPER_ROLES = new Set(['SUPER_ADMIN']);

@Injectable()
export class HarnessControlService {
  constructor(private readonly prisma: PrismaService) {}

  private parse<T>(
    schema: {
      safeParse(value: unknown): {
        success: boolean;
        data?: T;
        error?: { issues: unknown[] };
      };
    },
    value: unknown,
  ): T {
    const result = schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error?.issues);
    return result.data as T;
  }

  private digest(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private requireSuperAdmin(actor: JwtPayload) {
    if (!actor.role || !HARNESS_SUPER_ROLES.has(String(actor.role))) {
      throw new ForbiddenException('Harness control requires SUPER_ADMIN');
    }
  }

  private async audit(
    actor: JwtPayload,
    action: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, unknown> = {},
  ) {
    const previous = await this.prisma.harnessAuditEvent.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const createdAt = new Date();
    const previousHash = previous?.eventHash ?? null;
    const eventHash = this.digest({
      actorId: actor.sub,
      action,
      resourceType,
      resourceId,
      previousHash,
      createdAt: createdAt.toISOString(),
      details,
    });
    return this.prisma.harnessAuditEvent.create({
      data: {
        id: randomUUID(),
        actorId: actor.sub,
        action,
        resourceType,
        resourceId,
        tenantId: actor.tenantId ?? null,
        result: 'success',
        details: details as never,
        previousHash,
        eventHash,
        createdAt,
      },
    });
  }

  async dashboard() {
    const [
      capabilities,
      runs,
      pendingApprovals,
      activeCertificates,
      activeWaivers,
      integrityIssues,
      replayBundles,
      activeRunPolicies,
    ] = await Promise.all([
      this.prisma.harnessChangeVersion.count({
        where: { kind: 'SCENARIO', deprecatedAt: null },
      }),
      this.prisma.harnessRun.groupBy({ by: ['state'], _count: true }),
      this.prisma.harnessRun.count({ where: { state: 'REQUESTED' } }),
      this.prisma.harnessCertificate.count({
        where: { state: 'ACTIVE', expiresAt: { gt: new Date() } },
      }),
      this.prisma.harnessWaiver.count({
        where: { state: 'ACTIVE', expiresAt: { gt: new Date() } },
      }),
      this.prisma.harnessEvidence.count({ where: { checksum: '' } }),
      this.prisma.harnessReplayBundle.count(),
      this.prisma.harnessRunPolicy.count({
        where: { approvedAt: { not: null }, deprecatedAt: null },
      }),
    ]);
    return {
      capabilities,
      runs,
      pendingApprovals,
      activeCertificates,
      activeWaivers,
      integrityIssues,
      replayBundles,
      activeRunPolicies,
    };
  }

  listRuns() {
    return this.prisma.harnessRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { runPolicy: true, _count: { select: { evidence: true } } },
    });
  }

  async requestRun(actor: JwtPayload, input: CreateHarnessRun) {
    this.requireSuperAdmin(actor);
    const data = this.parse(CreateHarnessRunSchema, input);
    const policy = await this.prisma.harnessRunPolicy.findUnique({
      where: { id: data.runPolicyId },
    });
    if (!policy || policy.deprecatedAt)
      throw new NotFoundException('Approved run policy not found');
    if (!policy.approvedAt || !policy.approvedBy)
      throw new ForbiddenException('Run policy is not approved');
    if (policy.environment !== data.environment)
      throw new BadRequestException('Run policy environment mismatch');
    if (Number(policy.maxBudgetUsd) < data.budgetUsd)
      throw new ForbiddenException('Run budget exceeds policy');
    if (
      policy.allowedCapabilityIds.length &&
      !policy.allowedCapabilityIds.includes(data.capabilityId)
    )
      throw new ForbiddenException('Capability is not allowed by policy');
    if (data.destructive && !policy.destructiveAllowed)
      throw new ForbiddenException('Destructive runs are forbidden by policy');
    if (
      data.environment === 'PRODUCTION' &&
      (!policy.productionAllowed || data.destructive)
    )
      throw new ForbiddenException('Unsafe production run denied');
    const active = await this.prisma.harnessRun.count({
      where: { runPolicyId: policy.id, state: { in: ['APPROVED', 'RUNNING'] } },
    });
    if (active >= policy.maxConcurrency)
      throw new ConflictException('Run policy concurrency cap reached');
    const state = policy.requiresApproval ? 'REQUESTED' : 'APPROVED';
    const run = await this.prisma.harnessRun.create({
      data: {
        id: randomUUID(),
        capabilityId: data.capabilityId,
        scenarioId: data.scenarioId,
        tenantId: data.tenantId ?? null,
        environment: data.environment,
        runPolicyId: data.runPolicyId,
        replayOfRunId: data.replayOfRunId ?? null,
        destructive: data.destructive,
        budgetUsd: data.budgetUsd,
        idempotencyKey: data.idempotencyKey,
        requestedBy: actor.sub,
        state,
        provenance: {
          contractVersion: '1.0.0',
          requestedRole: actor.role,
          actorTenantId: actor.tenantId ?? null,
        } as never,
      },
    });
    await this.audit(actor, 'harness.run.request', 'run', run.id, {
      capabilityId: run.capabilityId,
      environment: run.environment,
      destructive: run.destructive,
    });
    return run;
  }

  async approveRun(actor: JwtPayload, id: string) {
    this.requireSuperAdmin(actor);
    const run = await this.prisma.harnessRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Run not found');
    if (run.requestedBy === actor.sub)
      throw new ForbiddenException('Requester cannot approve own run');
    if (run.state !== 'REQUESTED')
      throw new ConflictException('Run is not awaiting approval');
    const updated = await this.prisma.harnessRun.update({
      where: { id },
      data: {
        state: 'APPROVED',
        approvedBy: actor.sub,
        approvedAt: new Date(),
      },
    });
    await this.audit(actor, 'harness.run.approve', 'run', id);
    return updated;
  }

  async cancelRun(actor: JwtPayload, id: string) {
    this.requireSuperAdmin(actor);
    const run = await this.prisma.harnessRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Run not found');
    if (!['REQUESTED', 'APPROVED', 'RUNNING'].includes(run.state))
      throw new ConflictException('Run cannot be cancelled');
    const updated = await this.prisma.harnessRun.update({
      where: { id },
      data: { state: 'CANCELLED', completedAt: new Date() },
    });
    await this.audit(actor, 'harness.run.cancel', 'run', id);
    return updated;
  }

  async getEvidence(actor: JwtPayload, id: string) {
    this.requireSuperAdmin(actor);
    const evidence = await this.prisma.harnessEvidence.findUnique({
      where: { id },
      include: { run: true },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    if (
      actor.tenantId &&
      evidence.tenantId &&
      evidence.tenantId !== actor.tenantId
    )
      throw new NotFoundException('Evidence not found');
    await this.audit(actor, 'harness.evidence.read', 'evidence', id);
    return evidence;
  }

  async listChanges(kind?: string) {
    return this.prisma.harnessChangeVersion.findMany({
      where: kind ? { kind: kind as never } : {},
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createChange(actor: JwtPayload, input: CreateHarnessChange) {
    this.requireSuperAdmin(actor);
    const data = this.parse(CreateHarnessChangeSchema, input);
    if (data.ownerId === actor.sub)
      throw new ForbiddenException('Owner cannot equal requester (separation of duties)');
    const latest = await this.prisma.harnessChangeVersion.findFirst({
      where: { kind: data.kind, key: data.key },
      orderBy: { version: 'desc' },
    });
    const record = await this.prisma.harnessChangeVersion.create({
      data: {
        id: randomUUID(),
        kind: data.kind,
        key: data.key,
        ownerId: data.ownerId,
        createdBy: actor.sub,
        reviewDate: new Date(data.reviewDate),
        version: (latest?.version ?? 0) + 1,
        content: data.content as never,
        contentHash: this.digest(data.content),
        rollbackData: (data.rollbackData ?? null) as never,
        evaluationRunId: data.evaluationRunId ?? null,
      },
    });
    await this.audit(actor, 'harness.change.create', 'change', record.id, {
      kind: record.kind,
      key: record.key,
      version: record.version,
    });
    return record;
  }

  async approveChange(actor: JwtPayload, id: string) {
    this.requireSuperAdmin(actor);
    const record = await this.prisma.harnessChangeVersion.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('Change not found');
    if (record.createdBy === actor.sub || record.ownerId === actor.sub)
      throw new ForbiddenException('Creator or owner cannot approve change');
    if (!record.evaluationRunId || !record.rollbackData)
      throw new ForbiddenException('Evaluation and rollback data are required');
    const updated = await this.prisma.harnessChangeVersion.update({
      where: { id },
      data: {
        state: 'APPROVED',
        approvedBy: actor.sub,
        approvedAt: new Date(),
      },
    });
    await this.audit(actor, 'harness.change.approve', 'change', id);
    return updated;
  }

  async createWaiver(actor: JwtPayload, input: CreateHarnessWaiver) {
    this.requireSuperAdmin(actor);
    const data = this.parse(CreateHarnessWaiverSchema, input);
    if (data.ownerId === actor.sub)
      throw new ForbiddenException('Waiver owner cannot equal requester');
    const waiver = await this.prisma.harnessWaiver.create({
      data: {
        id: randomUUID(),
        capabilityId: data.capabilityId,
        scope: data.scope,
        reason: data.reason,
        compensatingControl: data.compensatingControl,
        ownerId: data.ownerId,
        requestedBy: actor.sub,
        issueLink: data.issueLink,
        expiresAt: new Date(data.expiresAt),
      },
    });
    await this.audit(actor, 'harness.waiver.request', 'waiver', waiver.id);
    return waiver;
  }

  async approveWaiver(actor: JwtPayload, id: string) {
    this.requireSuperAdmin(actor);
    const waiver = await this.prisma.harnessWaiver.findUnique({
      where: { id },
    });
    if (!waiver) throw new NotFoundException('Waiver not found');
    if (waiver.requestedBy === actor.sub || waiver.ownerId === actor.sub)
      throw new ForbiddenException('Requester or owner cannot approve waiver');
    if (waiver.expiresAt <= new Date())
      throw new ConflictException('Waiver has expired');
    const updated = await this.prisma.harnessWaiver.update({
      where: { id },
      data: { state: 'ACTIVE', approvedBy: actor.sub },
    });
    await this.audit(actor, 'harness.waiver.approve', 'waiver', id);
    return updated;
  }

  async revokeWaiver(actor: JwtPayload, id: string, reason: string) {
    this.requireSuperAdmin(actor);
    const parsed = this.parse(RevokeSchema, { reason });
    const waiver = await this.prisma.harnessWaiver.findUnique({ where: { id } });
    if (!waiver) throw new NotFoundException('Waiver not found');
    const updated = await this.prisma.harnessWaiver.update({
      where: { id },
      data: {
        state: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: actor.sub,
        revokeReason: parsed.reason,
      },
    });
    await this.audit(actor, 'harness.waiver.revoke', 'waiver', id, {
      reason: parsed.reason,
    });
    return updated;
  }

  async revokeCertificate(actor: JwtPayload, id: string, reason: string) {
    this.requireSuperAdmin(actor);
    const parsed = this.parse(RevokeSchema, { reason });
    const certificate = await this.prisma.harnessCertificate.findUnique({
      where: { id },
    });
    if (!certificate) throw new NotFoundException('Certificate not found');
    if (certificate.state === 'REVOKED')
      throw new ConflictException('Certificate already revoked');
    const updated = await this.prisma.harnessCertificate.update({
      where: { id },
      data: {
        state: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: actor.sub,
        revokeReason: parsed.reason,
      },
    });
    await this.audit(actor, 'harness.certificate.revoke', 'certificate', id, {
      reason: parsed.reason,
    });
    return updated;
  }

  listWaivers() {
    return this.prisma.harnessWaiver.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listCertificates() {
    return this.prisma.harnessCertificate.findMany({
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });
  }

  listAudit() {
    return this.prisma.harnessAuditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async verifyAuditChain() {
    const events = await this.prisma.harnessAuditEvent.findMany({
      orderBy: { createdAt: 'asc' },
    });
    let previousHash: string | null = null;
    let checked = 0;
    for (const event of events) {
      if (event.previousHash !== previousHash) {
        return { ok: false, brokenAt: event.id, checked };
      }
      const recomputed = this.digest({
        actorId: event.actorId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        previousHash,
        createdAt: event.createdAt.toISOString(),
        details: event.details ?? {},
      });
      if (recomputed !== event.eventHash) {
        return { ok: false, brokenAt: event.id, checked };
      }
      previousHash = event.eventHash;
      checked += 1;
    }
    return { ok: true, checked };
  }

  async listReplayBundles() {
    return this.prisma.harnessReplayBundle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createReplayBundle(actor: JwtPayload, input: CreateHarnessReplay) {
    this.requireSuperAdmin(actor);
    const data = this.parse(CreateHarnessReplaySchema, input);
    const bundle = await this.prisma.harnessReplayBundle.create({
      data: {
        id: randomUUID(),
        sourceRunId: data.sourceRunId,
        environment: data.environment,
        externalSideEffects: data.externalSideEffects,
        schemaVersion: data.schemaVersion,
        manifest: data.manifest as never,
        checksum: this.digest(data.manifest),
        createdBy: actor.sub,
      },
    });
    await this.audit(actor, 'harness.replay.bundle.create', 'replay', bundle.id, {
      sourceRunId: bundle.sourceRunId,
      environment: bundle.environment,
      externalSideEffects: bundle.externalSideEffects,
    });
    return bundle;
  }

  async executeReplay(actor: JwtPayload, bundleId: string) {
    this.requireSuperAdmin(actor);
    const bundle = await this.prisma.harnessReplayBundle.findUnique({
      where: { id: bundleId },
    });
    if (!bundle) throw new NotFoundException('Replay bundle not found');
    if (bundle.externalSideEffects)
      throw new ForbiddenException(
        'Replay with external side effects is blocked by side-effect firewall',
      );
    if (bundle.environment === 'PRODUCTION')
      throw new ForbiddenException('Replay cannot run against PRODUCTION');
    const allowedEnvs = ['LOCAL', 'CI', 'STAGING', 'PRODUCTION_PROBE'];
    if (!allowedEnvs.includes(bundle.environment))
      throw new ForbiddenException('Replay environment not allowed');
    const recomputed = this.digest(bundle.manifest ?? {});
    if (recomputed !== bundle.checksum)
      throw new ConflictException('Replay bundle checksum mismatch');
    const execution = await this.prisma.harnessReplayExecution.create({
      data: {
        id: randomUUID(),
        bundleId,
        actorId: actor.sub,
        state: 'SANDBOXED',
        sideEffectFirewallProof: {
          bundleChecksum: bundle.checksum,
          externalSideEffects: bundle.externalSideEffects,
          environment: bundle.environment,
          revalidatedAt: new Date().toISOString(),
        } as never,
        finishedAt: new Date(),
      },
    });
    await this.audit(
      actor,
      'harness.replay.execute',
      'replay',
      bundleId,
      {
        executionId: execution.id,
        environment: bundle.environment,
      },
    );
    return execution;
  }
}
