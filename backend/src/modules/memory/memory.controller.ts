import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MemoryService } from './memory.service';
import { CreateMemoryDto, SearchMemoryDto } from './dto/memory.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@Controller({ path: 'memory', version: '1' })
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post()
  store(@Body() dto: CreateMemoryDto, @CurrentUser() user: JwtPayload) {
    return this.memoryService.store({
      ...dto,
      tenantId: user.tenantId!,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Get('search')
  search(@Query() q: SearchMemoryDto, @CurrentUser() user: JwtPayload) {
    return this.memoryService.search({
      ...q,
      tenantId: user.tenantId!,
      limit: q.limit ?? 10,
    });
  }

  @Get('agent/:agentId')
  findByAgent(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = '20',
  ) {
    return this.memoryService.findByAgent(
      agentId,
      user.tenantId!,
      Number(limit),
    );
  }

  /** Purge expired entries scoped to the calling tenant */
  @Delete('purge')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  purge(@CurrentUser() user: JwtPayload) {
    return this.memoryService
      .purgeExpired(user.tenantId!)
      .then((count) => ({ purged: count }));
  }

  /** Delete a specific memory entry by id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.memoryService.remove(id, user.tenantId!);
  }
}
