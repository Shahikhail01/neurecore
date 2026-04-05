import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ForbiddenException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../../../common/decorators/roles.decorator';
import { ConnectorService } from '../services/connector.service';
import {
  RegisterConnectorDto,
  ConnectConnectorDto,
  SyncConnectorDto,
} from '../dto/connector.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';
import { OAuthService } from '../services/oauth.service';

/**
 * ConnectorsController — Phase 4.2
 * SRP: HTTP routing only — all business logic in ConnectorService.
 */
@Controller({ path: 'connectors', version: '1' })
export class ConnectorsController {
  constructor(
    private readonly connectorService: ConnectorService,
    private readonly oauthService: OAuthService,
  ) {}

  private resolveTenantId(
    user: JwtPayload,
    dtoTenantId?: string,
  ): string | null {
    if (user.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN can list all connectors by passing no tenantId
      return dtoTenantId ?? null;
    }
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return user.tenantId;
  }

  private resolveTenantIdRequired(
    user: JwtPayload,
    dtoTenantId?: string,
  ): string {
    const tid = this.resolveTenantId(user, dtoTenantId);
    if (!tid) {
      throw new BadRequestException('tenantId required for this operation');
    }
    return tid;
  }

  /** GET /v1/connectors/providers */
  @Get('providers')
  listProviders() {
    return { providers: this.connectorService.listAvailableProviders() };
  }

  /**
   * GET /v1/connectors/oauth/hubspot/authorize
   * Returns an authorization URL for HubSpot OAuth.
   */
  @Get('oauth/hubspot/authorize')
  oauthHubSpotAuthorize(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('redirectUri') redirectUri?: string,
    @Query('scopes') scopes?: string,
  ) {
    const tid = this.resolveTenantIdRequired(user, tenantId);
    const redirect =
      redirectUri ??
      process.env.HUBSPOT_REDIRECT_URI ??
      'http://localhost:3001/connectors/hubspot/callback';
    const scopeList = scopes
      ? scopes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : ['crm.objects.contacts.read', 'crm.objects.deals.read'];
    return this.oauthService.authorizeHubSpot({
      tenantId: tid,
      redirectUri: redirect,
      scopes: scopeList,
    });
  }

  /**
   * GET /v1/connectors/oauth/hubspot/callback
   * Exchanges code for tokens and persists them encrypted.
   */
  @Get('oauth/hubspot/callback')
  @Public()
  async oauthHubSpotCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    if (!code || !state) throw new BadRequestException('Missing code/state');
    const redirect =
      redirectUri ??
      process.env.HUBSPOT_REDIRECT_URI ??
      'http://localhost:3001/connectors/hubspot/callback';
    return this.oauthService.callbackHubSpot({
      code,
      state,
      redirectUri: redirect,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Google OAuth - Per-Tenant Authorization
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET /v1/connectors/oauth/google/authorize
   * Returns an authorization URL for Google OAuth.
   * Each tenant gets their own OAuth flow for complete data isolation.
   */
  @Get('oauth/google/authorize')
  oauthGoogleAuthorize(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const tid = this.resolveTenantIdRequired(user, tenantId);
    const redirect =
      redirectUri ??
      process.env.GOOGLE_REDIRECT_URI ??
      'http://localhost:3000/api/v1/connectors/oauth/google/callback';

    return this.oauthService.authorizeGoogle({
      tenantId: tid,
      redirectUri: redirect,
    });
  }

  /**
   * GET /v1/connectors/oauth/google/callback
   * Exchanges code for tokens and persists them per-tenant.
   */
  @Get('oauth/google/callback')
  @Public()
  async oauthGoogleCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    if (!code || !state) throw new BadRequestException('Missing code/state');
    const redirect =
      redirectUri ??
      process.env.GOOGLE_REDIRECT_URI ??
      'http://localhost:3000/api/v1/connectors/oauth/google/callback';

    return this.oauthService.callbackGoogle({
      code,
      state,
      redirectUri: redirect,
    });
  }

  /**
   * GET /v1/connectors/oauth/google/status
   * Check if Google is connected for a tenant
   */
  @Get('oauth/google/status')
  async oauthGoogleStatus(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantIdRequired(user, tenantId);
    const isConnected = await this.oauthService.isGoogleConnected(tid);
    return { connected: isConnected, tenantId: tid };
  }

  /**
   * POST /v1/connectors/oauth/google/refresh
   * Refresh Google OAuth token
   */
  @Post('oauth/google/refresh')
  async oauthGoogleRefresh(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantIdRequired(user, tenantId);
    const refreshed = await this.oauthService.refreshGoogleToken(tid);
    return { success: refreshed, tenantId: tid };
  }

  /** GET /v1/connectors */
  @Get()
  listConnectors(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.connectorService.listConnectors(
      this.resolveTenantId(user, tenantId),
    );
  }

  /** POST /v1/connectors */
  @Post()
  registerConnector(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterConnectorDto,
  ) {
    const tid = this.resolveTenantIdRequired(user, dto.tenantId);
    return this.connectorService.createConnector(
      tid,
      dto.name,
      dto.provider,
      dto.config ?? {},
    );
  }

  /** DELETE /v1/connectors/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConnector(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    await this.connectorService.deleteConnector(
      id,
      this.resolveTenantIdRequired(user, tenantId),
    );
  }

  /** POST /v1/connectors/:id/connect */
  @Post(':id/connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConnectConnectorDto,
  ) {
    await this.connectorService.connect(
      id,
      this.resolveTenantIdRequired(user),
      dto.config,
    );
    return { ok: true };
  }

  /** POST /v1/connectors/:id/disconnect */
  @Post(':id/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    await this.connectorService.disconnect(
      id,
      this.resolveTenantIdRequired(user, tenantId),
    );
    return { ok: true };
  }

  /** POST /v1/connectors/:id/sync */
  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  async sync(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncConnectorDto,
  ) {
    const tid = this.resolveTenantIdRequired(user, dto.tenantId);
    const results: Record<string, string> = {};
    if (dto.contacts !== false) {
      await this.connectorService.syncContacts(id, tid);
      results.contacts = 'synced';
    }
    if (dto.leads !== false) {
      await this.connectorService.syncLeads(id, tid);
      results.leads = 'synced';
    }
    return results;
  }
}
