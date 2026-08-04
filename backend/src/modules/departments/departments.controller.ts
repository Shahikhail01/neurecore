import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { DepartmentsService } from './services/departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TierLimit } from '../../common/decorators/tier-limit.decorator';
import { TierLimitsGuard } from '../../common/guards/tier-limits.guard';
import { assertSameTenant } from '../../common/utils/assert-same-tenant';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ApiOkResponse } from '@nestjs/swagger';
import { DepartmentResponseDto } from './dto/department-response.dto';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';
import { ContextProvider } from '../context/controllers/context.controller';
import type { ContextResponse } from '@/shared/types/context.types';

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

@Controller({ path: 'departments', version: '1' })
@ApiCommon('departments')
@UseGuards(TierLimitsGuard)
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly contextProvider: ContextProvider,
  ) {}

  private resolveTenantId(user: JwtPayload): string {
    if (user.tenantId) return user.tenantId;
    if (PLATFORM_ROLES.has(user.role as UserRole)) return '*';
    throw new Error('Tenant ID required');
  }

  @Get()
  @ApiOkResponse({ type: PaginatedResponse<DepartmentResponseDto> })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
    // FIX D12.2 / D12.6 — accept an optional `tenantId` query param so the
    // SUPER_ADMIN cross-tenant browse used by /admin/tenants/[id] works.
    // Non-platform users continue to use their JWT tenant (FIX-010
    // sentinel '*' or their own tenantId).
    @Query('tenantId') queryTenantId?: string,
  ): Promise<PaginatedResponse<DepartmentResponseDto>> {
    const PLATFORM_ROLES: readonly string[] = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];
    let targetTenantId: string | null;
    // Phase 0.5 P-1 audit note:
    // Platform admins (SUPER_ADMIN, PLATFORM_ADMIN) may target any tenant via
    // `?tenantId=...`. Per v3 P-1 rule §11, platform-admin cross-tenant access
    // must not rely on a wildcard sentinel — the controller below explicitly
    // resolves the target tenant from the query parameter when the caller is
    // a platform role, or from the JWT tenant otherwise. The previous
    // `user.tenantId !== '*'` check has been removed because it implicitly
    // accepted the wildcard; the JWT now never carries `'*'` as a real
    // tenant id.
    if (queryTenantId && PLATFORM_ROLES.includes(user.role)) {
      targetTenantId = queryTenantId;
    } else if (user.tenantId) {
      targetTenantId = user.tenantId;
    } else if (queryTenantId) {
      // Non-platform caller supplied ?tenantId=... — reject.
      throw new ForbiddenException(
        'tenantId query parameter is reserved for platform administrators',
      );
    } else {
      throw new ForbiddenException('Tenant context required');
    }
    const all = await this.departmentsService.findAll(targetTenantId);
    const start = (pagination.page - 1) * pagination.limit;
    const items = all.slice(start, start + pagination.limit);
    return {
      items: items as unknown as DepartmentResponseDto[],
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: all.length,
        totalPages: Math.max(1, Math.ceil(all.length / pagination.limit)),
      },
    };
  }

  @Get(':id')
  @TenantIsolated()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to get a department');
    }
    const dept = await this.departmentsService.findOne(id, user.tenantId);
    assertSameTenant(user, (dept as { tenantId?: string | null })?.tenantId, {
      resourceType: 'department',
      resourceId: id,
    });
    return dept;
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  @TierLimit('maxDepartments')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDepartmentDto) {
    const tenantId = this.resolveTenantId(user);
    return this.departmentsService.create(dto, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDepartmentDto & { tenantId?: string },
  ) {
    const PLATFORM_ROLES: readonly string[] = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];
    if (!user.tenantId) {
      if (PLATFORM_ROLES.includes(user.role)) {
        if (!dto.tenantId)
          throw new Error('Tenant ID is required for platform admins');
        return this.departmentsService.update(id, dto, dto.tenantId);
      }
      throw new Error('Tenant ID is required to update a department');
    }
    return this.departmentsService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to delete a department');
    }
    return this.departmentsService.remove(id, user.tenantId);
  }

  /**
   * Get cross-functional context for a department
   *
   * SOLID: SRP - Delegates to ContextProvider service
   * Returns initiatives, blockers, and dependencies
   *
   * @param departmentId - Department ID
   * @param user - Current user (from JWT)
   * @returns ContextResponse with initiatives and dependencies
   */
  @Get(':departmentId/context')
  @ApiOkResponse({ description: 'Context data successfully retrieved' })
  async getContext(
    @Param('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ContextResponse> {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to get context');
    }
    return this.contextProvider.getContextForDepartment(
      user.tenantId,
      departmentId,
    );
  }
}
