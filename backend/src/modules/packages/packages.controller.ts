/**
 * PackagesController — REST surface for /api/v1/packages.
 *
 * Phase 10 — Admin Business Composition (Pool #6).
 *
 * Standard CRUD plus composition-specific endpoints:
 *   PATCH /:id/composition   → replace M2M in one transactional call
 *   POST  /preview           → dry-run validation + counts
 *   POST  /deploy            → apply package composition to a tenant
 *   GET   /deploy/preview    → dry-run the deploy without writing
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { CreatePackageDto } from './dto/create-package.dto';
import type { UpdatePackageDto } from './dto/update-package.dto';
import type {
  AcceptPackageRecommendationsDto,
  DismissPackageRecommendationsDto,
  PackagePreviewDto,
  SnoozePackageRecommendationsDto,
  UpdatePackageCompositionDto,
} from './dto/package-composition.dto';
import type {
  DeployPackageOutcome,
  PackageDeploymentHistoryItem,
  PreviewPackageOutcome,
} from './dto/package-deployment.dto';
// IMPORTANT: DTOs used as parameter-types on controller methods must be
// imported as VALUES, not `import type`. With `isolatedModules: true` in
// tsconfig.json, `import type { DeployPackageDto }` is elided at emit time
// and TypeScript falls back to `Function` for the parameter type — breaking
// NestJS's @Body() binding (D12.2). The other types (interfaces &
// response shapes) stay `import type` since they are not used as runtime
// parameter types in metadata-emitter-sensitive positions.
import { DeployPackageDto, PreviewPackageDeployDto } from './dto/package-deployment.dto';
import { PackagesService } from './packages.service';
import { PackageDeploymentService } from './services/package-deployment.service';

@ApiTags('packages')
@ApiBearerAuth()
@Controller({ path: 'packages', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
export class PackagesController {
  constructor(
    private readonly packages: PackagesService,
    private readonly deployment: PackageDeploymentService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List packages (composable offerings)' })
  async list(@Query() raw: Record<string, string | undefined>) {
    const opts = this.parseList(raw);
    return this.packages.list(opts);
  }

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get a package by slug' })
  async bySlug(@Param('slug') slug: string) {
    return this.packages.getBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single package with full composition' })
  async getOne(@Param('id') id: string) {
    return this.packages.getById(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Create a new package (identity only)' })
  async create(@Body() body: CreatePackageDto) {
    return this.packages.create(body);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Update package metadata' })
  async update(@Param('id') id: string, @Body() body: UpdatePackageDto) {
    return this.packages.update(id, body);
  }

  @Patch(':id/composition')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Replace composition M2M atomically' })
  async composition(
    @Param('id') id: string,
    @Body() body: UpdatePackageCompositionDto,
  ) {
    return this.packages.updateComposition(id, body);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dry-run composition without writing' })
  async preview(@Body() body: PackagePreviewDto) {
    return this.packages.preview(body);
  }

  @Post('recommendations/accept')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record acceptance of package composition recommendations' })
  async acceptRecommendations(
    @Body() body: AcceptPackageRecommendationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.packages.acceptRecommendations(user.sub, body);
  }

  @Post('recommendations/dismiss')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record dismissal of package composition recommendations with reason' })
  async dismissRecommendations(
    @Body() body: DismissPackageRecommendationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.packages.dismissRecommendations(user.sub, body);
  }

  @Post('recommendations/snooze')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record snoozed package composition recommendations with reason and resume date' })
  async snoozeRecommendations(
    @Body() body: SnoozePackageRecommendationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.packages.snoozeRecommendations(user.sub, body);
  }

  @Get('recommendations/history')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'List accepted package recommendation history for the current composition scope' })
  async recommendationHistory(
    @Query('packageId') packageId?: string,
    @Query('industryId') industryId?: string,
    @Query('tierId') tierId?: string,
    @Query('limit') limit = '10',
  ) {
    return this.packages.listRecommendationHistory({
      packageId,
      industryId,
      tierId,
      limit: Number(limit),
    });
  }

  /**
   * GET /api/v1/packages/deploy/preview?packageId=&tenantId=
   * Dry-run a package deployment. Returns blockers + capacity snapshot.
   * Same scope rules as deploy (OWNER/ADMIN → own tenant, SUPER_ADMIN → any).
   */
  @Get('deploy/preview')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  @ApiOperation({
    summary: 'Dry-run package deployment to a tenant (no writes)',
  })
  async deployPreview(
    @Query() raw: Record<string, string | undefined>,
    @CurrentUser() user: JwtPayload,
  ): Promise<PreviewPackageOutcome> {
    const dto: PreviewPackageDeployDto = {
      packageId: raw.packageId ?? '',
      tenantId: raw.tenantId ?? '',
      withAgents:
        raw.withAgents === undefined ? undefined : raw.withAgents === 'true',
      reason: raw.reason,
    };
    return this.deployment.preview(dto, user.tenantId ?? null, user.role);
  }

  @Get('deploy/history')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List package deployment history for a tenant' })
  async deployHistory(
    @Query('tenantId') tenantId: string,
    @Query('limit') limit = '10',
  ): Promise<PackageDeploymentHistoryItem[]> {
    return this.deployment.listDeploymentHistory(tenantId, Number(limit));
  }

  /**
   * POST /api/v1/packages/deploy
   * Apply a package composition to a tenant in one transaction.
   * OWNER/ADMIN may only deploy to their own tenant.
   */
  @Post('deploy')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Deploy a package composition to a tenant' })
  async deploy(
    @Body() body: DeployPackageDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeployPackageOutcome> {
    return this.deployment.deploy(
      body,
      user.sub,
      user.tenantId ?? null,
      user.role,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Delete a package' })
  async remove(@Param('id') id: string) {
    await this.packages.remove(id);
    return { ok: true };
  }

  private parseList(raw: Record<string, string | undefined>) {
    const opts: Parameters<PackagesService['list']>[0] = {};
    if (raw.page) opts.page = parseInt(raw.page, 10);
    if (raw.limit) opts.limit = parseInt(raw.limit, 10);
    if (raw.search) opts.search = raw.search;
    if (raw.status) opts.status = raw.status;
    if (raw.sortBy) opts.sortBy = raw.sortBy;
    if (raw.sortDir === 'asc' || raw.sortDir === 'desc')
      opts.sortDir = raw.sortDir;
    return opts;
  }
}
