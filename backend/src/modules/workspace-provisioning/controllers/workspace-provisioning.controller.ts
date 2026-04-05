/**
 * WorkspaceProvisioningController
 * Exposes 10 endpoints under /workspace-provisioning (versioned v1).
 * All endpoints require a valid JWT (tenant admin).
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import type { Response } from 'express';
import { ProvisioningJobService } from '../services/provisioning-job.service';
import { ProvisioningOrchestratorService } from '../services/provisioning-orchestrator.service';
import { UpdateProvisioningConfigDto } from '../dto/update-provisioning-config.dto';
import { ConfigService } from '@nestjs/config';

interface RequestWithUser extends Request {
  user?: { tenantId?: string; role?: string };
}

@Controller({ path: 'workspace-provisioning', version: '1' })
export class WorkspaceProvisioningController {
  constructor(
    private readonly jobService: ProvisioningJobService,
    private readonly orchestrator: ProvisioningOrchestratorService,
    private readonly config: ConfigService,
  ) {}

  // ─── GET /workspace-provisioning/status ──────────────────────────────────
  /** Returns whether the tenant has pending provisioning setup. */
  @Get('status')
  async getStatus(@Req() req: RequestWithUser) {
    const tenantId = this.resolveTenantId(req);
    return this.jobService.getPendingStatus(tenantId);
  }

  // ─── GET /workspace-provisioning/config ──────────────────────────────────
  /** Returns the stored provisioning configuration for the tenant. */
  @Get('config')
  async getConfig(@Req() req: RequestWithUser) {
    const tenantId = this.resolveTenantId(req);
    const config = await this.jobService.getConfigByTenantId(tenantId);
    if (!config) return null;
    // Strip raw OAuth tokens from the response
    const { oauthAccessToken: _a, oauthRefreshToken: _r, ...safe } = config;
    void _a;
    void _r;
    return safe;
  }

  // ─── GET /workspace-provisioning/oauth/google/authorize ──────────────────
  /** Returns the Google Workspace OAuth authorisation URL. */
  @Get('oauth/google/authorize')
  getGoogleAuthUrl(@Req() req: RequestWithUser) {
    const tenantId = this.resolveTenantId(req);
    const authUrl = this.orchestrator.getAuthUrl('GOOGLE_WORKSPACE', tenantId);
    return { authUrl };
  }

  // ─── GET /workspace-provisioning/oauth/microsoft/authorize ───────────────
  /** Returns the Microsoft 365 OAuth authorisation URL. */
  @Get('oauth/microsoft/authorize')
  getMicrosoftAuthUrl(@Req() req: RequestWithUser) {
    const tenantId = this.resolveTenantId(req);
    const authUrl = this.orchestrator.getAuthUrl('MICROSOFT_365', tenantId);
    return { authUrl };
  }

  // ─── GET /workspace-provisioning/oauth/google/callback ───────────────────
  /**
   * Handles the Google OAuth callback.
   * Exchanges the code for tokens, stores them, then redirects the admin
   * to the Settings → Workspace tab.
   */
  @Get('oauth/google/callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') tenantId: string,
    @Res() res: Response,
  ) {
    try {
      await this.orchestrator.handleOAuthCallback(
        'GOOGLE_WORKSPACE',
        tenantId,
        code,
      );
    } catch {
      // On error still redirect — frontend will show the error state
    }
    const frontendUrl =
      this.config.get<string>('TENANT_FRONTEND_URL') ?? 'http://localhost:3001';
    res.redirect(`${frontendUrl}/settings?tab=workspace&connected=google`);
  }

  // ─── GET /workspace-provisioning/oauth/microsoft/callback ────────────────
  /** Handles the Microsoft OAuth callback. */
  @Get('oauth/microsoft/callback')
  async handleMicrosoftCallback(
    @Query('code') code: string,
    @Query('state') tenantId: string,
    @Res() res: Response,
  ) {
    try {
      await this.orchestrator.handleOAuthCallback(
        'MICROSOFT_365',
        tenantId,
        code,
      );
    } catch {
      // On error still redirect — frontend will show the error state
    }
    const frontendUrl =
      this.config.get<string>('TENANT_FRONTEND_URL') ?? 'http://localhost:3001';
    res.redirect(`${frontendUrl}/settings?tab=workspace&connected=microsoft`);
  }

  // ─── POST /workspace-provisioning/trigger ────────────────────────────────
  /** Triggers provisioning for all pending jobs of the tenant. */
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async triggerProvisioning(@Req() req: RequestWithUser) {
    const tenantId = this.resolveTenantId(req);
    return this.orchestrator.triggerProvisioning(tenantId);
  }

  // ─── GET /workspace-provisioning/jobs ────────────────────────────────────
  /** Lists all provisioning jobs for the tenant. */
  @Get('jobs')
  async listJobs(@Req() req: RequestWithUser) {
    const tenantId = this.resolveTenantId(req);
    return this.jobService.listJobs(tenantId);
  }

  // ─── PUT /workspace-provisioning/configure ───────────────────────────────
  /**
   * Creates or updates the provisioning config for the tenant.
   * This endpoint is available at any time — not only via the onboarding wizard.
   * If a config already exists it is updated; otherwise a new one is created.
   * On save the OAuth status is set to PENDING_CONNECT so the admin must
   * (re-)connect their cloud account.
   */
  @Put('configure')
  @HttpCode(HttpStatus.OK)
  async configure(
    @Body() dto: UpdateProvisioningConfigDto,
    @Req() req: RequestWithUser,
  ) {
    const tenantId = this.resolveTenantId(req);
    const config = await this.jobService.upsertConfig({
      tenantId,
      provider: dto.provider,
      emailDomain: dto.emailDomain,
      emailPattern: dto.emailPattern,
      folderStructure: dto.folderStructure,
    });
    // Strip raw OAuth tokens from the response (same guard as GET /config)
    const { oauthAccessToken: _a, oauthRefreshToken: _r, ...safe } = config;
    void _a;
    void _r;
    return safe;
  }

  // ─── DELETE /workspace-provisioning/disconnect ───────────────────────────
  /**
   * Clears stored OAuth tokens and resets provisioning status to PENDING_CONNECT.
   * The config (provider, domain, patterns) is preserved so the admin can
   * re-connect without re-entering the setup form.
   */
  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: RequestWithUser) {
    const tenantId = this.resolveTenantId(req);
    await this.jobService.disconnectOAuth(tenantId);
    return { success: true };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private resolveTenantId(req: RequestWithUser): string {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return tenantId;
  }
}
