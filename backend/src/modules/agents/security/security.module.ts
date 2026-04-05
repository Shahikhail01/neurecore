/**
 * Security Module
 *
 * SOLID: Dependency Inversion — All dependencies are injected via constructor
 * SOLID: Single Responsibility — This module ONLY wires security components
 *
 * This module exports all security services for use by other modules.
 * Import this module in agents.module.ts or wherever security is needed.
 *
 * @module agents/security
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Validators
import { PromptInjectionValidator } from './validators/prompt-injection.validator';
import { CommandPatternValidator } from './validators/command-pattern.validator';
import { ResourceAccessValidator } from './validators/resource-access.validator';

// Providers
import { SecurityPolicyProvider } from './providers/security-policy.provider';
import { RegexPiiDetector } from './providers/regex-pii-detector.service';
import { PiiMaskerService } from './providers/pii-masker.service';

// Services
import { SecurityInterceptorService } from './security-interceptor.service';
import { SecurityAuditLoggerService } from './security-audit-logger.service';
import { PiiMiddlewareService } from './pii-middleware.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    // Validators (all @Injectable())
    PromptInjectionValidator,
    CommandPatternValidator,
    ResourceAccessValidator,

    // Policy Provider
    SecurityPolicyProvider,

    // PII Detection & Masking
    RegexPiiDetector,
    PiiMaskerService,
    PiiMiddlewareService,

    // Core Services
    SecurityInterceptorService,
    SecurityAuditLoggerService,

    // Interface token providers (for DI)
    {
      provide: 'IPromptInjectionValidator',
      useClass: PromptInjectionValidator,
    },
    { provide: 'ICommandPatternValidator', useClass: CommandPatternValidator },
    { provide: 'IResourceAccessValidator', useClass: ResourceAccessValidator },
    { provide: 'ISecurityPolicyProvider', useClass: SecurityPolicyProvider },
    { provide: 'ISecurityInterceptor', useClass: SecurityInterceptorService },
    { provide: 'ISecurityAuditLogger', useClass: SecurityAuditLoggerService },
    { provide: 'IPiiDetector', useClass: RegexPiiDetector },
    { provide: 'IPiiMasker', useClass: PiiMaskerService },
    { provide: 'IPiiMiddleware', useClass: PiiMiddlewareService },
  ],
  exports: [
    // Export validators for direct use if needed
    PromptInjectionValidator,
    CommandPatternValidator,
    ResourceAccessValidator,
    SecurityPolicyProvider,

    // Export PII services
    RegexPiiDetector,
    PiiMaskerService,
    PiiMiddlewareService,

    // Export main security service
    SecurityInterceptorService,
    SecurityAuditLoggerService,

    // Export interfaces for type checking
    'IPromptInjectionValidator',
    'ICommandPatternValidator',
    'IResourceAccessValidator',
    'ISecurityPolicyProvider',
    'ISecurityInterceptor',
    'ISecurityAuditLogger',
    'IPiiDetector',
    'IPiiMasker',
    'IPiiMiddleware',
  ],
})
export class SecurityModule {}

/**
 * Security Module Providers Summary
 *
 * This module provides the following services that can be injected:
 *
 * 1. SecurityInterceptorService (ISecurityInterceptor)
 *    - Main facade for security validation
 *    - Use this to validate tool calls before execution
 *
 * 2. PromptInjectionValidator (IPromptInjectionValidator)
 *    - Detects prompt injection patterns
 *    - Can sanitize inputs
 *
 * 3. CommandPatternValidator (ICommandPatternValidator)
 *    - Validates shell commands
 *    - Blocks dangerous patterns
 *
 * 4. ResourceAccessValidator (IResourceAccessValidator)
 *    - Validates file/path access
 *    - Enforces path allowlists
 *
 * 5. SecurityPolicyProvider (ISecurityPolicyProvider)
 *    - Provides security policies per agent type
 *    - Maps agent types to allowed/blocked tools
 *
 * 6. SecurityAuditLoggerService (ISecurityAuditLogger)
 *    - Logs all security events
 *    - Provides audit trail
 *
 * Usage in other modules:
 *
 * ```typescript
 * import { SecurityModule } from './security/security.module';
 * import { SecurityInterceptorService } from './security/security-interceptor.service';
 * import type { ISecurityContext } from './security/interfaces/security.interfaces';
 *
 * @Module({
 *   imports: [SecurityModule],
 *   ...
 * })
 * export class MyModule {
 *   constructor(
 *     private readonly securityInterceptor: SecurityInterceptorService,
 *   ) {}
 *
 *   async executeTool(tool: IStructuredTool, input: Record<string, unknown>, context: ISecurityContext) {
 *     const result = await this.securityInterceptor.validate(tool, input, context);
 *     if (!result.allowed) {
 *       throw new Error(`Security blocked: ${result.reason}`);
 *     }
 *     return tool.execute(result.sanitizedInput || input);
 *   }
 * }
 * ```
 */
