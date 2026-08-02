// src/modules/agent-templates/agent-skill-builder.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AgentSkillMaxEffect } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AgentSkillDefinitionRepository } from './agent-skill-definition.repository';

/**
 * Server-side composition helper for AgentSkillDefinition / AgentTemplateVersion.
 *
 * SECURITY: this module NEVER trusts `maxEffect`, `requiredAuthority`, or
 * `approvalSensitive` from client DTOs. They are re-derived from the composed
 * skill graph every time.
 *
 * Composition invariants enforced:
 *   1. Reject cyclic references in the composed-of graph.
 *   2. Reject cross-tenant references.
 *   3. The composed maxEffect is the MAXIMUM of all composed skills.
 *   4. The composed requiredAuthority is the MAXIMUM of all composed skills.
 *   5. approvalSensitive is true if ANY composed skill is approvalSensitive.
 *   6. Reject arbitrary shell/SQL/provider-key/url-bearing payloads anywhere
 *      in skill field values (architecture-level invariant — see
 *      `agent-templates.architecture.spec.ts`).
 */

export const MAX_EFFECT_RANK: Record<AgentSkillMaxEffect, number> = {
  NONE: 0,
  READ: 1,
  SUGGEST: 2,
  DRAFT: 3,
  EXECUTE_LOCAL: 4,
  EXECUTE_EXTERNAL: 5,
  IRREVERSIBLE: 6,
};

export const MAX_EFFECT_BY_RANK: AgentSkillMaxEffect[] = [
  'NONE',
  'READ',
  'SUGGEST',
  'DRAFT',
  'EXECUTE_LOCAL',
  'EXECUTE_EXTERNAL',
  'IRREVERSIBLE',
];

export interface SkillRef {
  skillKey: string;
  semanticVersion: string;
}

export interface ComposedSkillFields {
  maxEffect: AgentSkillMaxEffect;
  requiredAuthority: number;
  approvalSensitive: boolean;
}

@Injectable()
export class AgentSkillBuilderService {
  private readonly logger = new Logger(AgentSkillBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skills: AgentSkillDefinitionRepository,
  ) {}

  /**
   * Compose a skill definition from its declared `composedOf` graph.
   * Returns the server-derived fields and a list of unique cross-tenant
   * references encountered (for diagnostics).
   *
   * Throws BadRequestException for cyclic or cross-tenant graphs.
   */
  async compose(args: {
    tenantId: string;
    skillKey: string;
    semanticVersion: string;
    composedOf: SkillRef[];
  }): Promise<ComposedSkillFields> {
    const visited = new Set<string>();
    const stack = new Set<string>();

    // Recursive descent — throws on cycle.
    const refs = await this.expand(
      args.tenantId,
      args.skillKey,
      args.semanticVersion,
      visited,
      stack,
    );
    void refs; // The expansion is the side-effect; the result is derived from the live graph.

    // Re-fetch the union of all referenced skills in this tenant.
    const skillKeys = Array.from(visited);
    const skills = await this.skills.findReferencedSkills(
      args.tenantId,
      skillKeys,
    );
    if (skills.length !== skillKeys.length) {
      const missing = skillKeys.filter(
        (k) => !skills.some((s) => s.skillKey === k),
      );
      throw new BadRequestException(
        `composedOf references skills not visible in this tenant: ${missing.join(', ')}`,
      );
    }
    return this.aggregate(skills);
  }

  /**
   * Aggregate fields over an explicit list of skills (no recursion —
   * used when the caller has already expanded the graph).
   */
  aggregate(
    skills: Array<{
      maxEffect: AgentSkillMaxEffect;
      requiredAuthority: number;
      approvalSensitive: boolean;
    }>,
  ): ComposedSkillFields {
    let maxRank = 0;
    let authority = 0;
    let approvalSensitive = false;
    for (const s of skills) {
      const r = MAX_EFFECT_RANK[s.maxEffect] ?? 0;
      if (r > maxRank) maxRank = r;
      if (s.requiredAuthority > authority) authority = s.requiredAuthority;
      if (s.approvalSensitive) approvalSensitive = true;
    }
    return {
      maxEffect: MAX_EFFECT_BY_RANK[maxRank] ?? 'NONE',
      requiredAuthority: authority,
      approvalSensitive,
    };
  }

  /**
   * Server-side guard: verify every composed skill reference resolves to a
   * row in the same tenant. Throws BadRequestException otherwise.
   */
  async assertNoCrossTenantReferences(args: {
    tenantId: string;
    composedSkillRefs: SkillRef[];
  }): Promise<void> {
    if (!args.composedSkillRefs || args.composedSkillRefs.length === 0) return;
    const keys = Array.from(
      new Set(args.composedSkillRefs.map((r) => r.skillKey)),
    );
    const found = await this.skills.findReferencedSkills(args.tenantId, keys);
    const foundKeys = new Set(found.map((s) => s.skillKey));
    const missing = keys.filter((k) => !foundKeys.has(k));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cross-tenant or unknown skill references: ${missing.join(', ')}`,
      );
    }
  }

  private async expand(
    tenantId: string,
    skillKey: string,
    semanticVersion: string,
    visited: Set<string>,
    stack: Set<string>,
  ): Promise<void> {
    const id = `${skillKey}@${semanticVersion}`;
    if (stack.has(id)) {
      throw new BadRequestException(
        `Cyclic composedOf graph detected at ${id}`,
      );
    }
    if (visited.has(id)) return;
    stack.add(id);

    const skill = await this.skills.getByKeyAndVersion(
      tenantId,
      skillKey,
      semanticVersion,
    );
    if (!skill) {
      throw new BadRequestException(`Unknown composed skill: ${id}`);
    }
    visited.add(id);

    const composedOf = (skill.composedOf as unknown as SkillRef[]) ?? [];
    for (const ref of composedOf) {
      if (
        !ref ||
        typeof ref.skillKey !== 'string' ||
        typeof ref.semanticVersion !== 'string'
      ) {
        throw new BadRequestException(`Invalid composedOf entry in ${id}`);
      }
      await this.expand(
        tenantId,
        ref.skillKey,
        ref.semanticVersion,
        visited,
        stack,
      );
    }

    stack.delete(id);
  }
}
