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
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentsService } from './services/departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import {
  AssignDepartmentParentDto,
  AssignDepartmentTierSlotDto,
} from './dto/department-assignment.dto';
import { AuditLog } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';
import { TenantResourcePolicyService } from '../tiers/services/tenant-resource-policy.service';
import { isPlatformOperatorRole } from '../../common/types/user-role.utils';

@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
    private readonly tenantPolicy: TenantResourcePolicyService,
  ) {}

  private resolveTenantId(user: JwtPayload, tenantId?: string): string {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!tenantId)
        throw new BadRequestException('tenantId is required for SUPER_ADMIN');
      return tenantId;
    }
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return user.tenantId;
  }

  private isPlatformRole(user: JwtPayload): boolean {
    return isPlatformOperatorRole(user.role);
  }

  private async resolveExistingDepartmentTenantId(
    user: JwtPayload,
    departmentId: string,
    tenantId?: string,
  ): Promise<string> {
    if (!this.isPlatformRole(user)) {
      return this.resolveTenantId(user, tenantId);
    }

    const department = (await this.departmentsService.findOneForPlatform(
      departmentId,
    )) as {
      tenantId?: string;
    };

    if (!department.tenantId) {
      throw new NotFoundException(`Department ${departmentId} not found`);
    }

    return department.tenantId;
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    const isPlatformRole = this.isPlatformRole(user);

    const effectiveTenantId = isPlatformRole ? tenantId : user.tenantId;

    if (!isPlatformRole && !user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    if (isPlatformRole && !tenantId && scope !== 'platform') {
      throw new BadRequestException(
        'tenantId is required unless scope=platform is explicitly provided',
      );
    }

    return this.departmentsService.findAll(effectiveTenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    if (this.isPlatformRole(user) && scope === 'platform') {
      return this.departmentsService.findOneForPlatform(id);
    }

    return this.departmentsService.findOne(
      id,
      this.resolveTenantId(user, tenantId),
    );
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('DEPARTMENT_CREATE')
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = dto.tenantId ?? tenantId;
    return this.departmentsService.create({
      ...dto,
      tenantId: this.resolveTenantId(user, effectiveTenantId),
    });
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('DEPARTMENT_UPDATE')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const sanitizedDto =
      user.role === UserRole.SUPER_ADMIN
        ? dto
        : this.tenantPolicy.assertAllowedTenantDepartmentUpdate(
            dto as Record<string, unknown>,
          );

    return this.resolveExistingDepartmentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.departmentsService.update(id, effectiveTenantId, sanitizedDto),
    );
  }

  @Post(':id/assign-parent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('DEPARTMENT_ASSIGN_PARENT')
  assignParent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDepartmentParentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingDepartmentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.departmentsService.assignParent(
          id,
          effectiveTenantId,
          dto.parentId,
        ),
    );
  }

  @Post(':id/unassign-parent')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('DEPARTMENT_UNASSIGN_PARENT')
  unassignParent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingDepartmentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.departmentsService.assignParent(id, effectiveTenantId, null),
    );
  }

  @Post(':id/assign-tier-slot')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('DEPARTMENT_ASSIGN_TIER_SLOT')
  assignTierSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDepartmentTierSlotDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingDepartmentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.departmentsService.assignTierSlot(
          id,
          effectiveTenantId,
          dto.slotId,
        ),
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog('DEPARTMENT_DELETE')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingDepartmentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.departmentsService.remove(id, effectiveTenantId),
    );
  }
}
