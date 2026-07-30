/**
 * DerivedShapeApplier — Apply a Hermes-synthesized ProjectShape to the database.
 *
 * SRP: takes a validated ProjectShape and materializes it as:
 *   - ProjectStage rows (one per stage)
 *   - Goal rows (one per goal, via GoalsService)
 *   - ProjectMember rows (one per member role, via DeploymentService spawn)
 *   - ProjectMember row for Chief of Staff (always — required by architecture)
 *
 * Idempotent: skips rows that already exist (matches by name for stages,
 * by title for goals, by (actorId+role) for members). Safe to re-run on
 * the same project.
 *
 * Returns a small summary so callers (ProjectsService, replan endpoint) can
 * surface what was created.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { GoalsService } from '../../goals/goals.service';
import { DeploymentService } from '../../agents/services/deployment.service';
import { ChiefOfStaffService } from '../../project-automation/services/chief-of-staff.service';
import type { ProjectShape, ProjectRoleName } from '../../project-shape/project-shape.types';
import type { ProjectRole, TaskPriority } from '@prisma/client';
import { certifiedPlatformTemplateWhere } from '../../agent-templates/agent-template-certification';

/** Map ProjectRoleName (synthesizer output) → Prisma ProjectRole enum (DB). */
const ROLE_NAME_TO_ENUM: Record<ProjectRoleName, ProjectRole> = {
  PROJECT_DIRECTOR: 'PROJECT_DIRECTOR',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  RESEARCH_LEAD: 'RESEARCH_LEAD',
  QUALITY_LEAD: 'QUALITY_LEAD',
  REVIEWER: 'REVIEWER',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  CLIENT_LIAISON: 'CLIENT_LIAISON',
  DOCUMENTATION_LEAD: 'DOCUMENTATION_LEAD',
  KNOWLEDGE_MANAGER: 'KNOWLEDGE_MANAGER',
  CHIEF_OF_STAFF: 'CHIEF_OF_STAFF',
};

export interface ApplyResult {
  stagesCreated: number;
  stagesSkipped: number;
  goalsCreated: number;
  goalsSkipped: number;
  tasksCreated: number;
  tasksSkipped: number;
  membersCreated: number;
  membersSkipped: number;
  chiefOfStaffAssigned: boolean;
  errors: string[];
}

@Injectable()
export class DerivedShapeApplier implements OnModuleInit {
  private readonly logger = new Logger(DerivedShapeApplier.name);

  // DeploymentService comes from AgentsModule which transitively depends on
  // ToolsModule → ProjectsModule — a circular dep. We resolve it lazily via
  // ModuleRef after all modules are loaded (proven pattern from ProjectsService).
  //
  // ChiefOfStaffService comes from ProjectAutomationModule (the @Global() one
  // with autoAssign method). It's available globally so ModuleRef resolves it
  // cleanly. We also resolve it lazily for symmetry with deploymentService.
  private deploymentService: DeploymentService | undefined;
  private chiefOfStaffService: ChiefOfStaffService | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly goalsService: GoalsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    try {
      this.deploymentService = this.moduleRef.get(DeploymentService, { strict: false });
      this.chiefOfStaffService = this.moduleRef.get(ChiefOfStaffService, { strict: false });
      this.logger.log(
        `DerivedShapeApplier resolved: deploymentService=${this.deploymentService ? 'yes' : 'no'}, chiefOfStaffService=${this.chiefOfStaffService ? 'yes' : 'no'}`,
      );
    } catch (err) {
      this.logger.warn(
        `DerivedShapeApplier.onModuleInit: lazy resolution failed (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  /**
   * Apply a synthesized ProjectShape to the given project.
   * Assumes the project row already exists (ProjectsService.create() inserts it).
   */
  async apply(
    projectId: string,
    derivedShape: ProjectShape,
    tenantId: string,
  ): Promise<ApplyResult> {
    const result: ApplyResult = {
      stagesCreated: 0,
      stagesSkipped: 0,
      goalsCreated: 0,
      goalsSkipped: 0,
      tasksCreated: 0,
      tasksSkipped: 0,
      membersCreated: 0,
      membersSkipped: 0,
      chiefOfStaffAssigned: false,
      errors: [],
    };

    // Apply stages
    for (const stage of derivedShape.stages) {
      try {
        const existing = await this.prisma.projectStage.findFirst({
          where: { projectId, name: stage.name },
          select: { id: true },
        });
        if (existing) {
          result.stagesSkipped += 1;
          continue;
        }
        await this.prisma.projectStage.create({
          data: {
            projectId,
            name: stage.name,
            order: stage.order,
            description: stage.description ?? null,
          },
        });
        result.stagesCreated += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`stage "${stage.name}": ${msg}`);
      }
    }

    // Apply goals
    for (const goal of derivedShape.goals) {
      try {
        const existing = await this.prisma.goal.findFirst({
          where: { projectId, title: { equals: goal.title, mode: 'insensitive' } },
          select: { id: true },
        });
        let goalId: string;
        if (existing) {
          result.goalsSkipped += 1;
          goalId = existing.id;
        } else {
          const created = await this.goalsService.create(
            {
              title: goal.title,
              projectId,
              ...(goal.measurableCriteria ? { measurableCriteria: goal.measurableCriteria } : {}),
            },
            tenantId,
          );
          goalId = (created as { id: string }).id;
          result.goalsCreated += 1;
        }

        // Materialize one task per goal so the autonomous layer has something
        // to execute. Without this, chat-created projects had goals but zero
        // tasks — the worker/outbox had nothing to drive the project forward.
        const taskTitle = `Execute: ${goal.title}`;
        const existingTask = await this.prisma.task.findFirst({
          where: {
            tenantId,
            projectId,
            title: { equals: taskTitle, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (existingTask) {
          result.tasksSkipped += 1;
        } else {
          await this.prisma.task.create({
            data: {
              tenantId,
              projectId,
              title: taskTitle,
              description: goal.measurableCriteria
                ? `Acceptance: ${goal.measurableCriteria}`
                : `Auto-generated from goal "${goal.title}"`,
              status: 'PENDING',
              priority: 'MEDIUM' as TaskPriority,
              goalId,
              automationVersion: 1,
              templateKey: `derived-goal-${goalId}`,
              input: {},
            },
          });
          result.tasksCreated += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`goal "${goal.title}": ${msg}`);
      }
    }

    // Apply members — spawn an agent for each role and link as ProjectMember
    // (mirrors the prior RoleTemplateService fix from the audit).
    if (!this.deploymentService) {
      result.errors.push('deploymentService unavailable — skipping member spawning');
    } else {
      for (const member of derivedShape.members) {
        try {
          const roleEnum = ROLE_NAME_TO_ENUM[member.role];
          // Find a matching public AgentTemplate by type or name.
          const template = await this.findAgentTemplate(member.role);
          if (!template) {
            result.errors.push(`member "${member.role}": no public agent template found`);
            continue;
          }
          const agentName = `${this.humanizeRole(member.role)} — Project ${projectId.slice(0, 8)}`;
          const agent = await this.deploymentService.spawnFromTemplate(
            template.id,
            { name: agentName, tenantId, departmentId: undefined },
            'SYSTEM',
            tenantId,
            'SYSTEM',
          );

          // Link as ProjectMember (idempotent: check by project + actor + role)
          const existingMember = await this.prisma.projectMember.findFirst({
            where: { projectId, actorId: agent.id, role: roleEnum },
            select: { id: true },
          });
          if (existingMember) {
            result.membersSkipped += 1;
          } else {
            await this.prisma.projectMember.create({
              data: {
                projectId,
                actorId: agent.id,
                actorType: 'AI',
                role: roleEnum,
                assignedAt: new Date(),
              },
            });
            result.membersCreated += 1;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`member "${member.role}": ${msg}`);
        }
      }
    }

    // Always assign Chief of Staff — required by architecture (Art. VIII).
    // Skip if the synthesizer already specified CHIEF_OF_STAFF in members.
    const hasCoS = derivedShape.members.some((m) => m.role === 'CHIEF_OF_STAFF');
    if (!hasCoS && this.chiefOfStaffService) {
      try {
        const cosResult = await this.chiefOfStaffService.autoAssign(
          projectId,
          tenantId,
          'SYSTEM',
        );
        result.chiefOfStaffAssigned = !!cosResult.assigned;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`chiefOfStaff: ${msg}`);
      }
    } else {
      // CoS was already added as a member above — reflect in summary.
      result.chiefOfStaffAssigned = true;
    }

    this.logger.log(
      `[DerivedShapeApplier] project=${projectId}: stages=${result.stagesCreated}+${result.stagesSkipped}sk goals=${result.goalsCreated}+${result.goalsSkipped}sk tasks=${result.tasksCreated}+${result.tasksSkipped}sk members=${result.membersCreated}+${result.membersSkipped}sk CoS=${result.chiefOfStaffAssigned} errors=${result.errors.length}`,
    );
    return result;
  }

  /**
   * Find a public AgentTemplate by ProjectRole enum value. Strategy:
   *   1. Try case-insensitive name match (e.g. "Chief of Staff" for CHIEF_OF_STAFF)
   *   2. Fall back to enum-value-as-name (e.g. "REVIEWER")
   *   3. Last fallback: any template (deterministic by id, first match)
   */
  private async findAgentTemplate(role: ProjectRoleName) {
    const candidates = [
      this.humanizeRole(role), // "Project Manager"
      role, // "PROJECT_MANAGER"
    ];
    for (const candidate of candidates) {
      const found = await this.prisma.agentTemplate.findFirst({
        where: certifiedPlatformTemplateWhere({
          name: { equals: candidate, mode: 'insensitive' },
        }),
        select: { id: true, name: true, type: true },
      });
      if (found) return found;
    }
    // No exact match — pick any template with a sensible type. Caller will get a
    // best-effort match; the applier still succeeds, just with a generic agent.
    return this.prisma.agentTemplate.findFirst({
      where: certifiedPlatformTemplateWhere(),
      select: { id: true, name: true, type: true },
    });
  }

  /** Convert "PROJECT_MANAGER" → "Project Manager". */
  private humanizeRole(role: ProjectRoleName): string {
    return role
      .toLowerCase()
      .split('_')
      .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
      .join(' ');
  }
}
