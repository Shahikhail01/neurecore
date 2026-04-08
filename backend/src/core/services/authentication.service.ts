/**
 * Authentication Service (Updated)
 * Integrates JWT, password hashing, and session management
 * SOLID: Facade pattern - coordinates multiple services
 *
 * @author NeureCore Development
 * @version 1.1.0
 * @date 2026-04-07
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService as BaseAuthService, LoginRequest } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import {
  UserRepository,
  CreateUserInput,
} from '../repositories/user.repository';
import { User, UserRole, AuthTokens } from './auth.service';

/**
 * Login response DTO
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
 * Register input DTO
 */
export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * AuthenticationService - Complete auth workflow
 *
 * SOLID:
 * - S: Orchestrates auth services (composition over inheritance)
 * - O: Can add new auth methods without changing existing
 * - L: Replaces BaseAuthService in controllers
 * - I: Client-focused interface (login, register, logout)
 * - D: Services injected (DI principle)
 */
@Injectable()
export class AuthenticationService {
  constructor(
    private readonly baseAuthService: BaseAuthService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register new user
   * @param input Registration details
   * @param tenantId Tenant context
   * @returns Created user
   */
  async register(input: RegisterInput, tenantId?: string): Promise<User> {
    // Validate email not in use
    const emailExists = await this.userRepository.emailExists(input.email);
    if (emailExists) {
      throw new UnauthorizedException('Email already registered');
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      input.password,
    );
    if (!passwordValidation.valid) {
      throw new UnauthorizedException(
        `Weak password: ${passwordValidation.errors.join(', ')}`,
      );
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(
      input.password,
    );

    // Create user
    const createInput: CreateUserInput = {
      email: input.email,
      passwordHash,
      tenantId: tenantId || 'default',
      role: UserRole.VIEWER, // Default role for new users
      firstName: input.firstName,
      lastName: input.lastName,
    };

    return this.userRepository.create(createInput);
  }

  /**
   * Login user with email and password
   * @param request Email and password
   * @returns Tokens and user info
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    // Validate input
    if (!request.email || !request.password) {
      throw new UnauthorizedException('Email and password required');
    }

    // Find user by email
    const user = await this.userRepository.findByEmail(request.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const passwordMatch = await this.passwordService.verifyPassword(
      request.password,
      user.passwordHash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.baseAuthService.generateTokens(user);

    // Create session for refresh token
    await this.sessionService.createSession(user.id, tokens.refreshToken);

    // Enforce max sessions per user
    await this.sessionService.enforceMaxSessions(user.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * Refresh access token
   * @param refreshToken Refresh token string
   * @returns New tokens
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    // Validate refresh token format
    const payload = this.baseAuthService.validateRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check session is valid in database
    const sessionValid = await this.sessionService.isSessionValid(refreshToken);
    if (!sessionValid) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or expired',
      );
    }

    // Load user
    const user = await this.userRepository.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Generate new tokens
    const newTokens = this.baseAuthService.generateTokens(user);

    // Create new session (rotate refresh token)
    await this.sessionService.revokeSession(refreshToken);
    await this.sessionService.createSession(user.id, newTokens.refreshToken);

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: newTokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * Logout user
   * Revokes all refresh tokens
   * @param userId User ID
   */
  async logout(userId: string): Promise<void> {
    await this.sessionService.revokeAllUserSessions(userId);
  }

  /**
   * Request password reset
   * Sends email with reset token
   * @param email User email
   */
  async requestPasswordReset(email: string): Promise<void> {
    // TODO: Implement password reset flow
    // 1. Check email exists
    // 2. Generate reset token
    // 3. Store in reset_tokens table with 1hr expiry
    // 4. Send email with reset link
  }

  /**
   * Reset password with token
   * @param resetToken Reset token from email
   * @param newPassword New password
   */
  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    // TODO: Implement password reset
    // 1. Validate reset token
    // 2. Hash new password
    // 3. Update user passwordHash
    // 4. Revoke all sessions (force re-login)
    // 5. Delete reset token
  }

  /**
   * Change password (authenticated user)
   * @param userId User ID
   * @param oldPassword Current password
   * @param newPassword New password
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Validate new password strength
    const passwordValidation =
      this.passwordService.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw new UnauthorizedException(
        `Weak password: ${passwordValidation.errors.join(', ')}`,
      );
    }

    // Load user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const passwordMatch = await this.passwordService.verifyPassword(
      oldPassword,
      user.passwordHash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash =
      await this.passwordService.hashPassword(newPassword);

    // Update user
    await this.userRepository.update(userId, { passwordHash: newPasswordHash });

    // Revoke all sessions (force re-login on other devices)
    await this.sessionService.revokeAllUserSessions(userId);
  }
}
