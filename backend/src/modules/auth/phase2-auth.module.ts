/**
 * Phase 2 Authentication Module (Complete)
 * Wires all Phase 2 authentication services and guards
 * SOLID: Dependency Injection - Full DI container setup
 *
 * Add to app.module.ts imports: Phase2AuthModule
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import { Module, NestModule, MiddlewareConsumer, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services (Phase 2)
import { AuthService } from '../../core/services/auth.service';
import { AuthenticationService } from '../../core/services/authentication.service';
import { PasswordService } from '../../core/services/password.service';
import { SessionService } from '../../core/services/session.service';
import { AuthorizationService } from '../../core/services/authorization.service';
import { AuditLogService } from '../../core/services/audit-log.service';

// Repositories
import { UserRepository } from '../../core/repositories/user.repository';

// Controllers
import { AuthController } from './auth.controller';

// Guards
import {
  JwtAuthGuard,
  WsJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// Middleware
import {
  TenantMiddleware,
  TenantHeaderMiddleware,
} from '../../common/middleware/tenant.middleware';

// Filters
import { GlobalExceptionFilter } from '../../common/filters/exception.filter';

// Infrastructure
import { NestJSLogger } from '../../infrastructure/logger';

// Schema
import { SchemaInitializer } from '../../database/auth-schema.init';

/**
 * Phase2AuthModule - Complete authentication layer for Phase 2+
 *
 * Provides:
 * - Complete authentication flow (register, login, refresh, logout)
 * - Password security (hashing, validation, strength checking)
 * - Session lifecycle management with token rotation
 * - Role-based access control (RBAC)
 * - Multi-tenancy isolation
 * - Comprehensive audit trail
 * - Centralized error handling
 *
 * Export to other modules:
 * - AuthenticationService: Main auth service
 * - AuthService: JWT operations
 * - PasswordService: Password utilities
 * - SessionService: Session management
 * - AuthorizationService: Permission checking
 * - AuditLogService: Audit logging
 * - JwtAuthGuard: Route protection
 * - RolesGuard: Role checking
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    // Core services (Phase 2)
    AuthService,
    AuthenticationService,
    PasswordService,
    SessionService,
    AuthorizationService,
    AuditLogService,

    // Data access
    UserRepository,

    // Guards
    JwtAuthGuard,
    WsJwtAuthGuard,
    RolesGuard,

    // Logger
    {
      provide: NestJSLogger,
      useValue: new NestJSLogger(),
    },

    // Exception filter (global)
    {
      provide: 'APP_FILTER',
      useClass: GlobalExceptionFilter,
    },

    // Schema initialization
    SchemaInitializer,
  ],
  exports: [
    AuthenticationService,
    AuthService,
    PasswordService,
    SessionService,
    AuthorizationService,
    AuditLogService,
    UserRepository,
    JwtAuthGuard,
    WsJwtAuthGuard,
    RolesGuard,
    SchemaInitializer,
  ],
})
export class Phase2AuthModule implements NestModule {
  /**
   * Configure middleware for auth routes
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('api/v1/auth', 'api/v1/*')
      .apply(TenantHeaderMiddleware)
      .forRoutes('api/v1/auth', 'api/v1/*');
  }
}
