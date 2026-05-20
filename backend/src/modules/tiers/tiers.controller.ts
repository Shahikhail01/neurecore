/**
 * TiersController - SOLID: Interface Segregation
 *
 * SRP: Only handles HTTP requests for tier operations
 * DIP: Depends on TiersService abstraction
 */

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
  UseGuards,
} from '@nestjs/common';
import { TiersService } from './tiers.service';
import {
  CreateTierDto,
  UpdateTierDto,
  ToggleTierDto,
  ReorderTiersDto,
} from './dto/tier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditLog } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller({ path: 'tiers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TiersController {
  constructor(private readonly tiersService: TiersService) {}

  // ─── Read ────────────────────────────────────────────────────────────────

  @Get()
  findAll() {
    return this.tiersService.findAll();
  }

  @Get('default')
  getDefault() {
    return this.tiersService.getDefault();
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tiersService.findById(id);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tiersService.findBySlug(slug);
  }

  // ─── Write (Platform Admin only) ─────────────────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_CREATE')
  create(@Body() dto: CreateTierDto) {
    return this.tiersService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_UPDATE')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTierDto) {
    return this.tiersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog('TIER_DELETE')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.tiersService.delete(id);
  }

  // ─── State Operations (Platform Admin only) ─────────────────────────────

  @Patch(':id/toggle')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_TOGGLE_ACTIVE')
  toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleTierDto,
  ) {
    return this.tiersService.toggleActive(id, dto.isActive);
  }

  @Post(':id/set-default')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_SET_DEFAULT')
  setDefault(@Param('id', ParseUUIDPipe) id: string) {
    return this.tiersService.setDefault(id);
  }

  @Post('reorder')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('TIER_REORDER')
  reorder(@Body() dto: ReorderTiersDto) {
    return this.tiersService.reorder(dto.orderedIds);
  }
}
