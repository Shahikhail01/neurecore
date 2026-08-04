/**
 * DSR (Data Subject Request) — Controller.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.4.8 (GDPR).
 * Mounted under `/api/v1/dsr`.
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DsrRequestStatus, DsrRequestType } from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { DsrService } from './dsr.service';

class OpenDsrDto {
  @IsEnum(DsrRequestType)
  type!: DsrRequestType;

  @IsString()
  subjectId!: string;

  @IsString()
  @IsOptional()
  subjectKind?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

class CompleteDsrDto {
  @IsOptional()
  resolution?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  reason?: string;
}

class RejectDsrDto {
  @IsString()
  reason!: string;
}

class CancelDsrDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

@Controller({ path: 'dsr', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.SUPER_ADMIN)
export class DsrController {
  constructor(private readonly service: DsrService) {}

  @Get('requests')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: DsrRequestStatus,
    @Query('type') type?: DsrRequestType,
  ) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.listRequests(user.tenantId, { status, type });
  }

  @Get('requests/:id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.findById(user.tenantId, id);
  }

  @Get('requests/:id/audit')
  audit(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.listAudit(user.tenantId, id);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  open(@CurrentUser() user: JwtPayload, @Body() dto: OpenDsrDto) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.openRequest({
      tenantId: user.tenantId,
      type: dto.type,
      subjectId: dto.subjectId,
      subjectKind: dto.subjectKind,
      requesterId: user.sub,
      reason: dto.reason,
    });
  }

  @Post('requests/:id/start')
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.startRequest(user.tenantId, id, user.sub);
  }

  @Post('requests/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteDsrDto,
  ) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.completeRequest(
      user.tenantId,
      id,
      user.sub,
      dto.resolution ?? {},
      dto.reason,
    );
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectDsrDto,
  ) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.rejectRequest(user.tenantId, id, user.sub, dto.reason);
  }

  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelDsrDto,
  ) {
    if (!user.tenantId) throw new Error('tenantId required');
    return this.service.cancelRequest(user.tenantId, id, user.sub, dto.reason);
  }
}
