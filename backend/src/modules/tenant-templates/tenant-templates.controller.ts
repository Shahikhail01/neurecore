import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../../common/decorators/roles.decorator';
import { TenantTemplateService } from './tenant-template.service';
import { TenantTemplateSeederService } from './tenant-template-seeder.service';
import { CreateTenantTemplateDto } from './dto/create-tenant-template.dto';
import { UpdateTenantTemplateDto } from './dto/update-tenant-template.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import {
  TenantContextService,
} from '../../common/context/tenant-context.service';
import type { TenantContext } from '../../common/context/tenant-context';
import { PLATFORM_WILDCARD } from '../../common/guards/tenant-context.guard';

/**
 * Single Responsibility: REST surface for tenant-scoped template
 * management. Delegates all queries to `TenantTemplateService` and
 * reads the current tenant from `TenantContextService` (the one
 * populated by `TenantContextGuard`).
 *
 * Why `TenantContextService` instead of `req.user.tenantId`:
 *  - The guard populates `tenantContext` via AsyncLocalStorage so any
 *    downstream code can read it without re-reading the request.
 *  - Reading `user.tenantId` from a JwtPayload only works for plain
 *    JWT payloads, not platform-role calls routed via wildcard
 *    sentinels; this helper handles both shapes uniformly and
 *    surfaces a typed `403 TENANT_CONTEXT_MISSING` (not a 500) when
 *    neither path resolves.
 */
function resolveTenantId(
  user: JwtPayload,
  tenantContext: TenantContext | null,
): string {
  if (tenantContext && tenantContext.tenantId !== PLATFORM_WILDCARD) {
    return tenantContext.tenantId;
  }
  if (user.tenantId) {
    return user.tenantId;
  }
  throw new ForbiddenException({
    code: 'TENANT_CONTEXT_MISSING',
    message:
      'No tenant context for this request. Platform role users must pass `x-tenant-id` or `?tenantId=` to scope to a single tenant.',
  });
}

@Controller({ path: 'tenant-templates', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantTemplatesController {
  constructor(
    private readonly templateService: TenantTemplateService,
    private readonly seederService: TenantTemplateSeederService,
    @Inject(TenantContextService)
    private readonly tenantContextService: TenantContextService,
  ) {}

  private currentTenantId(user: JwtPayload): string {
    // `getOrNull()` returns null outside an HTTP scope instead of
    // throwing — which lets this controller emit a typed 403 rather
    // than the unmapped 500 that the previous implementation
    // produced via TenantContextService.tenantId.
    const ctx = this.tenantContextService.getOrNull();
    try {
      return resolveTenantId(user, ctx);
    } catch (err) {
      // Defensive: if getOrNull threw because ALS scope was lost
      // (background job, etc.), the AuthGuard default user.tenantId
      // is the last resort. Anything else is a true programming error
      // and is surfaced as a typed 500.
      if (err instanceof ForbiddenException) throw err;
      throw new InternalServerErrorException(
        'Tenant context unavailable in this request scope.',
      );
    }
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('type') templateType?: TemplateType,
  ) {
    const tenantId = this.currentTenantId(user);
    return this.templateService.list(tenantId, templateType);
  }

  @Public()
  @Get('system-seeds')
  async listSystemSeeds(@Query('industrySlug') industrySlug?: string) {
    return this.templateService.listSystemSeeds(industrySlug);
  }

  @Get(':id')
  async get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const tenantId = this.currentTenantId(user);
    return this.templateService.get(tenantId, id);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTenantTemplateDto,
  ) {
    const tenantId = this.currentTenantId(user);
    return this.templateService.create(tenantId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTenantTemplateDto,
  ) {
    const tenantId = this.currentTenantId(user);
    return this.templateService.update(tenantId, id, dto);
  }

  @Delete(':id')
  async archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const tenantId = this.currentTenantId(user);
    await this.templateService.archive(tenantId, id);
    return { success: true };
  }

  @Post(':id/clone')
  async clone(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const tenantId = this.currentTenantId(user);
    return this.templateService.clone(tenantId, id);
  }

  @Post('system-seeds/:id/clone')
  async cloneSystemSeed(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const tenantId = this.currentTenantId(user);
    return this.templateService.cloneSystemSeed(tenantId, id);
  }

  @Post('reseed')
  async reseed(
    @CurrentUser() user: JwtPayload,
    @Body('industrySlug') industrySlug: string,
  ) {
    const tenantId = this.currentTenantId(user);
    const count = await this.seederService.reseedForTenant(
      tenantId,
      industrySlug,
    );
    return { count };
  }

  @Post(':id/restore-from-seed')
  async restoreFromSeed(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const tenantId = this.currentTenantId(user);
    return this.templateService.reseedFromSeed(tenantId, id);
  }
}
