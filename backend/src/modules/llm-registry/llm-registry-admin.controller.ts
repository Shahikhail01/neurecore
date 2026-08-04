/**
 * LLM Provider Registry — Admin Controller.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.4-5.
 * Mounted under `/api/v1/admin/llm-registry` (platform-admin only).
 *
 * Solid:
 *   • SRP — HTTP boundary only. Validation and translation.
 *   • DIP — depends on LlmRegistryService (injected).
 *
 * Per v3 P-1: every route is gated by JwtAuthGuard + RolesGuard; the
 * Roles decorator enforces SUPER_ADMIN / PLATFORM_ADMIN.
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
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LlmProviderKind, LlmProviderStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { LlmRegistryService } from './llm-registry.service';
import { CreateLlmProviderDto, UpdateLlmProviderDto } from './dto/llm-registry.dto';

@Controller({ path: 'admin/llm-registry', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
export class LlmRegistryAdminController {
  constructor(private readonly service: LlmRegistryService) {}

  @Get('providers')
  async listProviders(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: LlmProviderStatus,
    @Query('kind') kind?: LlmProviderKind,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listProviders(
      {
        status,
        kind,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      user,
    );
  }

  @Get('providers/:id')
  async findProvider(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findProviderById(id, user);
  }

  @Post('providers')
  @HttpCode(HttpStatus.CREATED)
  async createProvider(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateLlmProviderDto,
  ) {
    return this.service.createProvider(dto, user);
  }

  @Patch('providers/:id')
  async updateProvider(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateLlmProviderDto,
  ) {
    return this.service.updateProvider(id, dto, user);
  }

  @Delete('providers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProvider(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.deleteProvider(id, user);
  }
}
