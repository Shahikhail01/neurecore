/**
 * AgentsController — Phase 13 HTTP surface.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-13-14.md §3.
 *
 * Thin read surface over `AgentRegistry`. Mirrors the
 * `SkillRegistryController` pattern (Phase 11) — implements
 * `implemented` as a derived flag from the runtime registry so we
 * never advertise a skill/agent that's not actually wired.
 *
 * Routes:
 *   GET /api/v1/agents         → list
 *   GET /api/v1/agents/:id     → detail
 *   GET /api/v1/agents/:id/skills → { agentId, skills: [...] } sub-shape
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type {
  AgentId,
  IAgentDefinition,
} from '../agents.registry';
import {
  AgentRegistry,
  PHASE_13_OOB_AGENT_IDS,
} from '../agents.registry';

@Controller({ path: 'agents', version: '1' })
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly registry: AgentRegistry) {}

  /** Public listing — returns the 6 OOB agents. */
  @Get()
  @HttpCode(HttpStatus.OK)
  list(): { data: ReadonlyArray<IAgentDefinition>; total: number } {
    return { data: this.registry.list(), total: this.registry.list().length };
  }

  /** Single-agent detail. Throws NotFound when id is unknown. */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  get(@Param('id') id: string): IAgentDefinition {
    if (!this.isPhase13Id(id)) {
      throw new NotFoundException(`agent ${id} is not registered`);
    }
    return this.registry.get(id);
  }

  /**
   * The skill ids the agent binds to. Stable typed shape so the FE
   * marketplace + chat dispatcher do not have to chase nested fields.
   */
  @Get(':id/skills')
  @HttpCode(HttpStatus.OK)
  skills(@Param('id') id: string): { agentId: AgentId; skills: ReadonlyArray<string> } {
    if (!this.isPhase13Id(id)) {
      throw new NotFoundException(`agent ${id} is not registered`);
    }
    const def = this.registry.get(id);
    return { agentId: id, skills: def.skillKeys };
  }

  /**
   * Narrow allow-list — we only return agents that belong to the
   * Phase 13 OOB catalog. Anything else is a 404 so the FE never
   * receives an unrecognised id from this surface.
   */
  private isPhase13Id(id: string): id is AgentId {
    return (PHASE_13_OOB_AGENT_IDS as readonly string[]).includes(id);
  }
}
