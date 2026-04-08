/**
 * Authentication Service
 * Handles JWT token generation, validation, and refresh
 * SOLID: Single Responsibility - Authentication only
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import * as jwt from 'jsonwebtoken';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretProviderService } from '../../modules/security/providers/secret.provider';

/**
 * JWT Payload - Embedded in token
 */
export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * User roles for RBAC
 */
export enum UserRole {
  ADMIN = 'admin',
  AGENT_MANAGER = 'agent_manager',
  TASK_APPROVER = 'task_approver',
  VIEWER = 'viewer',
}

/**
 * User entity from NocoDB
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Login request DTO
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Auth tokens response
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Session entity from NocoDB
 */
export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * AuthService - JWT & token management
 * Dependencies: Injected via NestJS
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly secretProvider: SecretProviderService,
  ) {
    // Get JWT_SECRET from SecretProviderService (throws if missing)
    this.jwtSecret = this.secretProvider.getJwtSecret();

    // Use ConfigService with proper fallback for refresh secret
    this.jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || this.jwtSecret; // Use JWT_SECRET as fallback for refresh secret

    // Get expiry settings from ConfigService
    this.accessTokenExpiry = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_EXPIRY',
      '15m',
    );
    this.refreshTokenExpiry = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRY',
      '7d',
    );

    // Validate that secrets are set
    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      this.logger.error(
        'JWT_SECRET is missing or too short (minimum 32 characters)',
      );
      throw new Error('CRITICAL: JWT_SECRET configuration is invalid');
    }
  }

  /**
   * Generate both access and refresh tokens
   * @param user User entity from NocoDB
   * @returns AuthTokens with both tokens and expiry
   */
  generateTokens(user: User): AuthTokens {
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      algorithm: 'HS256',
    });

    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenExpiry,
      algorithm: 'HS256',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpirySeconds(this.accessTokenExpiry),
    };
  }

  /**
   * Generate access token only (for refresh workflow)
   * @param user User entity
   * @returns Access token string
   */
  generateAccessToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      algorithm: 'HS256',
    });
  }

  /**
   * Validate and decode access token
   * @param token JWT token string
   * @returns JwtPayload if valid, null if invalid
   */
  validateAccessToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Validate and decode refresh token
   * @param token Refresh token string
   * @returns JwtPayload if valid, null if invalid
   */
  validateRefreshToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Valid refresh token
   * @param user User entity
   * @returns New AuthTokens
   */
  refreshAccessToken(refreshToken: string, user: User): AuthTokens {
    const payload = this.validateRefreshToken(refreshToken);

    if (!payload) {
      throw new Error('Invalid refresh token');
    }

    return this.generateTokens(user);
  }

  /**
   * Convert expiry format (e.g., "15m", "7d") to seconds
   * @param expiry Expiry format string
   * @returns Seconds
   */
  private parseExpirySeconds(expiry: string): number {
    const match = expiry.match(/(\d+)([mhd])/);

    if (!match) {
      return 900; // Default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }

  /**
   * Check if token is expired
   * @param token JWT token
   * @returns true if expired, false if valid
   */
  isTokenExpired(token: string): boolean {
    try {
      jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Extract userId from token without validation
   * Used for audit logging when token is invalid
   * @param token JWT token
   * @returns userId or null
   */
  extractUserIdFromToken(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload | null;
      return decoded?.userId || null;
    } catch {
      return null;
    }
  }
}
