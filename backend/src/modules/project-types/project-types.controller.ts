/**
 * ProjectTypes Module — REST API Controller
 *
 * Phase 2: ProjectType + ProjectTypeVersion
 *
 * SOLID:
 * - Single Responsibility: Only handles HTTP requests
 * - Thin controller: Delegates to ProjectTypesService
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
import { ProjectTypesService } from './project-types.service';
import {
  CreateProjectTypeDto,
  UpdateProjectTypeDto,
  CreateProjectTypeVersionDto,
  ListProjectTypesDto,
} from './dto/project-type.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import type {
  ProjectType,
  ProjectTypeVersion,
} from './interfaces/project-type.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@Controller({ path: 'project-types', version: '1' })
@ApiCommon('project-types')
@UseGuards(JwtAuthGuard)
export class ProjectTypesController {
  constructor(private readonly projectTypesService: ProjectTypesService) {}

  @Post()
  async createType(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProjectTypeDto,
  ) {
    return this.projectTypesService.createType(user.tenantId, {
      name: dto.name,
      industry: dto.industry,
      isSystem: dto.isSystem,
    });
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListProjectTypesDto,
  ): Promise<PaginatedResponse<ProjectType>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.projectTypesService.findAllTypes(
      user.tenantId,
      { ...query, page, limit },
    );
    return {
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  async findTypeById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.projectTypesService.findTypeById(id, user.tenantId);
  }

  @Patch(':id')
  async updateType(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProjectTypeDto,
  ) {
    return this.projectTypesService.updateType(id, user.tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteType(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.projectTypesService.deleteType(id, user.tenantId);
  }

  // ─── Version endpoints ─────────────────────────────────────────────────────

  @Get(':id/versions')
  async findVersions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.projectTypesService.findVersionsByTypeId(id, user.tenantId);
  }

  @Get(':id/versions/current')
  async getCurrentVersion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.projectTypesService.getCurrentVersion(id, user.tenantId);
  }

  @Post(':id/versions')
  async createVersion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateProjectTypeVersionDto,
  ) {
    return this.projectTypesService.createVersion(id, user.tenantId, {
      fieldSchema: dto.fieldSchema,
      stageTemplate: dto.stageTemplate,
      approvalTemplate: dto.approvalTemplate,
      goalTemplate: dto.goalTemplate,
      roleTemplate: dto.roleTemplate,
    });
  }

  @Get('versions/:versionId')
  async findVersionById(@Param('versionId') versionId: string) {
    return this.projectTypesService.findVersionById(versionId);
  }
}
