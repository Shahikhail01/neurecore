// src/modules/agent-templates/agent-template-lifecycle.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AgentTemplateVersionRepository } from './agent-template-version.repository';
import { AgentSkillDefinitionRepository } from './agent-skill-definition.repository';
import { AgentTemplateCertificationRepository } from './agent-template-certification.repository';
import { AgentLifecycleAuditRepository } from './agent-lifecycle-audit.repository';
import {
  AgentSkillBuilderService,
  SkillRef,
} from './agent-skill-builder.service';
import type {
  AgentTemplateLifecycleStatus,
  AgentTemplateVersion,
} from '@prisma/client';

/**
 * AgentTemplateLifecycleService — orchestrates the template-version
 * state machine.
 *
 *   DRAFT ──► CERTIFIED ──► ACTIVE ──► SUSPENDED ──► ACTIVE (RESUME)
 *     │          │            │            │             │
 *     │          │            └─► RETIRED ◄┘             │
 *     │          │                                      │
 *     │          └─► ROLLBACK (to prior CERTIFIED)       │
 *     │                                                 │
 *     └─► RETIRED                                       │
 *
 * SECURITY: every transition requires the actor identity from JWT.
 * `maxEffect`/`requiredAuthority`/`approvalSensitive` are server-derived
 * from the composed skill graph. Client DTOs cannot override them.
 */

export interface CreateVersionInput {
  agentTemplateId: string;
  version: string;
  definition: Prisma.JsonValue;
  composedSkillRefs: SkillRef[];
  escalationActorId?: string;
  budgetLimit?: Prisma.JsonValue;
  rateLimits?: Prisma.JsonValue;
  channelBindings?: Prisma.JsonValue;
  approvalPolicyRefs?: string[];
  evaluationMinScore?: number;
  evaluationDatasetId?: string;
}

export interface CertifyInput {
  agentTemplateId: string;
  version: string;
  evaluationReport: Prisma.JsonValue;
  expiresAt?: Date | null;
  reason: string;
}

export interface RollbackInput {
  agentTemplateId: string;
  /** Target version to roll back to. Must be a previously CERTIFIED version. */
  targetVersion: string;
  reason: string;
}

@Injectable()
export class AgentTemplateLifecycleService {
  private readonly logger = new Logger(AgentTemplateLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: AgentTemplateVersionRepository,
    private readonly skills: AgentSkillDefinitionRepository,
    private readonly certifications: AgentTemplateCertificationRepository,
    private readonly audit: AgentLifecycleAuditRepository,
    private readonly builder: AgentSkillBuilderService,
  ) {}

  // ─── Reads ──────────────────────────────────────────────────────────────

  async getVersion(
    tenantId: string,
    id: string,
  ): Promise<AgentTemplateVersion> {
    const v = await this.versions.getById(tenantId, id);
    if (!v)
      throw new NotFoundException(`Agent template version ${id} not found`);
    return v;
  }

  async listHistory(tenantId: string, agentTemplateId: string) {
    return this.versions.listHistory(tenantId, agentTemplateId);
  }

  async listAudit(args: { tenantId: string; templateId: string }) {
    // SubjectType=VERSION rows where subjectId is a version belonging to
    // the template. We resolve the version ids first.
    const vs = await this.versions.listHistory(args.tenantId, args.templateId, {
      limit: 1000,
    });
    const versionIds = new Set(vs.map((v) => v.id));
    const auditRows = await this.audit.listForTenant(args.tenantId, 500);
    return auditRows.filter(
      (r) =>
        (r.subjectType === 'TEMPLATE' && r.subjectId === args.templateId) ||
        (r.subjectType === 'VERSION' && versionIds.has(r.subjectId)),
    );
  }

  // ─── Create version (DRAFT) ─────────────────────────────────────────────

  async createVersion(
    tenantId: string,
    actorId: string,
    input: CreateVersionInput,
  ): Promise<AgentTemplateVersion> {
    // Verify the template exists in this tenant.
    const template = await this.prisma.agentTemplate.findFirst({
      where: {
        id: input.agentTemplateId,
        OR: [{ tenantId }, { tenantId: null, isPublic: true }],
      },
    });
    if (!template) {
      throw new NotFoundException(
        `Agent template ${input.agentTemplateId} not found`,
      );
    }

    // Reject duplicate (templateId, version).
    const existing = await this.versions.getByVersion(
      tenantId,
      input.agentTemplateId,
      input.version,
    );
    if (existing) {
      throw new ConflictException(
        `Version ${input.version} already exists for template ${input.agentTemplateId}`,
      );
    }

    // Reject cross-tenant skill references up front.
    await this.builder.assertNoCrossTenantReferences({
      tenantId,
      composedSkillRefs: input.composedSkillRefs,
    });

    // SERVER-DERIVE maxEffect / authorityCeiling from composedSkillRefs.
    // (The caller cannot influence these via DTO.)
    const composedSkills = await this.skills.findReferencedSkills(
      tenantId,
      Array.from(new Set(input.composedSkillRefs.map((r) => r.skillKey))),
    );
    const derived = this.builder.aggregate(composedSkills);

    const created = await this.versions.createVersion({
      tenantId,
      agentTemplateId: input.agentTemplateId,
      version: input.version,
      definition: input.definition,
      composedSkillRefs: input.composedSkillRefs.map(
        (r) => `${r.skillKey}@${r.semanticVersion}`,
      ),
      maxEffect: derived.maxEffect,
      authorityCeiling: derived.requiredAuthority,
      escalationActorId: input.escalationActorId,
      budgetLimit: input.budgetLimit,
      rateLimits: input.rateLimits,
      channelBindings: input.channelBindings,
      approvalPolicyRefs: input.approvalPolicyRefs,
      evaluationMinScore: input.evaluationMinScore,
      evaluationDatasetId: input.evaluationDatasetId,
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CREATE',
      subjectType: 'VERSION',
      subjectId: created.id,
      previousState: {},
      newState: {
        version: created.version,
        lifecycleStatus: created.lifecycleStatus,
        maxEffect: created.maxEffect,
        authorityCeiling: created.authorityCeiling,
      },
      reason: `Version ${input.version} created as DRAFT`,
    });

    return created;
  }

  // ─── Certify ────────────────────────────────────────────────────────────

  async certify(
    tenantId: string,
    actorId: string,
    input: CertifyInput,
  ): Promise<AgentTemplateVersion> {
    const version = await this.versions.getByVersion(
      tenantId,
      input.agentTemplateId,
      input.version,
    );
    if (!version) {
      throw new NotFoundException(
        `Version ${input.version} of template ${input.agentTemplateId} not found`,
      );
    }
    if (version.certificationStatus === 'CERTIFIED') {
      throw new ConflictException(
        `Version ${input.version} is already certified`,
      );
    }
    if (version.lifecycleStatus === 'RETIRED') {
      throw new BadRequestException(`Cannot certify a RETIRED version`);
    }

    // Persist the certification event (signed).
    const cert = await this.certifications.create({
      tenantId,
      agentTemplateVersionId: version.id,
      certifiedByActorId: actorId,
      evaluationReport: input.evaluationReport,
      expiresAt: input.expiresAt,
    });
    void cert;

    const previous = {
      certificationStatus: version.certificationStatus,
      lifecycleStatus: version.lifecycleStatus,
    };

    const updated = await this.versions.updateCertification(
      tenantId,
      version.id,
      {
        certificationStatus: 'CERTIFIED',
        certifiedAt: new Date(),
        certifiedByActorId: actorId,
      },
    );

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CERTIFY',
      subjectType: 'VERSION',
      subjectId: version.id,
      previousState: previous,
      newState: {
        certificationStatus: 'CERTIFIED',
        certifiedByActorId: actorId,
      },
      reason: input.reason,
    });

    return updated;
  }

  // ─── Activate ───────────────────────────────────────────────────────────

  async activate(
    tenantId: string,
    actorId: string,
    args: { agentTemplateId: string; version: string; reason: string },
  ): Promise<AgentTemplateVersion> {
    const version = await this.requireVersion(tenantId, args);
    if (version.lifecycleStatus === 'RETIRED') {
      throw new BadRequestException(
        `Cannot activate RETIRED version ${args.version}. Create a new version.`,
      );
    }
    if (version.certificationStatus !== 'CERTIFIED') {
      throw new BadRequestException(
        `Cannot activate version ${args.version}: certificationStatus=${version.certificationStatus}. Certification is required before activation.`,
      );
    }
    if (version.lifecycleStatus === 'ACTIVE') {
      throw new ConflictException(`Version ${args.version} is already ACTIVE`);
    }
    if (version.lifecycleStatus === 'SUSPENDED') {
      throw new BadRequestException(
        `Use /resume to bring a SUSPENDED version back to ACTIVE`,
      );
    }

    // Authorization — must come from JWT actor identity, not from request.
    // Activation requires either OWNER/ADMIN/SUPER_ADMIN.
    // (Caller enforces the role; this service trusts the actor id was
    // extracted server-side from the JWT by the controller.)
    if (!actorId) {
      throw new ForbiddenException('Actor identity required for activation');
    }

    // Suspend any currently ACTIVE version of the same template and
    // mark it as superseded.
    const current = await this.versions.getCurrent(
      tenantId,
      args.agentTemplateId,
    );
    const previousState = { lifecycleStatus: version.lifecycleStatus };

    const updated = await this.versions.updateLifecycle(
      tenantId,
      version.id,
      'ACTIVE',
    );

    if (current && current.id !== version.id) {
      await this.versions.supersede({
        tenantId,
        agentTemplateId: args.agentTemplateId,
        version: current.version,
        supersededByVersionId: version.id,
      });
    }

    await this.audit.record({
      tenantId,
      actorId,
      action: 'ACTIVATE',
      subjectType: 'VERSION',
      subjectId: version.id,
      previousState,
      newState: { lifecycleStatus: 'ACTIVE' },
      reason: args.reason,
    });

    return updated;
  }

  // ─── Suspend / Resume ───────────────────────────────────────────────────

  async suspend(
    tenantId: string,
    actorId: string,
    args: { agentTemplateId: string; version: string; reason: string },
  ): Promise<AgentTemplateVersion> {
    const version = await this.requireVersion(tenantId, args);
    if (version.lifecycleStatus !== 'ACTIVE') {
      throw new BadRequestException(
        `Only ACTIVE versions can be suspended (current=${version.lifecycleStatus})`,
      );
    }
    const updated = await this.versions.updateLifecycle(
      tenantId,
      version.id,
      'SUSPENDED',
    );
    await this.audit.record({
      tenantId,
      actorId,
      action: 'SUSPEND',
      subjectType: 'VERSION',
      subjectId: version.id,
      previousState: { lifecycleStatus: 'ACTIVE' },
      newState: { lifecycleStatus: 'SUSPENDED' },
      reason: args.reason,
    });
    return updated;
  }

  async resume(
    tenantId: string,
    actorId: string,
    args: { agentTemplateId: string; version: string; reason: string },
  ): Promise<AgentTemplateVersion> {
    const version = await this.requireVersion(tenantId, args);
    if (version.lifecycleStatus !== 'SUSPENDED') {
      throw new BadRequestException(
        `Only SUSPENDED versions can be resumed (current=${version.lifecycleStatus})`,
      );
    }
    const updated = await this.versions.updateLifecycle(
      tenantId,
      version.id,
      'ACTIVE',
    );
    await this.audit.record({
      tenantId,
      actorId,
      action: 'RESUME',
      subjectType: 'VERSION',
      subjectId: version.id,
      previousState: { lifecycleStatus: 'SUSPENDED' },
      newState: { lifecycleStatus: 'ACTIVE' },
      reason: args.reason,
    });
    return updated;
  }

  // ─── Retire ─────────────────────────────────────────────────────────────

  async retire(
    tenantId: string,
    actorId: string,
    args: { agentTemplateId: string; version: string; reason: string },
  ): Promise<AgentTemplateVersion> {
    const version = await this.requireVersion(tenantId, args);
    if (version.lifecycleStatus === 'RETIRED') {
      throw new ConflictException(`Version ${args.version} is already RETIRED`);
    }
    const previousState = { lifecycleStatus: version.lifecycleStatus };
    const updated = await this.versions.updateLifecycle(
      tenantId,
      version.id,
      'RETIRED',
    );
    await this.audit.record({
      tenantId,
      actorId,
      action: 'RETIRE',
      subjectType: 'VERSION',
      subjectId: version.id,
      previousState,
      newState: { lifecycleStatus: 'RETIRED' },
      reason: args.reason,
    });
    return updated;
  }

  // ─── Rollback ───────────────────────────────────────────────────────────

  async rollback(
    tenantId: string,
    actorId: string,
    input: RollbackInput,
  ): Promise<AgentTemplateVersion> {
    const target = await this.versions.getByVersion(
      tenantId,
      input.agentTemplateId,
      input.targetVersion,
    );
    if (!target) {
      throw new NotFoundException(
        `Target version ${input.targetVersion} not found for rollback`,
      );
    }
    if (target.certificationStatus !== 'CERTIFIED') {
      throw new BadRequestException(
        `Cannot roll back to ${input.targetVersion}: target is not CERTIFIED`,
      );
    }
    if (target.lifecycleStatus === 'RETIRED') {
      throw new BadRequestException(`Cannot roll back to a RETIRED version`);
    }

    // Suspend current ACTIVE first.
    const current = await this.versions.getCurrent(
      tenantId,
      input.agentTemplateId,
    );
    if (current && current.id !== target.id) {
      await this.versions.updateLifecycle(tenantId, current.id, 'SUSPENDED');
      await this.audit.record({
        tenantId,
        actorId,
        action: 'SUSPEND',
        subjectType: 'VERSION',
        subjectId: current.id,
        previousState: { lifecycleStatus: 'ACTIVE' },
        newState: { lifecycleStatus: 'SUSPENDED' },
        reason: `Pre-rollback suspension (rolling back to ${input.targetVersion})`,
      });
    }

    // Activate the rollback target.
    const previousState = { lifecycleStatus: target.lifecycleStatus };
    const updated = await this.versions.updateLifecycle(
      tenantId,
      target.id,
      'ACTIVE',
    );
    await this.audit.record({
      tenantId,
      actorId,
      action: 'ROLLBACK',
      subjectType: 'VERSION',
      subjectId: target.id,
      previousState,
      newState: { lifecycleStatus: 'ACTIVE', rollbackOf: current?.id ?? null },
      reason: input.reason,
    });

    return updated;
  }

  // ─── Skill lifecycle passthrough (audit + state machine on skills) ─────

  async certifySkill(args: {
    tenantId: string;
    actorId: string;
    skillId: string;
    certifiedVersion: string;
    reason: string;
  }) {
    const skill = await this.skills.getById(args.tenantId, args.skillId);
    if (!skill) throw new NotFoundException(`Skill ${args.skillId} not found`);
    if (skill.certificationStatus === 'CERTIFIED') {
      throw new ConflictException(
        `Skill ${skill.skillKey} is already CERTIFIED`,
      );
    }
    const previous = { certificationStatus: skill.certificationStatus };
    const updated = await this.skills.updateCertification(
      args.tenantId,
      args.skillId,
      {
        certificationStatus: 'CERTIFIED',
        certifiedAt: new Date(),
        certifiedByActorId: args.actorId,
        certifiedVersion: args.certifiedVersion,
      },
    );
    await this.audit.record({
      tenantId: args.tenantId,
      actorId: args.actorId,
      action: 'CERTIFY',
      subjectType: 'SKILL',
      subjectId: args.skillId,
      previousState: previous,
      newState: {
        certificationStatus: 'CERTIFIED',
        certifiedVersion: args.certifiedVersion,
      },
      reason: args.reason,
    });
    return updated;
  }

  async activateSkill(args: {
    tenantId: string;
    actorId: string;
    skillId: string;
    reason: string;
  }) {
    const skill = await this.skills.getById(args.tenantId, args.skillId);
    if (!skill) throw new NotFoundException(`Skill ${args.skillId} not found`);
    if (skill.certificationStatus !== 'CERTIFIED') {
      throw new BadRequestException(`Skill must be CERTIFIED before ACTIVE`);
    }
    if (skill.lifecycleStatus === 'ACTIVE') {
      throw new ConflictException(`Skill already ACTIVE`);
    }
    if (skill.lifecycleStatus === 'RETIRED') {
      throw new BadRequestException(
        `Cannot re-activate a RETIRED skill. Create a new version.`,
      );
    }
    const previous = { lifecycleStatus: skill.lifecycleStatus };
    const updated = await this.skills.updateLifecycle(
      args.tenantId,
      args.skillId,
      'ACTIVE',
    );
    await this.audit.record({
      tenantId: args.tenantId,
      actorId: args.actorId,
      action: 'ACTIVATE',
      subjectType: 'SKILL',
      subjectId: args.skillId,
      previousState: previous,
      newState: { lifecycleStatus: 'ACTIVE' },
      reason: args.reason,
    });
    return updated;
  }

  async suspendSkill(args: {
    tenantId: string;
    actorId: string;
    skillId: string;
    reason: string;
  }) {
    const skill = await this.skills.getById(args.tenantId, args.skillId);
    if (!skill) throw new NotFoundException(`Skill ${args.skillId} not found`);
    if (skill.lifecycleStatus !== 'ACTIVE') {
      throw new BadRequestException(`Only ACTIVE skills can be suspended`);
    }
    const previous = { lifecycleStatus: skill.lifecycleStatus };
    const updated = await this.skills.updateLifecycle(
      args.tenantId,
      args.skillId,
      'SUSPENDED',
    );
    await this.audit.record({
      tenantId: args.tenantId,
      actorId: args.actorId,
      action: 'SUSPEND',
      subjectType: 'SKILL',
      subjectId: args.skillId,
      previousState: previous,
      newState: { lifecycleStatus: 'SUSPENDED' },
      reason: args.reason,
    });
    return updated;
  }

  async resumeSkill(args: {
    tenantId: string;
    actorId: string;
    skillId: string;
    reason: string;
  }) {
    const skill = await this.skills.getById(args.tenantId, args.skillId);
    if (!skill) throw new NotFoundException(`Skill ${args.skillId} not found`);
    if (skill.lifecycleStatus !== 'SUSPENDED') {
      throw new BadRequestException(`Only SUSPENDED skills can be resumed`);
    }
    const previous = { lifecycleStatus: skill.lifecycleStatus };
    const updated = await this.skills.updateLifecycle(
      args.tenantId,
      args.skillId,
      'ACTIVE',
    );
    await this.audit.record({
      tenantId: args.tenantId,
      actorId: args.actorId,
      action: 'RESUME',
      subjectType: 'SKILL',
      subjectId: args.skillId,
      previousState: previous,
      newState: { lifecycleStatus: 'ACTIVE' },
      reason: args.reason,
    });
    return updated;
  }

  async retireSkill(args: {
    tenantId: string;
    actorId: string;
    skillId: string;
    reason: string;
  }) {
    const skill = await this.skills.getById(args.tenantId, args.skillId);
    if (!skill) throw new NotFoundException(`Skill ${args.skillId} not found`);
    if (skill.lifecycleStatus === 'RETIRED') {
      throw new ConflictException(`Skill already RETIRED`);
    }
    const previous = { lifecycleStatus: skill.lifecycleStatus };
    const updated = await this.skills.updateLifecycle(
      args.tenantId,
      args.skillId,
      'RETIRED',
    );
    await this.audit.record({
      tenantId: args.tenantId,
      actorId: args.actorId,
      action: 'RETIRE',
      subjectType: 'SKILL',
      subjectId: args.skillId,
      previousState: previous,
      newState: { lifecycleStatus: 'RETIRED' },
      reason: args.reason,
    });
    return updated;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async requireVersion(
    tenantId: string,
    args: { agentTemplateId: string; version: string },
  ): Promise<AgentTemplateVersion> {
    const v = await this.versions.getByVersion(
      tenantId,
      args.agentTemplateId,
      args.version,
    );
    if (!v) {
      throw new NotFoundException(
        `Version ${args.version} of template ${args.agentTemplateId} not found`,
      );
    }
    return v;
  }

  /**
   * Helper exposed for cross-tenant guard: returns false if a template
   * with this id exists but belongs to a different tenant.
   */
  async templateVisibleToTenant(
    templateId: string,
    tenantId: string,
  ): Promise<boolean> {
    const t = await this.prisma.agentTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ tenantId }, { tenantId: null, isPublic: true }],
      },
      select: { id: true },
    });
    return !!t;
  }

  // Re-export for callers
  readonly lifecycleStatus: AgentTemplateLifecycleStatus | undefined;
}
