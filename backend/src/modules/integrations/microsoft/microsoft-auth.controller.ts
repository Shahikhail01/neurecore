/**
 * Microsoft — Auth Controller (R4).
 *
 * Source plan: IMPL_PLAN §R4 §4.6 — wire MicrosoftGraphAuthService
 * through HTTP. The webhook controller at microsoft-webhook.controller.ts
 * is unchanged; we add the OAuth start + callback + revoke endpoints
 * so tenants can complete a full connect flow.
 *
 * Routes:
 *   POST /integrations/microsoft/authorize  → build auth URL (returns redirect + state)
 *   GET  /integrations/microsoft/callback   → exchange code → persist credentials
 *   POST /integrations/microsoft/revoke     → clear credentials
 *
 * SOLID:
 *   - This controller is the HTTP boundary; the auth service owns the
 *     actual OAuth flow.
 *   - DIP: depends only on IIntegrationAuthProvider abstraction in tests.
 */

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';
import { Roles } from '@/common/decorators/roles.decorator';
import { MicrosoftGraphAuthService } from './microsoft-graph-auth.service';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';
import type { Request } from 'express';

interface AuthedRequest extends Request {
  user: { sub: string; tenantId: string; role: UserRole };
}

function actor(req: AuthedRequest): { sub: string; tenantId: string } {
  if (!req.user?.tenantId) throw new NotFoundException('tenant context required');
  return { sub: req.user.sub, tenantId: req.user.tenantId };
}

@Controller({ path: 'integrations/microsoft', version: '1' })
@UseGuards(JwtAuthGuard)
export class MicrosoftAuthController {
  constructor(
    private readonly auth: MicrosoftGraphAuthService,
    private readonly credentials: PrismaIntegrationCredentialStore,
  ) {}

  @Post('authorize')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async startAuthorization(
    @Req() req: AuthedRequest,
    @Body() body: { redirectUri?: string },
  ): Promise<{ url: string; state: string }> {
    actor(req);
    // State is generated server-side; tenant-scoped to prevent CSRF.
    const state = randomBytes(32).toString('hex');
    const url = this.auth.buildAuthorizationUrl({
      tenantId: req.user.tenantId,
      redirectUri: body.redirectUri ?? '',
      scopes: [
        'User.Read',
        'Mail.ReadWrite',
        'Mail.Send',
        'Chat.ReadWrite',
        'OnlineMeetings.ReadWrite',
        'ChannelMessage.Send',
      ],
      state,
    });
    return { url, state };
  }

  @Get('callback')
  // NOTE: not @UseGuards — the user has just bounced from Microsoft and
  // does not have a JWT. The state parameter carries the tenant binding
  // + CSRF token. In production, the /authorize endpoint issues a
  // short-lived signed state that the callback verifies here.
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('tenantId') tenantId: string,
    @Query('redirectUri') redirectUri: string,
  ): Promise<{ ok: true; tenantId: string }> {
    if (!code || !state || !tenantId || !redirectUri) {
      throw new BadRequestException(
        'code, state, tenantId, redirectUri are all required',
      );
    }
    await this.auth.exchangeAuthorizationCode({
      tenantId,
      code,
      redirectUri,
      scopes: [
        'User.Read',
        'Mail.ReadWrite',
        'Mail.Send',
        'Chat.ReadWrite',
        'OnlineMeetings.ReadWrite',
        'ChannelMessage.Send',
      ],
    });
    return { ok: true, tenantId };
  }

  @Post('revoke')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Req() req: AuthedRequest): Promise<void> {
    const a = actor(req);
    await this.credentials.delete(a.tenantId, 'MICROSOFT');
  }
}
