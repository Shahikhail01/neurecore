/**
 * JWT Authentication Guard
 * Protects routes by validating JWT tokens
 * SOLID: Single Responsibility - Token validation only
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthService, JwtPayload } from '../services/auth.service';
import { AuditLogService } from '../services/audit-log.service';

/**
 * JWT Authentication Guard
 * Validates JWT token from Authorization header
 * Injects user payload into request context
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Execute authentication check
   * @param context Execution context from NestJS
   * @returns true if token valid, throws otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      const clientIp = request.ip;
      await this.auditLogService.logSecurityEvent({
        userId: null,
        action: 'AUTH_MISSING_TOKEN',
        resource: request.path,
        details: { clientIp },
        status: 'FAILED',
      });
      throw new UnauthorizedException('Missing authentication token');
    }

    const payload = this.authService.validateAccessToken(token);

    if (!payload) {
      await this.auditLogService.logSecurityEvent({
        userId: this.authService.extractUserIdFromToken(token),
        action: 'AUTH_INVALID_TOKEN',
        resource: request.path,
        details: { clientIp: request.ip },
        status: 'FAILED',
      });
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Attach user to request
    request.user = payload;
    request.tenantId = payload.tenantId;

    return true;
  }

  /**
   * Extract token from Authorization header
   * Format: Bearer <token>
   * @param request Express request
   * @returns Token string or null
   */
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return null;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}

/**
 * WebSocket JWT Guard (for real-time features)
 * Similar to JwtAuthGuard but for Socket.IO connections
 */
@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token = client.handshake?.auth?.token;

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    const payload = this.authService.validateAccessToken(token);

    if (!payload) {
      throw new WsException('Invalid or expired token');
    }

    client.user = payload;
    client.tenantId = payload.tenantId;

    return true;
  }
}
