/**
 * Authentication Service Tests
 * Unit tests for JWT token generation, validation, and refresh
 * SOLID: Test all service methods with mocks
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import { ConfigService } from '@nestjs/config';
import { AuthService, User, JwtPayload, UserRole } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let configService: ConfigService;

  beforeEach(() => {
    // Mock ConfigService
    configService = {
      get: (key: string, defaultValue: any) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret-key',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_ACCESS_TOKEN_EXPIRY: '15m',
          JWT_REFRESH_TOKEN_EXPIRY: '7d',
        };
        return config[key] || defaultValue;
      },
    } as any;

    authService = new AuthService(configService);
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-123',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens = authService.generateTokens(user);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900); // 15 minutes in seconds
    });

    it('should return different tokens each time', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-123',
        role: UserRole.AGENT_MANAGER,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens1 = authService.generateTokens(user);
      const tokens2 = authService.generateTokens(user);

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('validateAccessToken', () => {
    it('should validate correct token', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-123',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens = authService.generateTokens(user);
      const payload = authService.validateAccessToken(tokens.accessToken);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe('user-123');
      expect(payload?.email).toBe('test@example.com');
      expect(payload?.tenantId).toBe('tenant-123');
      expect(payload?.role).toBe(UserRole.ADMIN);
    });

    it('should return null for invalid token', () => {
      const payload = authService.validateAccessToken('invalid.token.here');
      expect(payload).toBeNull();
    });

    it('should return null for empty token', () => {
      const payload = authService.validateAccessToken('');
      expect(payload).toBeNull();
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate correct refresh token', () => {
      const user: User = {
        id: 'user-456',
        email: 'user@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-456',
        role: UserRole.VIEWER,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens = authService.generateTokens(user);
      const payload = authService.validateRefreshToken(tokens.refreshToken);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe('user-456');
    });

    it('should reject access token as refresh token', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-123',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens = authService.generateTokens(user);
      const payload = authService.validateRefreshToken(tokens.accessToken);

      // Should fail because access token was signed with different secret
      expect(payload).toBeNull();
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token only', () => {
      const user: User = {
        id: 'user-789',
        email: 'admin@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-789',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const token = authService.generateAccessToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const payload = authService.validateAccessToken(token);
      expect(payload?.userId).toBe('user-789');
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new tokens from refresh token', () => {
      const user: User = {
        id: 'user-refresh',
        email: 'refresh@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-refresh',
        role: UserRole.AGENT_MANAGER,
        isActive: true,
        createdAt: new Date(),
      };

      const originalTokens = authService.generateTokens(user);
      const newTokens = authService.refreshAccessToken(
        originalTokens.refreshToken,
        user,
      );

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(originalTokens.accessToken);
    });

    it('should throw error for invalid refresh token', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-123',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      expect(() => {
        authService.refreshAccessToken('invalid.token.here', user);
      }).toThrow('Invalid refresh token');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-123',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens = authService.generateTokens(user);
      expect(authService.isTokenExpired(tokens.accessToken)).toBe(false);
    });

    it('should return true for invalid token', () => {
      expect(authService.isTokenExpired('invalid.token')).toBe(true);
    });
  });

  describe('extractUserIdFromToken', () => {
    it('should extract userId from valid token', () => {
      const user: User = {
        id: 'user-extract',
        email: 'extract@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-extract',
        role: UserRole.TASK_APPROVER,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens = authService.generateTokens(user);
      const userId = authService.extractUserIdFromToken(tokens.accessToken);

      expect(userId).toBe('user-extract');
    });

    it('should return null for invalid token', () => {
      const userId = authService.extractUserIdFromToken('invalid.token');
      expect(userId).toBeNull();
    });
  });

  describe('Token Claims', () => {
    it('should include all required claims in token', () => {
      const user: User = {
        id: 'user-claims',
        email: 'claims@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-claims',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens = authService.generateTokens(user);
      const payload = authService.validateAccessToken(tokens.accessToken);

      expect(payload?.userId).toBe(user.id);
      expect(payload?.email).toBe(user.email);
      expect(payload?.tenantId).toBe(user.tenantId);
      expect(payload?.role).toBe(user.role);
      expect(payload?.iat).toBeDefined();
      expect(payload?.exp).toBeDefined();
    });
  });

  describe('Multi-tenancy', () => {
    it('should support users from different tenants', () => {
      const user1: User = {
        id: 'user-1',
        email: 'user1@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-1',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const user2: User = {
        id: 'user-2',
        email: 'user2@example.com',
        passwordHash: 'hashed',
        tenantId: 'tenant-2',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
      };

      const tokens1 = authService.generateTokens(user1);
      const tokens2 = authService.generateTokens(user2);

      const payload1 = authService.validateAccessToken(tokens1.accessToken);
      const payload2 = authService.validateAccessToken(tokens2.accessToken);

      expect(payload1?.tenantId).toBe('tenant-1');
      expect(payload2?.tenantId).toBe('tenant-2');
      expect(payload1?.tenantId).not.toBe(payload2?.tenantId);
    });
  });
});
