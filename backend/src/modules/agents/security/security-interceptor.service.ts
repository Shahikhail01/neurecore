/**
 * Security Interceptor Service
 *
 * SOLID: Facade Pattern — Coordinates all security validators
 * SOLID: Single Responsibility — Only handles security coordination
 * SOLID: Dependency Inversion — Uses injectable validator interfaces
 *
 * This is the main security service that orchestrates all security checks
 * before tool execution in the LangGraph pipeline.
 *
 * @module agents/security
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IStructuredTool } from '../../tools/interfaces/structured-tool.interface';
import type {
  ISecurityInterceptor,
  ISecurityValidationResult,
  ISecurityContext,
  ISecurityPolicy,
  IPromptInjectionValidator,
  ICommandPatternValidator,
  IResourceAccessValidator,
  ISecurityPolicyProvider,
  ISecurityAuditLogger,
  ISecurityAuditEvent,
} from './interfaces/security.interfaces';
import type { IPiiMiddleware } from './interfaces/pii.interfaces';

@Injectable()
export class SecurityInterceptorService implements ISecurityInterceptor {
  private readonly logger = new Logger(SecurityInterceptorService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject('IPromptInjectionValidator')
    private readonly promptInjectionValidator?: IPromptInjectionValidator,
    @Optional()
    @Inject('ICommandPatternValidator')
    private readonly commandPatternValidator?: ICommandPatternValidator,
    @Optional()
    @Inject('IResourceAccessValidator')
    private readonly resourceAccessValidator?: IResourceAccessValidator,
    @Optional()
    @Inject('ISecurityPolicyProvider')
    private readonly policyProvider?: ISecurityPolicyProvider,
    @Optional()
    @Inject('ISecurityAuditLogger')
    private readonly auditLogger?: ISecurityAuditLogger,
    @Optional()
    @Inject('IPiiMiddleware')
    private readonly piiMiddleware?: IPiiMiddleware,
  ) {}

  /**
   * Full security validation of a tool call
   *
   * Orchestrates multiple security checks in sequence:
   * 1. Get security policy for agent type
   * 2. Check if tool is allowed by policy
   * 3. Validate input for prompt injection
   * 4. Validate command patterns (for shell tools)
   * 5. Validate resource access (for file/path tools)
   */
  async validate(
    tool: IStructuredTool,
    input: Record<string, unknown>,
    context: ISecurityContext,
  ): Promise<ISecurityValidationResult> {
    const startTime = Date.now();

    this.logger.debug(
      `Security validation: tool=${tool.name}, agentType=${context.agentType}, tenantId=${context.tenantId}`,
    );

    // Local references for optional providers (helps TypeScript narrowing)
    const policyProvider = this.policyProvider;
    const promptValidator = this.promptInjectionValidator;
    const commandValidator = this.commandPatternValidator;
    const resourceValidator = this.resourceAccessValidator;

    // Step 1: Get security policy
    if (!policyProvider) {
      this.logger.warn(
        'SecurityPolicyProvider not available, skipping policy check',
      );
      return this.createAllowedResult(tool.name, input, Date.now() - startTime);
    }

    const policy = await policyProvider.getPolicy(
      context.agentType,
      context.tenantId,
    );

    if (!policy) {
      this.logger.error(
        `No security policy found for agentType=${context.agentType}`,
      );
      return this.createBlockedResult(
        tool.name,
        input,
        'POLICY_VIOLATION',
        'No security policy available for this agent type',
      );
    }

    // Step 2: Check if tool is allowed by policy
    if (!policyProvider.isToolAllowed(tool.name, policy)) {
      this.logger.warn(
        `Tool ${tool.name} not allowed by policy for agentType=${context.agentType}`,
      );
      await this.logSecurityEvent(
        context,
        tool.name,
        'BLOCKED',
        'TOOL_NOT_ALLOWED',
        { policy: policy.agentType },
      );
      return this.createBlockedResult(
        tool.name,
        input,
        'TOOL_NOT_ALLOWED',
        `Tool '${tool.name}' is not permitted for agent type '${context.agentType}'`,
      );
    }

    // Step 3: Prompt injection detection (if enabled)
    if (policy.promptInjectionDetection) {
      const injectionResult = promptValidator
        ? promptValidator.detect(input)
        : { detected: false, patterns: [] };
      if (injectionResult.detected) {
        this.logger.warn(
          `Prompt injection detected in tool=${tool.name}: ${injectionResult.patterns.join(', ')}`,
        );
        await this.logSecurityEvent(
          context,
          tool.name,
          'BLOCKED',
          'PROMPT_INJECTION',
          { patterns: injectionResult.patterns },
        );
        return this.createBlockedResult(
          tool.name,
          input,
          'PROMPT_INJECTION',
          `Potential prompt injection detected: ${injectionResult.patterns.join(', ')}`,
        );
      }
    }

    // Step 4: Command pattern validation (for shell tools)
    if (policy.commandValidation && commandValidator?.isShellTool(tool.name)) {
      const command = this.extractCommandFromInput(input);
      if (command) {
        const commandResult = commandValidator.validate(command);
        if (!commandResult.allowed) {
          this.logger.warn(
            `Dangerous command detected in tool=${tool.name}: ${commandResult.reason}`,
          );
          await this.logSecurityEvent(
            context,
            tool.name,
            'BLOCKED',
            'DANGEROUS_COMMAND',
            {
              reason: commandResult.reason,
              blockedPattern: commandResult.blockedPattern,
            },
          );
          return this.createBlockedResult(
            tool.name,
            input,
            'DANGEROUS_COMMAND',
            `Command blocked: ${commandResult.reason}`,
          );
        }
      }
    }

    // Step 5: Resource access validation (for file/path tools)
    if (policy.resourceValidation) {
      const resource = this.extractResourceFromInput(input);
      const accessContext = this.determineAccessContext(tool.name, input);
      if (resource && accessContext) {
        const resourceResult = resourceValidator
          ? resourceValidator.validate(resource, accessContext)
          : { allowed: true };
        if (!resourceResult.allowed) {
          this.logger.warn(
            `Forbidden resource access in tool=${tool.name}: ${resourceResult.reason}`,
          );
          await this.logSecurityEvent(
            context,
            tool.name,
            'BLOCKED',
            'FORBIDDEN_RESOURCE',
            { resource, reason: resourceResult.reason },
          );
          return this.createBlockedResult(
            tool.name,
            input,
            'FORBIDDEN_RESOURCE',
            `Resource access denied: ${resourceResult.reason}`,
          );
        }
      }
    }

    // Step 6: File size validation (if applicable)
    if (policy.maxFileSizeBytes > 0) {
      const sizeValidation = this.validateFileSize(
        input,
        policy.maxFileSizeBytes,
      );
      if (!sizeValidation.allowed) {
        return this.createBlockedResult(
          tool.name,
          input,
          'POLICY_VIOLATION',
          sizeValidation.reason || 'File size exceeds limit',
        );
      }
    }

    // All validations passed
    const duration = Date.now() - startTime;
    this.logger.debug(
      `Security validation passed for tool=${tool.name} in ${duration}ms`,
    );

    await this.logSecurityEvent(context, tool.name, 'ALLOWED', undefined, {
      durationMs: duration,
    });

    // Step 7: PII sanitisation — mask sensitive data in string fields.
    const baseInput = promptValidator ? promptValidator.sanitize(input) : input;
    const sanitizedInput = this.piiMiddleware
      ? this.sanitizeInputFields(baseInput)
      : baseInput;

    return {
      allowed: true,
      reason: 'All security checks passed',
      sanitizedInput,
      toolName: tool.name,
      input,
    };
  }

  /**
   * Recursively sanitise all string-valued fields in a tool input record.
   * Non-string values are passed through untouched.
   */
  private sanitizeInputFields(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!this.piiMiddleware) return input;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        result[key] = this.piiMiddleware.sanitise(value).masked;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Quick check if a tool is allowed for given context
   */
  async isToolAllowed(
    toolName: string,
    context: ISecurityContext,
  ): Promise<boolean> {
    const provider = this.policyProvider;
    if (!provider) return false;

    const policy = await provider.getPolicy(
      context.agentType,
      context.tenantId,
    );
    if (!policy) {
      return false;
    }

    return provider.isToolAllowed(toolName, policy);
  }

  /**
   * Create a blocked result
   */
  private createBlockedResult(
    toolName: string,
    input: Record<string, unknown>,
    blockReason: ISecurityValidationResult['blockReason'],
    reason: string,
  ): ISecurityValidationResult {
    return {
      allowed: false,
      reason,
      blockReason,
      toolName,
      input,
    };
  }

  /**
   * Create an allowed result
   */
  private createAllowedResult(
    toolName: string,
    input: Record<string, unknown>,
    durationMs: number,
  ): ISecurityValidationResult {
    return {
      allowed: true,
      reason: 'All security checks passed',
      sanitizedInput: this.promptInjectionValidator
        ? this.promptInjectionValidator.sanitize(input)
        : input,
      toolName,
      input,
    };
  }

  /**
   * Extract command string from tool input
   */
  private extractCommandFromInput(
    input: Record<string, unknown>,
  ): string | null {
    // Common field names for commands
    const commandFields = [
      'command',
      'cmd',
      'shell',
      'bash',
      'script',
      'code',
      'exec',
    ];

    for (const field of commandFields) {
      if (input[field] && typeof input[field] === 'string') {
        return input[field];
      }
    }

    // Check for command in 'input' field
    if (input.input && typeof input.input === 'string') {
      return input.input;
    }

    return null;
  }

  /**
   * Extract resource (file path) from tool input
   */
  private extractResourceFromInput(
    input: Record<string, unknown>,
  ): string | null {
    // Common field names for paths
    const pathFields = [
      'path',
      'file',
      'filePath',
      'filepath',
      'resource',
      'uri',
      'url',
    ];

    for (const field of pathFields) {
      if (input[field] && typeof input[field] === 'string') {
        return input[field];
      }
    }

    return null;
  }

  /**
   * Determine access context based on tool name
   */
  private determineAccessContext(
    toolName: string,
    input: Record<string, unknown>,
  ): 'read' | 'write' | 'execute' | null {
    const normalizedToolName = toolName.toLowerCase();

    // Determine based on tool name
    if (
      normalizedToolName.includes('write') ||
      normalizedToolName.includes('create') ||
      normalizedToolName.includes('update')
    ) {
      return 'write';
    }
    if (
      normalizedToolName.includes('execute') ||
      normalizedToolName.includes('run') ||
      normalizedToolName.includes('shell')
    ) {
      return 'execute';
    }
    if (
      normalizedToolName.includes('read') ||
      normalizedToolName.includes('get') ||
      normalizedToolName.includes('list')
    ) {
      return 'read';
    }

    // Check input for operation hints
    const operation = input.operation || input.action || '';
    if (typeof operation === 'string') {
      if (
        operation.includes('write') ||
        operation.includes('create') ||
        operation.includes('update')
      ) {
        return 'write';
      }
      if (operation.includes('execute') || operation.includes('run')) {
        return 'execute';
      }
    }

    return 'read'; // Default to read
  }

  /**
   * Validate file size in input
   */
  private validateFileSize(
    input: Record<string, unknown>,
    maxSizeBytes: number,
  ): { allowed: boolean; reason?: string } {
    // Check for size field
    const size = input.size || input.fileSize || input.length;
    if (size && typeof size === 'number') {
      if (size > maxSizeBytes) {
        return {
          allowed: false,
          reason: `File size ${size} exceeds maximum allowed ${maxSizeBytes} bytes`,
        };
      }
    }

    // Check for data field (base64 or raw)
    const data = input.data || input.content || input.body;
    if (data && typeof data === 'string') {
      // Rough estimate: base64 is ~4/3 of original
      const estimatedSize = (data.length * 3) / 4;
      if (estimatedSize > maxSizeBytes) {
        return {
          allowed: false,
          reason: `Content size exceeds maximum allowed ${maxSizeBytes} bytes`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Log a security event
   */
  private async logSecurityEvent(
    context: ISecurityContext,
    toolName: string,
    action: 'ALLOWED' | 'BLOCKED' | 'SANITIZED',
    blockReason?: ISecurityValidationResult['blockReason'],
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const event: ISecurityAuditEvent = {
        timestamp: new Date(),
        tenantId: context.tenantId,
        agentType: context.agentType,
        userId: context.userId,
        toolName,
        action,
        blockReason,
        details,
      };

      const auditLogger = this.auditLogger;
      if (!auditLogger) return;

      await auditLogger.log(event);
    } catch (error) {
      this.logger.error('Failed to log security event', error);
    }
  }
}
