/**
 * Channels — Controller.
 *
 * Mounted under `/api/v1/channels`:
 *   • GET    /api/v1/channels/catalog     — MCP action catalog
 *   • GET    /api/v1/channels/connections — list connections
 *   • POST   /api/v1/channels/connections — create a connection
 *   • POST   /api/v1/channels/dispatch    — dispatch an outbound action
 *   • POST   /api/v1/channels/ingest      — ingest an inbound event
 *   • GET    /api/v1/channels/events      — list recent events
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
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ChannelKind } from '@prisma/client';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ChannelService } from './channel.service';

class CreateConnectionDto {
  @IsString()
  tenantId!: string;

  @IsEnum(ChannelKind)
  kind!: ChannelKind;

  @IsString()
  displayName!: string;

  @IsString()
  @IsOptional()
  secretRef?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

class DispatchDto {
  @IsString()
  tenantId!: string;

  @IsString()
  connectionId!: string;

  @IsString()
  actionName!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

class IngestDto {
  @IsString()
  tenantId!: string;

  @IsString()
  connectionId!: string;

  @IsObject()
  raw!: Record<string, unknown>;
}

@Controller({ path: 'channels', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.AUDITOR,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPER_ADMIN,
)
export class ChannelsController {
  constructor(private readonly service: ChannelService) {}

  @Get('catalog')
  catalog() {
    return this.service.mcpCatalog();
  }

  @Get('connections')
  listConnections(@Query('tenantId') tenantId: string) {
    return this.service.listConnections(tenantId);
  }

  @Post('connections')
  @HttpCode(HttpStatus.CREATED)
  createConnection(@Body() dto: CreateConnectionDto) {
    return this.service.createConnection(dto);
  }

  @Post('dispatch')
  @HttpCode(HttpStatus.OK)
  dispatch(@Body() dto: DispatchDto) {
    return this.service.dispatch({
      kind: ChannelKind.WEB_ASSISTANT, // overridden by adapter lookup
      tenantId: dto.tenantId,
      connectionId: dto.connectionId,
      actionName: dto.actionName,
      payload: dto.payload,
    });
  }

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(@Body() dto: IngestDto) {
    // Look up the connection's kind from the repository via the service.
    const conn = await this.service.findConnection(dto.tenantId, dto.connectionId);
    return this.service.ingest({
      tenantId: dto.tenantId,
      kind: conn.kind,
      connectionId: dto.connectionId,
      raw: dto.raw,
    });
  }

  @Get('events')
  listEvents(
    @Query('tenantId') tenantId: string,
    @Query('kind') kind?: ChannelKind,
    @Query('status') status?: string,
  ) {
    return this.service.listEvents(tenantId, { kind, status });
  }
}
