/**
 * Customers Module — Controller
 *
 * SOLID: thin HTTP layer that delegates to CustomersService.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  AddCustomerContactDto,
  ListCustomersQueryDto,
  MoveCustomerLifecycleDto,
} from './dto/customer.dto';

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

@Controller({ path: 'customers', version: '1' })
@ApiCommon('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private resolveTenantId(user: JwtPayload): string {
    if (user.tenantId) return user.tenantId;
    if (PLATFORM_ROLES.has(user.role)) return '*';
    throw new Error('Tenant ID required');
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(
      {
        name: dto.name,
        industry: dto.industry,
        primaryEmail: dto.primaryEmail,
        primaryPhone: dto.primaryPhone,
        billingInfo: dto.billingInfo,
        tags: dto.tags,
        // Phase 4 — propagate F&C fields through to the service so the
        // repository persists them. The DTO validates the enums; the
        // service/repo never sees unknown fields.
        kycStatus: dto.kycStatus,
        riskRating: dto.riskRating,
        taxId: dto.taxId,
        financialSubType: dto.financialSubType,
        lifecycleStage: dto.lifecycleStage,
      },
      this.resolveTenantId(user),
    );
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListCustomersQueryDto,
  ) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    return this.customersService.findAll(this.resolveTenantId(user), {
      search: query.search,
      status: query.status,
      page,
      limit,
      sortKey: query.sortKey,
      sortDir: query.sortDir,
      // Phase 4 G4 — propagate F&C sub-type filter to the service.
      financialSubType: query.financialSubType,
    });
  }

  @Get(':id')
  @TenantIsolated()
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.findById(id, this.resolveTenantId(user));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, this.resolveTenantId(user), {
      name: dto.name,
      industry: dto.industry,
      primaryEmail: dto.primaryEmail,
      primaryPhone: dto.primaryPhone,
      billingInfo: dto.billingInfo,
      status: dto.status,
      tags: dto.tags,
      // Phase 4 — propagate F&C fields through to the service. Same
      // rationale as create() above.
      kycStatus: dto.kycStatus,
      riskRating: dto.riskRating,
      taxId: dto.taxId,
      financialSubType: dto.financialSubType,
      lifecycleStage: dto.lifecycleStage,
    });
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.archive(id, this.resolveTenantId(user));
  }

  @Post(':id/unarchive')
  unarchive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.unarchive(id, this.resolveTenantId(user));
  }

  /**
   * SIM-04 G-07 — explicit lifecycle-stage transition. Bumps
   * lifecycleUpdatedAt, emits a customer:lifecycle-changed timeline event
   * (via the standard event fabric), and records the reason on the
   * timeline entry. Returns the updated customer row.
   *
   * Idempotent: if `toStage === existing.lifecycleStage`, the call is a
   * no-op and returns the existing row with `lifecycleUpdatedAt`
   * unchanged. This prevents accidental duplicate timeline events when
   * a UI button is double-clicked.
   */
  @Post(':id/lifecycle')
  moveLifecycle(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MoveCustomerLifecycleDto,
  ) {
    return this.customersService.moveLifecycleStage(
      id,
      this.resolveTenantId(user),
      dto.toStage,
      dto.reason,
      user.sub,
    );
  }

  @Post(':id/contacts')
  addContact(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddCustomerContactDto,
  ) {
    return this.customersService.addContact(id, this.resolveTenantId(user), {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      isPrimary: dto.isPrimary,
    });
  }

  @Get(':id/contacts')
  listContacts(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.customersService.listContacts(id, this.resolveTenantId(user));
  }
}
