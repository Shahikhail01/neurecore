/**
 * command-center.controller.ts - REST endpoints for command center dashboard
 *
 * SOLID - SRP: Exposes only command center aggregation endpoints
 *
 * Legacy:
 * - GET /command-center/summary       — Aggregated dashboard summary
 * - GET /command-center/timeline       — Impact-sorted event timeline
 *
 * P8 (CR-AI-1201..1206) — intelligence tab:
 * - GET /command-center/inventory              — Agents / skills / models / knowledge / channels
 * - GET /command-center/inventory/agents       — Paginated agent inventory
 * - GET /command-center/inventory/skills       — Paginated skill inventory
 * - GET /command-center/inventory/models       — Model inventory (distinct)
 * - GET /command-center/inventory/knowledge    — Knowledge inventory
 * - GET /command-center/inventory/channels     — Channel inventory
 * - GET /command-center/quality                — Evaluator scores, reviews, abstentions
 * - GET /command-center/cost                   — Cost, budgets, utilisation
 * - GET /command-center/model-health           — Per-model latency, error rate, grade
 * - GET /command-center/channel-health         — Connector / OAuth status
 * - GET /command-center/security-events        — Tenant-scoped security audit feed
 * - GET /command-center/kill-switches          — Phase / channel / tenant-feature flags
 * - POST /command-center/kill-switches         — Toggle a flag (audited)
 * - GET /command-center/audit-correlation      — Cross-source audit correlation feed
 *
 * Every endpoint is tenant-scoped at the service layer; the global
 * JwtAuthGuard already protects the controller.
 */

import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommandCenterService } from '../services/command-center.service';
import { InventoryService } from '../services/inventory.service';
import { QualityService } from '../services/quality.service';
import { CostService } from '../services/cost.service';
import { ModelHealthService } from '../services/model-health.service';
import { ChannelHealthService } from '../services/channel-health.service';
import { SecurityEventsService } from '../services/security-events.service';
import { KillSwitchService } from '../services/kill-switch.service';
import { SetKillSwitchDto } from '../dto/kill-switch.dto';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@ApiTags('Command Center')
@ApiBearerAuth()
@Controller({ path: 'command-center', version: '1' })
export class CommandCenterController {
  constructor(
    private readonly commandCenterService: CommandCenterService,
    private readonly inventoryService: InventoryService,
    private readonly qualityService: QualityService,
    private readonly costService: CostService,
    private readonly modelHealthService: ModelHealthService,
    private readonly channelHealthService: ChannelHealthService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly killSwitchService: KillSwitchService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get command center dashboard summary' })
  async getSummary(@CurrentUser() user: JwtPayload) {
    return this.commandCenterService.getCommandCenterSummary(user.tenantId!);
  }

  @Get('timeline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get impact timeline for command center' })
  async getTimeline(
    @CurrentUser() user: JwtPayload,
    @Query('sort') sort: 'impact' | 'recent' | 'priority' = 'impact',
    @Query('filter')
    filter:
      | 'all'
      | 'urgent'
      | 'my-action'
      | 'opportunities'
      | 'blockers' = 'urgent',
    @Query('search') search?: string,
    @Query('limit') limit = '20',
    @Query('page') page = '1',
  ) {
    return this.commandCenterService.getTimelineEvents(user.tenantId!, {
      sort,
      filter,
      search,
      limit: Math.max(1, Math.min(100, parseInt(limit, 10))),
      page: Math.max(1, parseInt(page, 10)),
    });
  }

  @Get('inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'P8 inventory (CR-AI-1201): agents, skills, models, knowledge, channels',
  })
  async getInventory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = '100',
  ) {
    return this.inventoryService.getInventory(
      user.tenantId!,
      Math.max(1, Math.min(500, parseInt(limit, 10))),
    );
  }

  @Get('inventory/agents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P8 inventory: paginated agents' })
  async getInventoryAgents(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = '50',
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.listAgents(user.tenantId!, {
      limit: Math.max(1, Math.min(500, parseInt(limit, 10))),
      cursor,
      status,
      search,
    });
  }

  @Get('inventory/skills')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P8 inventory: paginated skills' })
  async getInventorySkills(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = '50',
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.listSkills(user.tenantId!, {
      limit: Math.max(1, Math.min(500, parseInt(limit, 10))),
      cursor,
      status,
      search,
    });
  }

  @Get('inventory/models')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P8 inventory: distinct models' })
  async getInventoryModels(@CurrentUser() user: JwtPayload) {
    return { models: await this.inventoryService.listModels(user.tenantId!) };
  }

  @Get('inventory/knowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P8 inventory: paginated knowledge entries' })
  async getInventoryKnowledge(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = '50',
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.listKnowledge(user.tenantId!, {
      limit: Math.max(1, Math.min(500, parseInt(limit, 10))),
      cursor,
      status,
      search,
    });
  }

  @Get('inventory/channels')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P8 inventory: connector channels' })
  async getInventoryChannels(@CurrentUser() user: JwtPayload) {
    return {
      channels: await this.inventoryService.listChannels(user.tenantId!),
    };
  }

  @Get('quality')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'P8 quality (CR-AI-1202): evaluator scores, reviews, abstentions',
  })
  async getQuality(
    @CurrentUser() user: JwtPayload,
    @Query('windowHours') windowHours = '168',
    @Query('limit') limit = '50',
  ) {
    return this.qualityService.getQuality(
      user.tenantId!,
      Math.max(1, Math.min(720, parseInt(windowHours, 10))),
      Math.max(1, Math.min(200, parseInt(limit, 10))),
    );
  }

  @Get('cost')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'P8 cost (CR-AI-1203): month-to-date cost, by model, budget utilisation',
  })
  async getCosts(@CurrentUser() user: JwtPayload) {
    return this.costService.getCosts(user.tenantId!);
  }

  @Get('model-health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'P8 model health (CR-AI-1204): per-model latency, error rate, grade',
  })
  async getModelHealth(
    @CurrentUser() user: JwtPayload,
    @Query('windowHours') windowHours = '24',
  ) {
    return this.modelHealthService.getModelHealth(
      user.tenantId!,
      Math.max(1, Math.min(720, parseInt(windowHours, 10))),
    );
  }

  @Get('channel-health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'P8 channel health (CR-AI-1205): connector + OAuth status',
  })
  async getChannelHealth(@CurrentUser() user: JwtPayload) {
    return this.channelHealthService.getChannelHealth(user.tenantId!);
  }

  @Get('security-events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'P8 security events (CR-AI-1206): tenant-scoped security audit feed',
  })
  async getSecurityEvents(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = '100',
  ) {
    return this.securityEventsService.getSecurityEvents(
      user.tenantId!,
      Math.max(1, Math.min(500, parseInt(limit, 10))),
    );
  }

  @Get('kill-switches')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P8 kill switches (CR-AI-1207)' })
  async getKillSwitches(@CurrentUser() user: JwtPayload) {
    return this.killSwitchService.list(user.tenantId!);
  }

  @Post('kill-switches')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'P8 toggle a kill switch (audited)' })
  async setKillSwitch(
    @CurrentUser() user: JwtPayload,
    @Body() body: SetKillSwitchDto,
  ) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Body required');
    }
    return this.killSwitchService.set(user.tenantId!, user, body);
  }

  @Get('audit-correlation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'P8 audit-correlation: cross-source audit log feed grouped by correlationId/causationId',
  })
  async getAuditCorrelation(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = '50',
    @Query('windowHours') windowHours = '24',
    @Query('correlationId') correlationId?: string,
  ) {
    const safeLimit = Math.max(1, Math.min(500, parseInt(limit, 10)));
    const safeHours = Math.max(1, Math.min(24 * 30, parseInt(windowHours, 10)));
    const since = new Date(Date.now() - safeHours * 3600 * 1000);
    const where: Record<string, unknown> = {
      tenantId: user.tenantId!,
      createdAt: { gte: since },
    };
    if (correlationId) where['correlationId'] = correlationId;
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        actor: true,
        action: true,
        resource: true,
        resourceId: true,
        correlationId: true,
        causationId: true,
        result: true,
        createdAt: true,
      },
    });
    return {
      tenantId: user.tenantId!,
      windowStart: since.toISOString(),
      windowEnd: new Date().toISOString(),
      count: rows.length,
      events: rows.map((r) => ({
        id: r.id,
        actor: r.actor,
        action: r.action,
        resource: r.resource,
        resourceId: r.resourceId,
        correlationId: r.correlationId,
        causationId: r.causationId,
        result: r.result,
        occurredAt: r.createdAt.toISOString(),
      })),
    };
  }
}
