import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../common/decorators/roles.decorator';
import { ToolsService } from './tools.service';
import { StructuredToolRegistry } from './structured-tool.registry';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@Controller({ path: 'tools', version: '1' })
@Public()
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly toolRegistry: StructuredToolRegistry,
  ) {}

  // ─── Debug: Get tool count and names ───────────────────────────

  @Get('debug/registry')
  debugRegistry() {
    const toolNames = this.toolRegistry.listToolNames();
    const toolCount = this.toolRegistry.getCount();
    return {
      status: 'success',
      data: {
        count: toolCount,
        names: toolNames,
      },
    };
  }

  // ─── List all registered tools (from structured registry) ─────

  @Get()
  listBuiltIn() {
    // Get tools from structured registry for comprehensive list
    const tools = this.toolRegistry.getToolDefinitions();
    return {
      status: 'success',
      data: tools.map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
      })),
      meta: { count: tools.length },
    };
  }

  // ─── List legacy tools (from ToolsService) ─────────────────────

  @Get('legacy')
  listLegacy() {
    return this.toolsService.list();
  }

  // ─── List integrations for tenant ───────────────────────

  @Get('integrations')
  listIntegrations(@CurrentUser() user: JwtPayload) {
    return this.toolsService.findIntegrations(user.tenantId!);
  }

  // ─── Register a new tool integration ────────────────────

  @Post('register')
  @Roles('ADMIN', 'OWNER')
  registerIntegration(
    @Body()
    body: {
      name: string;
      description?: string;
      type?: string;
      config?: Record<string, unknown>;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.toolsService.registerIntegration(user.tenantId!, body);
  }

  // ─── Execute by tool name (built-in) ─────────────────────

  @Post('execute')
  async execute(
    @Body('tool') tool: string,
    @Body('input') input: Record<string, unknown>,
    @CurrentUser() user?: JwtPayload,
  ) {
    // Check if tool exists in structured registry first
    if (this.toolRegistry.get(tool)) {
      const context = {
        tenantId: user?.tenantId ?? 'default',
        agentId: 'cli',
        taskId: undefined,
        userId: user?.sub,
      };
      const result = await this.toolRegistry.execute(
        tool,
        input as any,
        context,
      );
      return { status: 'success', data: result };
    }
    // Fall back to legacy service
    return this.toolsService.execute(tool, input);
  }

  // ─── Get execution status / stats for integration ───────────

  @Get(':id/status')
  getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.toolsService.getToolStatus(id);
  }

  // ─── Execute a specific integration by id ─────────────────

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  executeById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('input') input: Record<string, unknown>,
    @Body('agentId') agentId?: string,
    @Body('taskId') taskId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.toolsService.executeById(id, input ?? {}, {
      agentId,
      taskId,
      tenantId: user?.tenantId ?? undefined,
    });
  }
}
