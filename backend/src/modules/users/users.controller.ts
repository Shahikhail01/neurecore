import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ValidatedUser } from '../auth/interfaces/auth.interface';
import {
  isPlatformAuditorRole,
  isPlatformAdminRole,
  isTenantAdminRole,
} from '../../common/types/user-role.utils';

// Type for authenticated user from JWT (includes role and tenantId)
type AuthenticatedUser = ValidatedUser & { sub: string; jti: string };

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private resolveManagedTenantScope(
    user: AuthenticatedUser,
  ): string | undefined {
    return isPlatformAdminRole(user.role)
      ? undefined
      : (user.tenantId ?? undefined);
  }

  private isPlatformUserManager(user: AuthenticatedUser): boolean {
    return isPlatformAdminRole(user.role);
  }

  private resolveCreateTenantId(
    user: AuthenticatedUser,
    requestedTenantId?: string,
  ): string | undefined {
    if (this.isPlatformUserManager(user)) {
      return requestedTenantId;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    if (requestedTenantId && requestedTenantId !== user.tenantId) {
      throw new ForbiddenException('Cannot create users for another tenant');
    }

    return user.tenantId;
  }

  private resolveCreateRole(
    user: AuthenticatedUser,
    requestedRole?: UserRole,
  ): UserRole {
    const targetRole = requestedRole ?? UserRole.USER;

    if (user.role === UserRole.SUPER_ADMIN) {
      return targetRole;
    }

    if (
      user.role === UserRole.PLATFORM_ADMIN &&
      targetRole === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Cannot create SUPER_ADMIN users');
    }

    if (
      !this.isPlatformUserManager(user) &&
      [
        UserRole.SUPER_ADMIN,
        UserRole.PLATFORM_ADMIN,
        UserRole.SECURITY_OFFICER,
        UserRole.SUPPORT,
      ].includes(targetRole)
    ) {
      throw new ForbiddenException(
        'Tenant-scoped admins cannot assign platform roles',
      );
    }

    return targetRole;
  }

  private assertManagedRoleAllowed(
    user: AuthenticatedUser,
    requestedRole?: UserRole,
  ): void {
    if (requestedRole === undefined) {
      return;
    }

    this.resolveCreateRole(user, requestedRole);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tenantId') tenantId?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    // Platform admins can query any tenant; tenant users can only query their own
    const effectiveTenantId = isPlatformAuditorRole(user.role)
      ? tenantId
      : (user.tenantId ?? undefined);
    return this.usersService.findAll(effectiveTenantId, page, limit, search);
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
    return this.usersService.findOne(id, this.resolveManagedTenantScope(user));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    dto.tenantId = this.resolveCreateTenantId(user, dto.tenantId);
    dto.role = this.resolveCreateRole(user, dto.role);
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAdmin =
      isPlatformAdminRole(user.role) || isTenantAdminRole(user.role);
    const isSelf = user.id === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (!isAdmin && (dto.role !== undefined || dto.isActive !== undefined)) {
      throw new ForbiddenException(
        'Only admins can change roles or activation state',
      );
    }

    this.assertManagedRoleAllowed(user, dto.role);

    return this.usersService.update(
      id,
      dto,
      this.resolveManagedTenantScope(user),
    );
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
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivate(
      id,
      this.resolveManagedTenantScope(user),
    );
  }
}
