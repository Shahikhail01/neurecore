/**
 * Phase 23 — AgentRuntimeController.
 *
 * HTTP surface for the new agent runtime. Three routes:
 *   POST /agent-runtime/run                 — Router resolves intent + agentId
 *   POST /agent-runtime/agents/:id/run     — explicit agentId, intent required
 *   GET  /agent-runtime/runs/:runId         — fetch a single run
 *   GET  /agent-runtime/runs                — list recent runs
 *
 * Tenant scoping: every method asserts tenantId via the shared
 * AgentTenantScopeGuard. Tenant-foreign runs return 404 (never leak).
 *
 * SOLID — SRP: HTTP only.
 * SOLID — DIP: depends on injected interfaces (AGENT_RUNTIME).
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type {
  AgentRunRequest,
  AgentRunResult,
} from './interfaces/agent-runtime.interface';
import type { AgentId } from '../agent-templates/agents.registry';
import { AGENT_RUNTIME } from './agent-runtime.tokens';
import { Inject } from '@nestjs/common';
import type { IAgentRuntime } from './interfaces/agent-runtime.interface';
import { PHASE_13_OOB_AGENT_IDS } from '../agent-templates/agents.registry';

class RunAgentDto {
  intent!: string;
  message!: string;
  conversationId?: string;
  skillInputs?: Record<string, unknown>;
  explicitSkillKey?: string;
}

@Controller({ path: 'agent-runtime', version: '1' })
@UseGuards(JwtAuthGuard)
export class AgentRuntimeController {
  constructor(@Inject(AGENT_RUNTIME) private readonly runtime: IAgentRuntime) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async run(
    @Body() dto: RunAgentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AgentRunResult> {
    if (!user.tenantId) throw new NotFoundException('Tenant context required');
    const req: AgentRunRequest = {
      agentId: undefined as unknown as AgentId, // router resolves
      intent: dto.intent,
      message: dto.message,
      conversationId: dto.conversationId,
      skillInputs: dto.skillInputs,
      explicitSkillKey: dto.explicitSkillKey,
    };
    return this.runtime.run(req, {
      tenantId: user.tenantId,
      actorUserId: user.sub,
      actorRole: user.role,
      isCrossTenant: false,
    });
  }

  @Post('agents/:id/run')
  @HttpCode(HttpStatus.OK)
  async runExplicit(
    @Param('id') id: string,
    @Body() dto: RunAgentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AgentRunResult> {
    if (!user.tenantId) throw new NotFoundException('Tenant context required');
    if (!(PHASE_13_OOB_AGENT_IDS as readonly string[]).includes(id)) {
      throw new NotFoundException(`agent ${id} is not registered`);
    }
    const req: AgentRunRequest = {
      agentId: id as AgentId,
      intent: dto.intent,
      message: dto.message,
      conversationId: dto.conversationId,
      skillInputs: dto.skillInputs,
      explicitSkillKey: dto.explicitSkillKey,
    };
    return this.runtime.run(req, {
      tenantId: user.tenantId,
      actorUserId: user.sub,
      actorRole: user.role,
      isCrossTenant: false,
    });
  }

  @Get('runs/:runId')
  @HttpCode(HttpStatus.OK)
  async getRun(
    @Param('runId') runId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AgentRunResult> {
    if (!user.tenantId) throw new NotFoundException('Tenant context required');
    return this.runtime.get(runId, {
      tenantId: user.tenantId,
      actorUserId: user.sub,
      actorRole: user.role,
      isCrossTenant: false,
    });
  }

  @Get('runs')
  @HttpCode(HttpStatus.OK)
  async listRuns(
    @Query('agentId') agentId: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReadonlyArray<AgentRunResult>> {
    if (!user.tenantId) throw new NotFoundException('Tenant context required');
    const parsedLimit = limit ? Math.min(200, Math.max(1, Number(limit))) : 50;
    const agent = agentId
      ? (PHASE_13_OOB_AGENT_IDS as readonly string[]).includes(agentId)
        ? (agentId as AgentId)
        : undefined
      : undefined;
    return this.runtime.list(
      {
        tenantId: user.tenantId,
        actorUserId: user.sub,
        actorRole: user.role,
        isCrossTenant: false,
      },
      { agentId: agent, limit: parsedLimit },
    );
  }
}
