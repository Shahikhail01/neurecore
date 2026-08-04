/**
 * LLM Provider Registry — Tenant Controller.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.5
 * (per-tenant model override). Mounted under
 * `/api/v1/llm-registry` (tenant users).
 *
 * Solid: SRP — HTTP boundary only. All business rules are in
 * LlmRegistryService.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { LlmRegistryService } from './llm-registry.service';

class TenantBindingDto {
  @IsString()
  tenantId!: string;

  @IsUUID()
  providerId!: string;

  @IsUUID()
  modelId!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  requestsPerMinuteCap?: number;
}

@Controller({ path: 'llm-registry', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN, UserRole.SUPER_ADMIN)
export class LlmRegistryTenantController {
  constructor(private readonly service: LlmRegistryService) {}

  @Get('bindings')
  async listBindings(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.listBindings(tenantId, user);
  }

  @Post('bindings')
  @HttpCode(HttpStatus.CREATED)
  async createBinding(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TenantBindingDto,
  ) {
    return this.service.createBinding(
      {
        tenantId: dto.tenantId,
        providerId: dto.providerId,
        modelId: dto.modelId,
        priority: dto.priority,
        requestsPerMinuteCap: dto.requestsPerMinuteCap,
      },
      user,
    );
  }

  @Post('bindings/:id/rotate')
  @HttpCode(HttpStatus.OK)
  async rotateBinding(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.rotateBinding(id, user);
  }

  @Post('bindings/:id/disable')
  @HttpCode(HttpStatus.OK)
  async disableBinding(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.disableBinding(id, user);
  }

  @Post('bindings/:id/enable')
  @HttpCode(HttpStatus.OK)
  async enableBinding(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.reEnableBinding(id, user);
  }

  @Delete('bindings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBinding(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.deleteBinding(id, user);
  }
}
