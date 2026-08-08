/**
 * AgentRuntimeRunController — plan-mandated run surface.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §4 (P23) —
 * task 5: "Extend agents.controller.ts with POST /agents/:id/run".
 *
 * The legacy tenant-agent management controller owns `GET /agents` and
 * `GET /agents/:id`; it has no run route. This controller is mounted on
 * the SAME base path (`agents`) but exposes ONLY `POST /agents/:id/run`,
 * so there is no method+path collision. It delegates to `IAgentRuntime`.
 *
 * Tenant scoping: asserted through the runtime + the shared guard.
 * Tenant-foreign runs return 404 via the store (never leak).
 *
 * SOLID — SRP: HTTP only; delegates to `IAgentRuntime`.
 * SOLID — DIP: depends on the injected `AGENT_RUNTIME` token.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { AgentRunResult } from './interfaces/agent-runtime.interface';
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

@Controller({ path: 'agents', version: '1' })
@UseGuards(JwtAuthGuard)
export class AgentRuntimeRunController {
  constructor(@Inject(AGENT_RUNTIME) private readonly runtime: IAgentRuntime) {}

  @Post(':id/run')
  @HttpCode(HttpStatus.OK)
  async run(
    @Param('id') id: string,
    @Body() dto: RunAgentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AgentRunResult> {
    if (!user.tenantId) throw new NotFoundException('Tenant context required');
    if (!(PHASE_13_OOB_AGENT_IDS as readonly string[]).includes(id)) {
      throw new NotFoundException(`agent ${id} is not registered`);
    }
    return this.runtime.run(
      {
        agentId: id as AgentId,
        intent: dto.intent,
        message: dto.message,
        conversationId: dto.conversationId,
        skillInputs: dto.skillInputs,
        explicitSkillKey: dto.explicitSkillKey,
      },
      {
        tenantId: user.tenantId,
        actorUserId: user.sub,
        actorRole: user.role,
        isCrossTenant: false,
      },
    );
  }
}
