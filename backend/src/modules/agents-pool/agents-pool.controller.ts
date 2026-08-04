/**
 * AgentsPoolController — REST surface for /api/v1/agents-pool.
 *
 * Phase 10 — extends PoolController with:
 *   PATCH /:id/enabled   → pool-level enable/disable toggle
 *   POST  /:id/duplicate → clone a template for tenant creation
 */

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PoolController } from '../../common/pool/pool.controller';
import type { AgentTemplate } from '@prisma/client';
import type {
  CreateAgentsPoolDto,
} from './dto/create-agents-pool.dto';
import type {
  ToggleEnabledDto,
  UpdateAgentsPoolDto,
} from './dto/update-agents-pool.dto';
import { AgentsPoolService } from './agents-pool.service';
import { SandboxAgentTemplateDto } from './dto/sandbox-agent-template.dto';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@ApiTags('agents-pool')
@ApiBearerAuth()
@Controller({ path: 'agents-pool', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
export class AgentsPoolController extends PoolController<
  AgentTemplate,
  CreateAgentsPoolDto,
  UpdateAgentsPoolDto
> {
  protected readonly service: AgentsPoolService;

  constructor(service: AgentsPoolService) {
    super();
    this.service = service;
  }

  @Patch(':id/enabled')
  async setEnabled(@Param('id') id: string, @Body() body: ToggleEnabledDto) {
    return this.service.toggleEnabled(id, body.enabled);
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string, @Body() body: { name?: string }) {
    return this.service.duplicate(id, body);
  }

  @Post(':id/sandbox-run')
  async sandboxRun(
    @Param('id') id: string,
    @Body() body: SandboxAgentTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.sandboxRun(id, body, user.sub);
  }

  @Get(':id/sandbox-runs')
  async sandboxRuns(@Param('id') id: string) {
    return this.service.listSandboxRuns(id);
  }

  @Get(':id/sandbox-compare')
  async sandboxCompare(
    @Param('id') id: string,
    @Query('leftId') leftId: string,
    @Query('rightId') rightId: string,
  ) {
    return this.service.compareSandboxRuns(id, leftId, rightId);
  }
}
