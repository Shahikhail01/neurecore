/**
 * AI Twin — Service.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.3.
 *
 * Owns the wizard lifecycle (DRAFT → ACTIVE → PAUSED → ARCHIVED), the
 * 4-step wizard snapshots, the personal-agent scope assignment, and the
 * audit-log emission that backs every twin action.
 *
 * The runtime contract is enforced by TwinPermissionMirrorGuard, which
 * this service composes on every action.
 *
 * Solid:
 *   • SRP — twin lifecycle + audit only. The LLM Registry (Phase 1.2)
 *     stays separate; the Twin consumes it but does not own LLM config.
 *   • DIP — depends on the repository abstraction.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TwinLifecycleStatus } from '@prisma/client';
import { AiTwinRepository } from './ai-twin.repository';
import {
  TwinActionIntent,
  TwinActionOutcome,
  TwinPermissionMirrorGuard,
  TwinPermissionScope,
  TWIN_OWNER_MIN_ROLE,
  TWIN_PLATFORM_ROLES,
} from './ai-twin.runtime-contract';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';

const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

@Injectable()
export class AiTwinService {
  private readonly logger = new Logger(AiTwinService.name);

  constructor(
    private readonly repo: AiTwinRepository,
    private readonly guard: TwinPermissionMirrorGuard,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Wizard lifecycle ────────────────────────────────────────────────

  async createDraft(args: {
    slug: string;
    displayName: string;
    description?: string;
    step1Goal: Record<string, unknown>;
    actor: JwtPayload;
  }) {
    this.requireOwner(args.actor);
    this.requireRealTenant(args.actor.tenantId, 'createDraft');
    this.validateSlug(args.slug);
    if (!args.actor.tenantId) {
      throw new ForbiddenException('actor must have a tenantId to own a twin');
    }
    const existing = await this.repo.findByOwnerAndSlug(
      args.actor.tenantId,
      args.actor.sub,
      args.slug,
    );
    if (existing) {
      throw new ConflictException(
        `twin slug "${args.slug}" already exists for this owner`,
      );
    }
    const created = await this.repo.create({
      tenantId: args.actor.tenantId,
      ownerUserId: args.actor.sub,
      slug: args.slug,
      displayName: args.displayName,
      description: args.description ?? null,
      step1Goal: args.step1Goal as unknown as Prisma.InputJsonValue,
      allowedReadScopes: [],
      allowedWriteScopes: [],
    });
    await this.recordWizardAudit({
      tenantId: args.actor.tenantId,
      twinId: created.id,
      actor: args.actor,
      intent: TwinActionIntent.WIZARD_ADVANCED,
      metadata: { step: 1, slug: created.slug },
    });
    return created;
  }

  async advanceWizardStep(args: {
    twinId: string;
    step: 1 | 2 | 3 | 4;
    payload: Record<string, unknown>;
    scopes?: { read?: TwinPermissionScope[]; write?: TwinPermissionScope[] };
    actor: JwtPayload;
  }) {
    const twin = await this.loadOwnedTwin(args.twinId, args.actor);
    if (args.step < 1 || args.step > 4) {
      throw new ForbiddenException('wizard step must be 1..4');
    }
    if (twin.status === 'ARCHIVED') {
      throw new ForbiddenException(
        `twin ${args.twinId} is ARCHIVED; wizard edits are inert`,
      );
    }
    const data: Parameters<AiTwinRepository['update']>[1] = {
      wizardStep: args.step,
    };
    if (args.step === 1) data.step1Goal = args.payload as unknown as Prisma.InputJsonValue;
    if (args.step === 2) data.step2Iteration = args.payload as unknown as Prisma.InputJsonValue;
    if (args.step === 3) data.step3Test = args.payload as unknown as Prisma.InputJsonValue;
    if (args.step === 4) {
      data.step4Deploy = args.payload as unknown as Prisma.InputJsonValue;
      if (args.scopes?.read) data.allowedReadScopes = args.scopes.read;
      if (args.scopes?.write) data.allowedWriteScopes = args.scopes.write;
    }
    const updated = await this.repo.update(args.twinId, data);
    await this.recordWizardAudit({
      tenantId: twin.tenantId,
      twinId: twin.id,
      actor: args.actor,
      intent: TwinActionIntent.WIZARD_ADVANCED,
      metadata: { step: args.step },
    });
    return updated;
  }

  async deploy(args: {
    twinId: string;
    agentTemplateId: string;
    agentTemplateVersionId: string;
    actor: JwtPayload;
  }) {
    const twin = await this.loadOwnedTwin(args.twinId, args.actor);
    if (twin.wizardStep < 4) {
      throw new ForbiddenException(
        `twin ${args.twinId} must complete wizard step 4 before deploy`,
      );
    }
    // Phase 8: deploy gate — refuse non-CERTIFIED template versions
    // and refuse when the twin's allowed scopes are not a superset of
    // the template's required scopes.
    const templateVersion = await this.prisma.agentTemplateVersion.findUnique({
      where: { id: args.agentTemplateVersionId },
      include: { certifications: true },
    });
    if (!templateVersion) {
      throw new ForbiddenException(
        `agent template version ${args.agentTemplateVersionId} not found`,
      );
    }
    if (templateVersion.agentTemplateId !== args.agentTemplateId) {
      throw new ForbiddenException(
        'agent template id does not match the template version',
      );
    }
    if (templateVersion.lifecycleStatus === 'RETIRED') {
      throw new ForbiddenException('cannot deploy a retired template version');
    }
    const hasCertified =
      Array.isArray(templateVersion.certifications) &&
      templateVersion.certifications.some(
        (c) => c.expiresAt == null || c.expiresAt > new Date(),
      );
    if (!hasCertified) {
      throw new ForbiddenException(
        'agent template version must be CERTIFIED before a Twin can be deployed onto it',
      );
    }
    // Scope check: every scope the template reads/writes must be in the
    // Twin's allow-list.
    const definition = (templateVersion.definition as Record<string, unknown>) ?? {};
    const composedSkills = Array.isArray(definition.composedSkills)
      ? (definition.composedSkills as string[])
      : [];
    const allowed = new Set([
      ...(twin.allowedReadScopes as string[]),
      ...(twin.allowedWriteScopes as string[]),
    ]);
    const requiredScopes = composedSkills.filter((s) => typeof s === 'string');
    const missing = requiredScopes.filter((s) => !allowed.has(s));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `twin is missing required scopes: ${missing.join(', ')} — update the wizard step 4 allow-list`,
      );
    }

    const updated = await this.repo.update(args.twinId, {
      agentTemplateId: args.agentTemplateId,
      agentTemplateVersionId: args.agentTemplateVersionId,
    });
    const activated = await this.repo.setStatus(
      args.twinId,
      'ACTIVE' as TwinLifecycleStatus,
      new Date(),
    );
    await this.recordActionAudit({
      tenantId: twin.tenantId,
      twinId: twin.id,
      actor: args.actor,
      intent: TwinActionIntent.DEPLOYED,
      metadata: {
        agentTemplateId: args.agentTemplateId,
        agentTemplateVersionId: args.agentTemplateVersionId,
        requiredScopes,
        missingScopes: missing,
      },
    });
    return activated;
  }

  async pause(twinId: string, actor: JwtPayload) {
    const twin = await this.loadOwnedTwin(twinId, actor);
    const updated = await this.repo.setStatus(twinId, 'PAUSED', new Date());
    await this.recordActionAudit({
      tenantId: twin.tenantId,
      twinId: twin.id,
      actor,
      intent: TwinActionIntent.PAUSED,
    });
    return updated;
  }

  async resume(twinId: string, actor: JwtPayload) {
    const twin = await this.loadOwnedTwin(twinId, actor);
    const updated = await this.repo.setStatus(twinId, 'ACTIVE', new Date());
    await this.recordActionAudit({
      tenantId: twin.tenantId,
      twinId: twin.id,
      actor,
      intent: TwinActionIntent.DEPLOYED,
      metadata: { resumed: true },
    });
    return updated;
  }

  async archive(twinId: string, actor: JwtPayload) {
    const twin = await this.loadOwnedTwin(twinId, actor);
    const updated = await this.repo.setStatus(twinId, 'ARCHIVED', new Date());
    await this.recordActionAudit({
      tenantId: twin.tenantId,
      twinId: twin.id,
      actor,
      intent: TwinActionIntent.ARCHIVED,
    });
    return updated;
  }

  // ─── Read helpers ────────────────────────────────────────────────────

  async listMine(actor: JwtPayload) {
    this.requireOwner(actor);
    if (!actor.tenantId) return [];
    return this.repo.findAllForOwner(actor.tenantId, actor.sub);
  }

  async findById(twinId: string, actor: JwtPayload) {
    const twin = await this.repo.findById(twinId);
    if (!twin) throw new NotFoundException(`twin ${twinId} not found`);
    // Only the owner or a platform admin may read a twin's full record.
    const isOwner = twin.ownerUserId === actor.sub;
    const isPlatform = TWIN_PLATFORM_ROLES.has(actor.role);
    if (!isOwner && !isPlatform) {
      throw new ForbiddenException(
        `actor ${actor.sub} cannot read twin ${twinId} owned by ${twin.ownerUserId}`,
      );
    }
    return twin;
  }

  async listAudits(twinId: string, actor: JwtPayload) {
    const twin = await this.findById(twinId, actor);
    return this.repo.listAudits({ tenantId: twin.tenantId, twinId });
  }

  // ─── Permission mirror for downstream callers ───────────────────────

  /**
   * Build the canonical TwinEnvelope for an action invoked against a
   * registered twin. Downstream callers (chat, hermes, agent executor)
   * MUST go through this method to obtain an envelope they can persist
   * — it runs the runtime contract guard and refuses non-conforming
   * callers.
   */
  buildEnvelopeForAction(args: {
    actor: JwtPayload;
    twinId: string;
    intent: TwinActionIntent;
    scopesUsed: TwinPermissionScope[];
    outcome?: TwinActionOutcome;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.guard.assertCanExecute({
      actor: args.actor,
      twinId: args.twinId,
      envelope: {
        tenantId: args.actor.tenantId ?? '',
        actorUserId: args.actor.sub,
        intent: args.intent,
        outcome: args.outcome,
        scopesUsed: args.scopesUsed,
        reason: args.reason,
        metadata: args.metadata,
      },
      twinAllowList: {
        read: (this.allowCache.get(args.twinId)?.read as TwinPermissionScope[]) ?? [],
        write: (this.allowCache.get(args.twinId)?.write as TwinPermissionScope[]) ?? [],
        status: this.allowCache.get(args.twinId)?.status ?? 'DRAFT',
      },
    });
  }

  /**
   * Internal helper: load a twin's allow-list once and cache for the
   * duration of a single request. In production, callers MUST pre-load
   * via `loadAllowListForExecution` and pass the allow-list to the guard
   * themselves; this cache exists only for ergonomics inside the
   * service-layer test path.
   */
  private allowCache = new Map<
    string,
    { read: TwinPermissionScope[]; write: TwinPermissionScope[]; status: TwinLifecycleStatus }
  >();

  async loadAllowListForExecution(twinId: string) {
    const twin = await this.repo.findById(twinId);
    if (!twin) throw new NotFoundException(`twin ${twinId} not found`);
    const allow = {
      read: (twin.allowedReadScopes as unknown as TwinPermissionScope[]) ?? [],
      write: (twin.allowedWriteScopes as unknown as TwinPermissionScope[]) ?? [],
      status: twin.status,
    };
    this.allowCache.set(twinId, allow);
    return allow;
  }

  // ─── Internals ───────────────────────────────────────────────────────

  private async loadOwnedTwin(twinId: string, actor: JwtPayload) {
    const twin = await this.repo.findById(twinId);
    if (!twin) throw new NotFoundException(`twin ${twinId} not found`);
    const isOwner = twin.ownerUserId === actor.sub;
    const isPlatform = TWIN_PLATFORM_ROLES.has(actor.role);
    if (!isOwner && !isPlatform) {
      throw new ForbiddenException(
        `actor ${actor.sub} cannot operate twin ${twinId} owned by ${twin.ownerUserId}`,
      );
    }
    return twin;
  }

  private async recordWizardAudit(args: {
    tenantId: string;
    twinId: string;
    actor: JwtPayload;
    intent: TwinActionIntent.WIZARD_ADVANCED;
    metadata?: Record<string, unknown>;
  }) {
    const env = this.guard.buildWizardEnvelope({
      actor: args.actor,
      tenantId: args.tenantId,
      intent: args.intent,
      metadata: args.metadata,
    });
    await this.repo.appendAudit({
      tenantId: args.tenantId,
      twinId: args.twinId,
      actorUserId: args.actor.sub,
      action: args.intent,
      outcome: TwinActionOutcome.SUCCESS,
      envelope: env as unknown as Prisma.InputJsonValue,
    });
  }

  private async recordActionAudit(args: {
    tenantId: string;
    twinId: string;
    actor: JwtPayload;
    intent: TwinActionIntent;
    metadata?: Record<string, unknown>;
  }) {
    await this.repo.appendAudit({
      tenantId: args.tenantId,
      twinId: args.twinId,
      actorUserId: args.actor.sub,
      action: args.intent,
      outcome: TwinActionOutcome.SUCCESS,
      envelope: {
        tenantId: args.tenantId,
        actorUserId: args.actor.sub,
        intent: args.intent,
        occurredAt: new Date().toISOString(),
        metadata: args.metadata,
      } as unknown as Prisma.InputJsonValue,
    });
  }

  private requireOwner(actor: JwtPayload): void {
    if (actor.role !== TWIN_OWNER_MIN_ROLE && !TWIN_PLATFORM_ROLES.has(actor.role)) {
      throw new ForbiddenException(
        `actor role ${actor.role} cannot own a twin; OWNER or platform admin required`,
      );
    }
  }

  private requireRealTenant(tenantId: string | null, op: string): void {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        `actor must have a real tenantId for ${op}; wildcard is forbidden`,
      );
    }
  }

  private validateSlug(slug: string): void {
    if (!SLUG_REGEX.test(slug)) {
      throw new ForbiddenException(
        'slug must be 1-64 chars: lowercase alphanumeric, optional - or _',
      );
    }
  }
}
