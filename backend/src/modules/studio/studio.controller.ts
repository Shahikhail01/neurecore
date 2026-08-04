/**
 * Business Studio — Controller.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import {
  StudioComponentOrigin,
  StudioDeploymentKind,
  StudioPageKind,
  StudioProcessKind,
  Prisma,
} from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { StudioService } from './studio.service';

class CreateAppDto {
  @IsString() tenantId!: string;
  @IsString() slug!: string;
  @IsString() displayName!: string;
  @IsString() @IsOptional() description?: string;
  @IsObject() @IsOptional() manifest?: Record<string, unknown>;
}

class CreatePageDto {
  @IsString() tenantId!: string;
  @IsString() appId!: string;
  @IsString() slug!: string;
  @IsString() displayName!: string;
  @IsEnum(StudioPageKind) kind!: StudioPageKind;
  @IsObject() @IsOptional() layout?: Record<string, unknown>;
  @IsArray() @IsOptional() componentIds?: string[];
}

class CreateProcessDto {
  @IsString() tenantId!: string;
  @IsString() appId!: string;
  @IsString() slug!: string;
  @IsString() displayName!: string;
  @IsEnum(StudioProcessKind) kind!: StudioProcessKind;
  @IsObject() @IsOptional() definition?: Record<string, unknown>;
}

class CreateDataModelDto {
  @IsString() tenantId!: string;
  @IsString() appId!: string;
  @IsString() slug!: string;
  @IsString() displayName!: string;
  @IsObject() @IsOptional() fields?: unknown[];
}

class CreateReportDto {
  @IsString() tenantId!: string;
  @IsString() appId!: string;
  @IsString() slug!: string;
  @IsString() displayName!: string;
  @IsObject() @IsOptional() layout?: Record<string, unknown>;
}

class CreateComponentDto {
  @IsString() @IsOptional() tenantId?: string;
  @IsString() slug!: string;
  @IsString() displayName!: string;
  @IsString() description!: string;
  @IsEnum(StudioComponentOrigin) @IsOptional() origin?: StudioComponentOrigin;
  @IsObject() @IsOptional() schema?: Record<string, unknown>;
  @IsUrl() @IsOptional() previewUrl?: string;
}

class RecordDeploymentDto {
  @IsString() tenantId!: string;
  @IsString() appId!: string;
  @IsEnum(StudioDeploymentKind) kind!: StudioDeploymentKind;
  @IsString() version!: string;
  @IsString() @IsOptional() notes?: string;
}

class FinishDeploymentDto {
  @IsString() tenantId!: string;
  @IsEnum(['SUCCEEDED', 'FAILED', 'CANCELLED']) status!: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  @IsString() @IsOptional() errorMessage?: string;
}

@Controller({ path: 'studio', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.AUDITOR,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class StudioController {
  constructor(private readonly service: StudioService) {}

  @Post('apps')
  @HttpCode(HttpStatus.CREATED)
  createApp(@Body() dto: CreateAppDto) {
    return this.service.createApp({
      ...dto,
      manifest: (dto.manifest ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('apps')
  listApps(@Query('tenantId') tenantId: string) {
    return this.service.listApps(tenantId);
  }

  @Get('apps/:id')
  findApp(@Query('tenantId') tenantId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findApp(tenantId, id);
  }

  @Post('apps/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Query('tenantId') tenantId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.publishApp(tenantId, id);
  }

  @Post('pages')
  @HttpCode(HttpStatus.CREATED)
  createPage(@Body() dto: CreatePageDto) {
    return this.service.createPage({
      ...dto,
      layout: (dto.layout ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('apps/:appId/pages')
  listPages(
    @Query('tenantId') tenantId: string,
    @Param('appId', new ParseUUIDPipe()) appId: string,
  ) {
    return this.service.listPages(tenantId, appId);
  }

  @Post('processes')
  @HttpCode(HttpStatus.CREATED)
  createProcess(@Body() dto: CreateProcessDto) {
    return this.service.createProcess({
      ...dto,
      definition: (dto.definition ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Post('data-models')
  @HttpCode(HttpStatus.CREATED)
  createDataModel(@Body() dto: CreateDataModelDto) {
    return this.service.createDataModel({
      ...dto,
      fields: (dto.fields ?? []) as unknown as Prisma.InputJsonValue,
    });
  }

  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  createReport(@Body() dto: CreateReportDto) {
    return this.service.createReport({
      ...dto,
      layout: (dto.layout ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Post('components')
  @HttpCode(HttpStatus.CREATED)
  createComponent(@Body() dto: CreateComponentDto) {
    return this.service.createComponent({
      ...dto,
      tenantId: dto.tenantId ?? null,
      schema: (dto.schema ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }

  @Get('components')
  listComponents(
    @Query('tenantId') tenantId: string,
    @Query('origin') origin?: StudioComponentOrigin,
  ) {
    return this.service.listComponents({ tenantId, origin });
  }

  @Post('deployments')
  @HttpCode(HttpStatus.CREATED)
  recordDeployment(@Body() dto: RecordDeploymentDto) {
    return this.service.recordDeployment(dto);
  }

  @Post('deployments/:id/finish')
  @HttpCode(HttpStatus.OK)
  finishDeployment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: FinishDeploymentDto,
  ) {
    return this.service.finishDeployment({
      tenantId: dto.tenantId,
      id,
      status: dto.status,
      errorMessage: dto.errorMessage,
    });
  }

  @Get('deployments')
  listDeployments(
    @Query('tenantId') tenantId: string,
    @Query('appId') appId?: string,
  ) {
    return this.service.listDeployments(tenantId, appId);
  }
}
