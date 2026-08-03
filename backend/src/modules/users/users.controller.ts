import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  AssignUserToDepartmentDto,
  Enable2faDto,
  Disable2faDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TierLimitsGuard } from '../../common/guards/tier-limits.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TierLimit } from '../../common/decorators/tier-limit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ValidatedUser } from '../auth/interfaces/auth.interface';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ActionResult } from '../../common/responses/action-result.response';
import type { UserResponseDto } from './dto/user-response.dto';

// Type for authenticated user from JWT (includes role and tenantId)
type AuthenticatedUser = ValidatedUser & { sub: string; jti: string };

@Controller({ path: 'users', version: '1' })
@ApiCommon('users')
@UseGuards(JwtAuthGuard, RolesGuard, TierLimitsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tenantId') tenantId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const effectiveTenantId =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.PLATFORM_ADMIN ||
      user.role === UserRole.SECURITY_OFFICER ||
      user.role === UserRole.SUPPORT
        ? tenantId
        : (user.tenantId ?? undefined);
    const { items, total } = await this.usersService.findAll(
      effectiveTenantId,
      page,
      limit,
      search,
      departmentId,
    );
    return {
      items: items as unknown as UserResponseDto[],
      pagination: { page: page ?? 1, limit: limit ?? 20, total, totalPages: Math.max(1, Math.ceil(total / (limit ?? 20))) },
    };
  }

  /**
   * Resolve the earliest-created OWNER for a tenant.
   * GET /api/v1/users/tenant/:tenantId/owner
   */
  @Get('tenant/:tenantId/owner')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  async findTenantOwner(@Param('tenantId') tenantId: string) {
    const ownerId = await this.usersService.findTenantOwnerId(tenantId);
    return {
      success: true,
      message: ownerId ? 'Tenant owner resolved' : 'Tenant owner not found',
      data: { ownerId },
    };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // Platform admins can query any user; tenant users only their tenant
    const tenantId =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.PLATFORM_ADMIN
        ? undefined
        : (user.tenantId ?? undefined);
    return this.usersService.findOne(id, tenantId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER)
  @TierLimit('maxUsers')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    // Enforce tenantId from JWT for tenant-level users
    if (user.tenantId && !dto.tenantId) {
      dto.tenantId = user.tenantId;
    }
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const adminRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.PLATFORM_ADMIN,
      UserRole.OWNER,
      UserRole.ADMIN,
    ];
    const isAdmin = adminRoles.includes(user.role);
    const isSelf = user.id === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const tenantId =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.PLATFORM_ADMIN
        ? undefined
        : (user.tenantId ?? undefined);
    return this.usersService.update(id, dto, tenantId);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.id !== id) {
      throw new ForbiddenException('Can only change your own password');
    }
    return this.usersService.changePassword(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActionResult<UserResponseDto | null>> {
    const tenantId =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.PLATFORM_ADMIN
        ? undefined
        : (user.tenantId ?? undefined);
    const result = await this.usersService.deactivate(id, tenantId);
    return { success: true, message: 'User deactivated', data: result as unknown as UserResponseDto | null };
  }

  // ─── Phase 2 — Department membership ───────────────────────────────────

  /**
   * Tenant-scoped user lookup. Allows tenant OWNER/ADMIN/USER to view
   * members of their own tenant. Reuses findOne with tenant scope.
   * GET /api/v1/users/tenant/:id
   */
  @Get('tenant/:id')
  findOneTenantScoped(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.usersService.findOne(id, user.tenantId);
  }

  /**
   * List users for a specific department (tenant-scoped).
   * GET /api/v1/users/department/:departmentId
   */
  @Get('department/:departmentId')
  async findByDepartment(
    @Param('departmentId') departmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    const { items, total } = await this.usersService.findAll(
      user.tenantId,
      page,
      limit,
      search,
      departmentId,
    );
    return {
      items: items as unknown as UserResponseDto[],
      pagination: { page: page ?? 1, limit: limit ?? 50, total, totalPages: Math.max(1, Math.ceil(total / (limit ?? 50))) },
    };
  }

  /**
   * Assign a user to a department (tenant-scoped).
   * POST /api/v1/users/:id/assign-department
   * Body: { departmentId: string }
   */
  @Post(':id/assign-department')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  async assignToDepartment(
    @Param('id') userId: string,
    @Body() dto: AssignUserToDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActionResult<null>> {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    await this.usersService.assignToDepartment(
      userId,
      dto.departmentId,
      user.tenantId,
    );
    return { success: true, message: 'User assigned to department' };
  }

  /**
   * Unassign a user from their department (tenant-scoped).
   * POST /api/v1/users/:id/unassign-department
   */
  @Post(':id/unassign-department')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  async unassignFromDepartment(
    @Param('id') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActionResult<null>> {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    await this.usersService.unassignFromDepartment(userId, user.tenantId);
    return { success: true, message: 'User unassigned from department' };
  }

  // ─── Platform-admin actions (SUPER_ADMIN only) ────────────────────────────

  /**
   * Admin-driven password reset. Generates a new random 16-char password,
   * hashes it, persists it, and returns the plaintext ONCE so the admin
   * can convey it to the user. Refuses to act on self.
   * POST /api/v1/users/:id/reset-password
   */
  @Post(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<
    ActionResult<{
      userId: string;
      email: string;
      temporaryPassword: string;
      resetAt: string;
    } | null>
  > {
    const result = await this.usersService.adminResetPassword(id, user.id);
    return {
      success: true,
      message: 'Password reset. Share the temporary password with the user securely.',
      data: result,
    };
  }

  /**
   * Hard-delete a user. SUPER_ADMIN only. Refuses to delete self, and
   * refuses to delete the last remaining SUPER_ADMIN.
   * DELETE /api/v1/users/:id
   */
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActionResult<null>> {
    await this.usersService.adminDeleteUser(id, user.id);
    return {
      success: true,
      message: 'User permanently deleted',
      data: null,
    };
  }
}
