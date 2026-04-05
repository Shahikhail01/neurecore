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
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { KnowledgeService } from './services/knowledge.service';
import {
  AddDocumentDto,
  CreateKnowledgeSpaceDto,
  GrantAccessDto,
  SearchDocumentsDto,
} from './dto/knowledge.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

/**
 * KnowledgeController
 * SRP: HTTP routing only; all logic delegated to KnowledgeService.
 */
@Controller({ path: 'knowledge', version: '1' })
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  private resolveTenantId(user: JwtPayload, tenantId?: string): string {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!tenantId)
        throw new BadRequestException('tenantId required for SUPER_ADMIN');
      return tenantId;
    }
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return user.tenantId;
  }

  // ─── Spaces ────────────────────────────────────────────────────────────

  @Post('spaces')
  @HttpCode(HttpStatus.CREATED)
  createSpace(
    @Body() dto: CreateKnowledgeSpaceDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.createSpace(
      this.resolveTenantId(user, tenantId),
      dto,
    );
  }

  @Get('spaces')
  listSpaces(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.listSpaces(
      this.resolveTenantId(user, tenantId),
    );
  }

  @Get('spaces/:id')
  getSpace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.getSpace(
      id,
      this.resolveTenantId(user, tenantId),
    );
  }

  @Delete('spaces/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSpace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.deleteSpace(
      id,
      this.resolveTenantId(user, tenantId),
    );
  }

  // ─── Documents ────────────────────────────────────────────────────────

  @Post('spaces/:id/documents')
  @HttpCode(HttpStatus.CREATED)
  addDocument(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @Body() dto: AddDocumentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.addDocument(
      spaceId,
      this.resolveTenantId(user, tenantId),
      dto,
    );
  }

  @Get('search')
  searchDocuments(
    @Query() dto: SearchDocumentsDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const limit = dto.limit ? parseInt(dto.limit, 10) : 10;
    return this.knowledgeService.searchDocuments(
      this.resolveTenantId(user, tenantId),
      dto.query,
      limit,
    );
  }

  // ─── Agent access ──────────────────────────────────────────────────────

  @Post('spaces/:id/agents')
  @HttpCode(HttpStatus.CREATED)
  grantAccess(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @Body() dto: GrantAccessDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.grantAgentAccess(
      spaceId,
      this.resolveTenantId(user, tenantId),
      dto.agentId,
    );
  }

  @Delete('spaces/:spaceId/agents/:agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeAccess(
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.revokeAgentAccess(
      spaceId,
      this.resolveTenantId(user, tenantId),
      agentId,
    );
  }

  @Get('spaces/:id/agents')
  listAgentsWithAccess(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.knowledgeService.listAgentsWithAccess(
      spaceId,
      this.resolveTenantId(user, tenantId),
    );
  }
}
