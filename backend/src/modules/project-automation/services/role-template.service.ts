import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { certifiedPlatformTemplateWhere } from '../../agent-templates/agent-template-certification';
import { DeploymentService } from '../../agents/services/deployment.service';
import { ProjectTypesService } from '../../project-types/project-types.service';
import type { SpawnAgentsResult, RoleTemplateEntry } from '../interfaces/role-template.interface';
import type { Agent } from '@prisma/client';
import type { ProjectRole } from '@prisma/client';

/**
 * Map a free-form role label (e.g. "Project Manager") to the closest Prisma
 * `ProjectRole` enum value. The `ProjectRole` enum is the source of truth for
 * what gets stored in `ProjectMember.role`. If the label doesn't map cleanly,
 * fall back to PROJECT_MANAGER (the safest default — every project has one).
 */
function toProjectRoleEnum(role: string): ProjectRole {
  const normalized = role.toLowerCase().replace(/[\s_-]+/g, '');
  const map: Record<string, ProjectRole> = {
    projectdirector: 'PROJECT_DIRECTOR',
    director: 'PROJECT_DIRECTOR',
    projectmanager: 'PROJECT_MANAGER',
    pm: 'PROJECT_MANAGER',
    researchlead: 'RESEARCH_LEAD',
    researcher: 'RESEARCH_LEAD',
    qualitylead: 'QUALITY_LEAD',
    qa: 'QUALITY_LEAD',
    qalead: 'QUALITY_LEAD',
    reviewer: 'REVIEWER',
    review: 'REVIEWER',
    complianceofficer: 'COMPLIANCE_OFFICER',
    compliance: 'COMPLIANCE_OFFICER',
    clientliaison: 'CLIENT_LIAISON',
    liaison: 'CLIENT_LIAISON',
    accountmanager: 'CLIENT_LIAISON',
    documentationlead: 'DOCUMENTATION_LEAD',
    documentation: 'DOCUMENTATION_LEAD',
    knowledgemanager: 'KNOWLEDGE_MANAGER',
    knowledge: 'KNOWLEDGE_MANAGER',
    chiefofstaff: 'CHIEF_OF_STAFF',
    cos: 'CHIEF_OF_STAFF',
    creativedirector: 'PROJECT_MANAGER',
    chiefmarketingofficer: 'PROJECT_MANAGER',
  };
  return map[normalized] ?? 'PROJECT_MANAGER';
}

@Injectable()
export class RoleTemplateService {
  private readonly logger = new Logger(RoleTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deploymentService: DeploymentService,
    private readonly projectTypesService: ProjectTypesService,
  ) {}

  async spawnAgentsFromTemplate(
    projectId: string,
    projectTypeId: string,
    tenantId: string,
    actorId: string,
  ): Promise<SpawnAgentsResult> {
    const version = await this.projectTypesService.getCurrentVersion(
      projectTypeId,
      tenantId,
    );

    const result: SpawnAgentsResult = { spawned: [], skipped: [], errors: [] };

    if (!version || !version.roleTemplate || (version.roleTemplate as unknown[]).length === 0) {
      this.logger.debug(`No roleTemplate found for projectType ${projectTypeId} — skipping agent spawning`);
      return result;
    }

    const roleEntries = version.roleTemplate as RoleTemplateEntry[];

    for (const entry of roleEntries) {
      try {
        const template = await this.findTemplateByAgentType(entry.agentType);
        if (!template) {
          this.logger.warn(
            `No public agent template found for type "${entry.agentType}" — skipping role "${entry.role}"`,
          );
          result.skipped.push(entry.role);
          continue;
        }

        const agent = await this.deploymentService.spawnFromTemplate(
          template.id,
          {
            name: `${entry.role} — Project ${projectId.slice(0, 8)}`,
            tenantId,
            departmentId: undefined,
          },
          actorId,
          tenantId,
          'SYSTEM',
        );

        // Link the spawned agent to the project as a ProjectMember.
        // SRP: deployment-service doesn't know about ProjectMember linkage —
        // that's a cross-cutting concern owned by the role-template service.
        // Idempotency: check if a member already exists for this agent+project
        // before creating, so re-running automation on the same project is safe.
        const projectRole = toProjectRoleEnum(entry.role);
        const existingMember = await this.prisma.projectMember.findFirst({
          where: { projectId, actorId: agent.id, role: projectRole },
          select: { id: true },
        });
        if (!existingMember) {
          await this.prisma.projectMember.create({
            data: {
              projectId,
              actorId: agent.id,
              actorType: 'AI',
              role: projectRole,
              assignedAt: new Date(),
            },
          });
        }

        result.spawned.push(agent);
        this.logger.debug(
          `Spawned agent "${agent.name}" for role "${entry.role}" on project ${projectId} and linked as ProjectMember`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to spawn agent for role "${entry.role}": ${msg}`);
        result.errors.push(`${entry.role}: ${msg}`);
      }
    }

    return result;
  }

  private async findTemplateByAgentType(
    agentType: string,
  ): Promise<{ id: string; name: string } | null> {
    // Lookup strategy (in order):
    //   1. agentType looks like a Prisma AgentType enum value (CORE | FUNCTIONAL |
    //      EXECUTIVE | META) — match by type column.
    //   2. agentType looks like a name pattern (e.g. "Chief of Staff") — match
    //      against template name with case-insensitive contains.
    //   3. agentType is a direct template id (cuid format) — match by id.
    const AGENT_TYPE_VALUES = new Set(['CORE', 'FUNCTIONAL', 'EXECUTIVE', 'META']);

    if (AGENT_TYPE_VALUES.has(agentType.toUpperCase())) {
      const byType = await this.prisma.agentTemplate.findFirst({
        where: certifiedPlatformTemplateWhere({
          type: agentType.toUpperCase() as never,
        }),
        select: { id: true, name: true },
      });
      if (byType) return byType;
    }

    // Fallback: match by name (case-insensitive contains)
    const byName = await this.prisma.agentTemplate.findFirst({
      where: certifiedPlatformTemplateWhere({
        name: { contains: agentType, mode: 'insensitive' },
      }),
      select: { id: true, name: true },
    });
    if (byName) return byName;

    // Last fallback: try direct id
    if (/^[a-z0-9]{20,30}$/i.test(agentType)) {
      const byId = await this.prisma.agentTemplate.findFirst({
        where: certifiedPlatformTemplateWhere({ id: agentType }),
        select: { id: true, name: true },
      });
      if (byId) return byId;
    }

    return null;
  }
}
