/**
 * Authentication Controller
 * Handles login, logout, and token refresh
 * SOLID: Single Responsibility - Auth endpoints only
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  BadRequestException,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService, User, LoginRequest } from '../services/auth.service';
import { AuditLogService, AuditEventType } from '../services/audit-log.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser, Public, AuditLog } from '../decorators/auth.decorator';
import { JwtPayload } from '../services/auth.service';

/**
 * DTO for refresh token request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * DTO for login response
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

/**
 * AuthController - Authentication endpoints
 * Base path: /api/v1/auth
 *
 * SOLID:
 * - S: Only authentication endpoints
 * - O: Can add new auth methods (OAuth, SAML) without changing existing
 * - L: Uses guard interfaces properly
 * - I: Segregated, minimal endpoint interface
 * - D: Services injected (AuthService, AuditLogService)
 */
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Login endpoint
   * POST /api/v1/auth/login
   * @param request Email and password
   * @param response Express response
   * @returns LoginResponse with tokens
   */
  @Post('login')
  @Public()
  @AuditLog('LOGIN')
  async login(
    @Body() request: LoginRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!request.email || !request.password) {
      throw new BadRequestException('Email and password required');
    }

    // TODO: Validate credentials against NocoDB users collection
    // For now, mock user
    const user: User = {
      id: 'user-123',
      email: request.email,
      passwordHash: 'hashed',
      tenantId: 'tenant-123',
      role: 'admin' as any, // Import UserRole enum
      isActive: true,
      createdAt: new Date(),
    };

    const tokens = this.authService.generateTokens(user);

    // Audit log
    await this.auditLogService.logAuthEvent(
      user.id,
      AuditEventType.LOGIN,
      'SUCCESS',
      { email: user.email },
    );

    // Return tokens (refresh token can be HTTP-only cookie)
    response.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    } as LoginResponse);
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   * @param request Refresh token
   * @param user Current user
   * @returns New tokens
   */
  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @AuditLog('TOKEN_REFRESH')
  async refreshToken(
    @Body() request: RefreshTokenRequest,
    @CurrentUser() user: JwtPayload,
  ): Promise<LoginResponse> {
    if (!request.refreshToken) {
      throw new BadRequestException('Refresh token required');
    }

    // Validate refresh token
    const payload = this.authService.validateRefreshToken(request.refreshToken);

    if (!payload) {
      await this.auditLogService.logSecurityEvent({
        userId: user.userId,
        action: 'INVALID_REFRESH_TOKEN',
        resource: '/auth/refresh',
        details: { reason: 'Token validation failed' },
        status: 'FAILED',
      });

      throw new UnauthorizedException('Invalid refresh token');
    }

    // TODO: Load user from NocoDB
    const currentUser: User = {
      id: user.userId,
      email: user.email,
      passwordHash: '',
      tenantId: user.tenantId,
      role: user.role,
      isActive: true,
      createdAt: new Date(),
    };

    // Generate new tokens
    const tokens = this.authService.generateTokens(currentUser);

    await this.auditLogService.logAuthEvent(
      user.userId,
      AuditEventType.TOKEN_REFRESH,
      'SUCCESS',
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
        tenantId: currentUser.tenantId,
      },
    };
  }

  /**
   * Logout endpoint
   * POST /api/v1/auth/logout
   * Invalidates refresh token
   * @param user Current user
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @AuditLog('LOGOUT')
  async logout(@CurrentUser() user: JwtPayload): Promise<{ message: string }> {
    // TODO: Invalidate refresh token in NocoDB sessions collection
    // Delete from sessions table: SELECT * WHERE userId = $1

    await this.auditLogService.logAuthEvent(
      user.userId,
      AuditEventType.LOGOUT,
      'SUCCESS',
    );

    return { message: 'Logged out successfully' };
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   * Returns authenticated user info
   * @param user Current user
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: JwtPayload): Promise<JwtPayload> {
    return user;
  }

  /**
   * Validate token endpoint
   * POST /api/v1/auth/validate
   * Checks if token is valid
   * @param request Access token
   */
  @Post('validate')
  @Public()
  async validateToken(
    @Body() request: { token: string },
  ): Promise<{ valid: boolean; payload?: JwtPayload }> {
    if (!request.token) {
      return { valid: false };
    }

    const payload = this.authService.validateAccessToken(request.token);

    if (!payload) {
      return { valid: false };
    }

    return { valid: true, payload };
  }

  /**
   * Health check for auth service
   * GET /api/v1/auth/health
   * No auth required
   */
  @Get('health')
  @Public()
  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
