/**
 * Authentication Controller (Phase 2 Complete)
 * Full authentication endpoints with password hashing and session management
 * SOLID: Controller interface - orchestrates services
 *
 * Base path: /api/v1/auth
 *
 * @author NeureCore Development
 * @version 1.1.0
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
import {
  AuthenticationService,
  RegisterInput,
  LoginResponse,
} from '../../core/services/authentication.service';
import {
  AuditLogService,
  AuditEventType,
} from '../../core/services/audit-log.service';
import { AuthService } from '../../core/services/auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  Public,
  AuditLog,
} from '../../common/decorators/auth.decorator';
import { JwtPayload } from '../../core/services/auth.service';

/**
 * Login request DTO
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Refresh token request DTO
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * AuthController - Complete authentication endpoints
 * Base path: /api/v1/auth
 *
 * SOLID:
 * - S: Only authentication endpoints
 * - O: Can add new auth methods without changing existing
 * - L: Uses service interfaces properly
 * - I: Minimal, focused endpoints
 * - D: Services injected via constructor
 */
@Controller('api/v1/auth')
export class Phase2AuthController {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly baseAuthService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Register new user
   * POST /api/v1/auth/register
   * @param request Email, password, name
   * @returns Created user and tokens
   */
  @Post('register')
  @Public()
  @AuditLog('USER_REGISTERED')
  async register(
    @Body() request: RegisterInput,
    @Res() response: Response,
  ): Promise<void> {
    if (!request.email || !request.password) {
      throw new BadRequestException('Email and password required');
    }

    try {
      const user = await this.authenticationService.register(request);

      await this.auditLogService.logAuthEvent(
        user.id,
        AuditEventType.LOGIN,
        'SUCCESS',
        { email: user.email, action: 'registered' },
      );

      response.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
        },
      });
    } catch (error) {
      await this.auditLogService.logSecurityEvent({
        userId: null,
        action: 'REGISTRATION_FAILED',
        resource: '/auth/register',
        details: { email: request.email, reason: error.message },
        status: 'FAILED',
      });
      throw error;
    }
  }

  /**
   * Login with email and password
   * POST /api/v1/auth/login
   * @param request Email and password
   * @returns Tokens and user info
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

    try {
      const result = await this.authenticationService.login(request);

      // Set refresh token as HTTP-only cookie (secure option)
      response
        .cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })
        .status(200)
        .json({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken, // Also return in body for flexibility
          expiresIn: result.expiresIn,
          user: result.user,
        } as LoginResponse);
    } catch (error) {
      await this.auditLogService.logSecurityEvent({
        userId: null,
        action: 'LOGIN_FAILED',
        resource: '/auth/login',
        details: { email: request.email, reason: error.message },
        status: 'FAILED',
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   * @param request Refresh token
   * @returns New tokens
   */
  @Post('refresh')
  @Public()
  @AuditLog('TOKEN_REFRESH')
  async refreshToken(
    @Body() request: RefreshTokenRequest,
  ): Promise<LoginResponse> {
    if (!request.refreshToken) {
      throw new BadRequestException('Refresh token required');
    }

    try {
      return await this.authenticationService.refreshToken(
        request.refreshToken,
      );
    } catch (error) {
      const userId = this.baseAuthService.extractUserIdFromToken(
        request.refreshToken,
      );

      await this.auditLogService.logSecurityEvent({
        userId,
        action: 'TOKEN_REFRESH_FAILED',
        resource: '/auth/refresh',
        details: { reason: error.message },
        status: 'FAILED',
      });

      throw error;
    }
  }

  /**
   * Logout (revoke all refresh tokens)
   * POST /api/v1/auth/logout
   * @param user Current user
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @AuditLog('LOGOUT')
  async logout(@CurrentUser() user: JwtPayload): Promise<{ message: string }> {
    await this.authenticationService.logout(user.userId);

    await this.auditLogService.logAuthEvent(
      user.userId,
      AuditEventType.LOGOUT,
      'SUCCESS',
    );

    return { message: 'Logged out successfully' };
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   * @param request Email
   */
  @Post('forgot-password')
  @Public()
  @AuditLog('PASSWORD_RESET_REQUESTED')
  async requestPasswordReset(
    @Body() request: { email: string },
  ): Promise<{ message: string }> {
    if (!request.email) {
      throw new BadRequestException('Email required');
    }

    try {
      await this.authenticationService.requestPasswordReset(request.email);

      return { message: 'If email exists, reset link has been sent' };
    } catch (error) {
      await this.auditLogService.logSecurityEvent({
        userId: null,
        action: 'PASSWORD_RESET_FAILED',
        resource: '/auth/forgot-password',
        details: { email: request.email, reason: error.message },
        status: 'FAILED',
      });

      // Return generic message for security
      return { message: 'If email exists, reset link has been sent' };
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   * @param request Reset token and new password
   */
  @Post('reset-password')
  @Public()
  @AuditLog('PASSWORD_RESET')
  async resetPassword(
    @Body() request: { resetToken: string; newPassword: string },
  ): Promise<{ message: string }> {
    if (!request.resetToken || !request.newPassword) {
      throw new BadRequestException('Reset token and new password required');
    }

    try {
      await this.authenticationService.resetPassword(
        request.resetToken,
        request.newPassword,
      );

      return {
        message: 'Password reset successful. Please login with new password.',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  /**
   * Change password (authenticated)
   * POST /api/v1/auth/change-password
   * @param user Current user
   * @param request Old and new passwords
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @AuditLog('PASSWORD_CHANGED')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() request: { oldPassword: string; newPassword: string },
  ): Promise<{ message: string }> {
    if (!request.oldPassword || !request.newPassword) {
      throw new BadRequestException('Old and new passwords required');
    }

    try {
      await this.authenticationService.changePassword(
        user.userId,
        request.oldPassword,
        request.newPassword,
      );

      await this.auditLogService.logAuthEvent(
        user.userId,
        AuditEventType.LOGIN, // Reuse for password change
        'SUCCESS',
        { action: 'password_changed' },
      );

      return { message: 'Password changed successfully' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   * @param user Current user
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: JwtPayload): Promise<JwtPayload> {
    return user;
  }

  /**
   * Health check
   * GET /api/v1/auth/health
   */
  @Get('health')
  @Public()
  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
