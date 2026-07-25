/**
 * WorkflowsController — REST API for workflow management.
 *
 * SOLID principles:
 *   - Single Responsibility: HTTP transport only, no business logic
 *   - Open/Closed: new endpoint variants added without modifying service
 *   - Dependency Inversion: depends on WorkflowsService (interface), not implementation
 *
 * API surface matches frontend WorkflowRepository expectations:
 *   GET    /workflows           — paginated list (status, search filters)
 *   GET    /workflows/:id      — single workflow
 *   POST   /workflows           — create workflow
 *   PATCH  /workflows/:id       — update workflow
 *   DELETE /workflows/:id       — delete workflow
 *   PATCH  /workflows/:id/activate — activate workflow
 *   POST   /workflows/:id/execute  — trigger execution
 *   GET    /workflows/:id/status    — execution summary
 *   GET    /workflows/industry-templates?group=<industryGroup>&category=<category>
 *     — Stage 2 Phase 2D: industry-specific workflow templates
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { WorkflowsService } from './services/workflows.service';
import { IndustryWorkflowTemplatesService } from './industry-workflow-templates.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ActionResult } from '../../common/responses/action-result.response';
import {
  WorkflowResponseDto,
  WorkflowExecutionSummaryDto,
} from './dto/workflow-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole, WorkflowStatus } from '@prisma/client';

@Controller({ path: 'workflows', version: '1' })
@ApiCommon('workflows')
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly workflowTemplatesService: IndustryWorkflowTemplatesService,
  ) {}

  // ─── Read ────────────────────────────────────────────────────────────────

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
    @Query('status') status?: WorkflowStatus,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<WorkflowResponseDto>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { items, total, page, limit } = await this.workflowsService.findAll(
      user.tenantId,
      { page: pagination.page, limit: pagination.limit, status, search },
    );
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkflowResponseDto> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.findOne(id, user.tenantId);
  }

  @Get(':id/status')
  async getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkflowExecutionSummaryDto> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.getStatus(id, user.tenantId);
  }

  /**
   * GET /api/v1/workflows/templates/industry?group=<industryGroup>&category=<category>
   * Stage 2 Phase 2D: Per-industry automated workflow definitions.
   * Single-segment path (`templates/industry`) to avoid the `:id` param matcher
   * that was previously shadowing the literal `industry-templates` segment.
   */
  @Get('templates/industry')
  async getIndustryTemplates(
    @Query('group') group?: string,
    @Query('category') category?: string,
  ) {
    const effectiveGroup = group ?? 'other';
    const templates = category
      ? this.workflowTemplatesService.getByCategory(effectiveGroup, category)
      : this.workflowTemplatesService.getTemplateList(effectiveGroup);
    return { industryGroup: effectiveGroup, count: templates.length, templates };
  }

  // ─── Write ───────────────────────────────────────────────────────────────

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  async create(
    @Body() dto: CreateWorkflowDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkflowResponseDto> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.create(dto, user.tenantId);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkflowResponseDto> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.workflowsService.remove(id, user.tenantId);
  }

  // ─── Status transitions ─────────────────────────────────────────────────

  @Patch(':id/activate')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<WorkflowResponseDto>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const workflow = await this.workflowsService.activate(id, user.tenantId);
    return {
      success: true,
      message: 'Workflow activated',
      data: workflow,
    };
  }

  @Patch(':id/pause')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<WorkflowResponseDto>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const workflow = await this.workflowsService.pause(id, user.tenantId);
    return {
      success: true,
      message: 'Workflow paused',
      data: workflow,
    };
  }

  // ─── Execute ─────────────────────────────────────────────────────────────

  @Post(':id/execute')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { input?: Record<string, unknown> },
  ): Promise<ActionResult<{ executionId: string }>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const { executionId } = await this.workflowsService.execute(
      id,
      user.tenantId,
      body.input,
    );
    return {
      success: true,
      message: 'Workflow execution started',
      data: { executionId },
    };
  }
}
