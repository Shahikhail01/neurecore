/**
 * AI Twin — Tenant Controller.
 *
 * Mounted under `/api/v1/ai-twin`. All endpoints require OWNER+ role
 * (or platform admin) — see AiTwinService.
 *
 * Solid: SRP — HTTP boundary only.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { AiTwinService } from './ai-twin.service';

class CreateTwinDto {
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  slug!: string;

  @IsString()
  @Length(1, 120)
  displayName!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  step1Goal!: Record<string, unknown>;
}

class AdvanceWizardDto {
  @IsObject()
  payload!: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  read?: string[];

  @IsArray()
  @IsOptional()
  write?: string[];
}

class DeployTwinDto {
  @IsString()
  agentTemplateId!: string;

  @IsString()
  agentTemplateVersionId!: string;
}

@Controller({ path: 'ai-twin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.PLATFORM_ADMIN, UserRole.SUPER_ADMIN)
export class AiTwinController {
  constructor(private readonly service: AiTwinService) {}

  @Get('twins')
  list(@CurrentUser() user: JwtPayload) {
    return this.service.listMine(user);
  }

  @Get('twins/:id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findById(id, user);
  }

  @Get('twins/:id/audits')
  audits(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.listAudits(id, user);
  }

  @Post('twins')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTwinDto) {
    return this.service.createDraft({
      slug: dto.slug,
      displayName: dto.displayName,
      description: dto.description,
      step1Goal: dto.step1Goal,
      actor: user,
    });
  }

  @Post('twins/:id/wizard/step1')
  step1(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdvanceWizardDto,
  ) {
    return this.service.advanceWizardStep({
      twinId: id,
      step: 1,
      payload: dto.payload,
      actor: user,
    });
  }

  @Post('twins/:id/wizard/step2')
  step2(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdvanceWizardDto,
  ) {
    return this.service.advanceWizardStep({
      twinId: id,
      step: 2,
      payload: dto.payload,
      actor: user,
    });
  }

  @Post('twins/:id/wizard/step3')
  step3(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdvanceWizardDto,
  ) {
    return this.service.advanceWizardStep({
      twinId: id,
      step: 3,
      payload: dto.payload,
      actor: user,
    });
  }

  @Post('twins/:id/wizard/step4')
  step4(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdvanceWizardDto,
  ) {
    return this.service.advanceWizardStep({
      twinId: id,
      step: 4,
      payload: dto.payload,
      scopes: { read: dto.read ?? [], write: dto.write ?? [] },
      actor: user,
    });
  }

  @Post('twins/:id/deploy')
  @HttpCode(HttpStatus.OK)
  deploy(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DeployTwinDto,
  ) {
    return this.service.deploy({
      twinId: id,
      agentTemplateId: dto.agentTemplateId,
      agentTemplateVersionId: dto.agentTemplateVersionId,
      actor: user,
    });
  }

  @Post('twins/:id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.pause(id, user);
  }

  @Post('twins/:id/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.resume(id, user);
  }

  @Post('twins/:id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.archive(id, user);
  }
}
