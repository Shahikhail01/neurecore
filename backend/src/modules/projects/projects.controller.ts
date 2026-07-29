/**
 * Projects Module — Controller
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
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsDto,
  TransitionProjectStatusDto,
  CloneProjectDto,
} from './dto/project.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ActionResult } from '../../common/responses/action-result.response';
import type { ProjectResponseDto } from './dto/project-response.dto';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

@Controller({ path: 'projects', version: '1' })
@ApiCommon('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  private resolveTenantId(user: JwtPayload): string {
    if (user.tenantId) return user.tenantId;
    if (PLATFORM_ROLES.has(user.role as UserRole)) return '*';
    throw new Error('Tenant ID required');
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(
      {
        name: dto.name,
        description: dto.description,
        departmentId: dto.departmentId,
        customerId: dto.customerId,
        projectTypeId: dto.projectTypeId,
        projectTypeVersion: dto.projectTypeVersion,
        budgetType: dto.budgetType,
        budgetAmount: dto.budgetAmount,
        budgetCurrency: dto.budgetCurrency,
        // FIX-PROJ-D1: forward the caller-supplied status so the FE wizard's
        // dropdown is honoured. Without this, the repo hardcoded 'LEAD'.
        status: dto.status,
        priority: dto.priority,
        tags: dto.tags,
        goalIds: dto.goalIds,
        targetDate: dto.targetDate,
        startDate: dto.startDate,
        customFieldValues: dto.customFieldValues,
        derivedShape: dto.derivedShape,
        derivedShapeVersion: dto.derivedShapeVersion,
      },
      this.resolveTenantId(user),
    );
  }

  @Post('clone')
  async clone(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CloneProjectDto,
  ): Promise<ActionResult<ProjectResponseDto>> {
    const project = await this.projectsService.cloneFromProject(
      dto.sourceProjectId,
      dto.newName,
      this.resolveTenantId(user),
    );
    return {
      success: true,
      message: `Project cloned from ${dto.sourceProjectId}`,
      data: project as unknown as ProjectResponseDto,
    };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListProjectsDto,
  ): Promise<PaginatedResponse<ProjectResponseDto>> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const { data, total } = await this.projectsService.findAll(this.resolveTenantId(user), {
      status: query.status,
      departmentId: query.departmentId,
      customerId: query.customerId,
      search: query.search,
      page,
      limit,
    });
    return {
      items: data as unknown as ProjectResponseDto[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.projectsService.getProjectStats(this.resolveTenantId(user));
  }

  @Get('department/:departmentId')
  async findByDepartment(
    @CurrentUser() user: JwtPayload,
    @Param('departmentId') departmentId: string,
  ) {
    return this.projectsService.findByDepartment(departmentId, this.resolveTenantId(user));
  }

  @Get(':id')
  @TenantIsolated()
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.projectsService.findById(id, this.resolveTenantId(user));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, this.resolveTenantId(user), {
      name: dto.name,
      description: dto.description,
      departmentId: dto.departmentId,
      customerId: dto.customerId,
      projectTypeId: dto.projectTypeId,
      projectTypeVersion: dto.projectTypeVersion,
      budgetType: dto.budgetType,
      budgetAmount: dto.budgetAmount,
      budgetCurrency: dto.budgetCurrency,
      priority: dto.priority,
      tags: dto.tags,
      targetDate: dto.targetDate,
      startDate: dto.startDate,
      goalIds: dto.goalIds,
      customFieldValues: dto.customFieldValues,
      lostReason: dto.lostReason,
      metadata: dto.metadata,
    });
  }

  @Patch(':id/status')
  async transitionStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TransitionProjectStatusDto,
  ): Promise<ActionResult<ProjectResponseDto>> {
    const project = await this.projectsService.transitionStatus(
      id,
      this.resolveTenantId(user),
      dto.status,
      dto.reason,
    );
    return {
      success: true,
      message: `Project transitioned to ${dto.status}`,
      data: project as unknown as ProjectResponseDto,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.projectsService.delete(id, this.resolveTenantId(user));
  }

  @Post(':id/goals/:goalId')
  async addGoal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('goalId') goalId: string,
  ): Promise<ActionResult<ProjectResponseDto>> {
    const project = await this.projectsService.addGoal(
      id,
      goalId,
      this.resolveTenantId(user),
    );
    return {
      success: true,
      message: 'Goal added to project',
      data: project as unknown as ProjectResponseDto,
    };
  }

  @Delete(':id/goals/:goalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeGoal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('goalId') goalId: string,
  ) {
    await this.projectsService.removeGoal(id, goalId, this.resolveTenantId(user));
  }
}
