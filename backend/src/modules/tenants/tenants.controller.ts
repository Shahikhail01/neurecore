import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  ChangeTierDto,
} from './dto/tenant.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller({ path: 'tenants', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** GET /tenants/me — returns the authenticated user's own tenant */
  @Get('me')
  getMyTenant(@CurrentUser() user: any) {
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant associated with this account');
    }
    return this.tenantsService.findOne(user.tenantId);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.tenantsService.findAll(page, limit, search);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (
      user?.role === UserRole.OWNER &&
      user?.tenantId &&
      user.tenantId !== id
    ) {
      throw new ForbiddenException(
        'Tenant owners may only access their own tenant',
      );
    }
    return this.tenantsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  suspend(@Param('id') id: string) {
    return this.tenantsService.suspend(id);
  }

  @Patch(':id/change-tier')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  changeTier(@Param('id') id: string, @Body() dto: ChangeTierDto) {
    return this.tenantsService.changeTier(id, dto.tierId);
  }
}
