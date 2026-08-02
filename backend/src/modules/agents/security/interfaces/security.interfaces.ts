/**
 * Security Interfaces — SOLID: Interface Segregation
 *
 * Each interface has ONE responsibility, enabling swappable implementations.
 * All interfaces are designed for NestJS Dependency Injection.
 *
 * @module agents/security/interfaces
 */

import { IStructuredTool } from '../../../tools/interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// IPromptInjectionValidator — Single Responsibility
// ─────────────────────────────────────────────────────────────

export interface IPromptInjectionResult {
  detected: boolean;
  patterns: string[];
  sanitized?: Record<string, unknown>;
}

export interface IPromptInjectionValidator {
  /**
   * Detect prompt injection patterns in tool input
   * @param input - Tool call input to validate
   * @returns Detection result with matched patterns
   */
  detect(input: Record<string, unknown>): IPromptInjectionResult;

  /**
   * Sanitize input by removing injection patterns
   * @param input - Input to sanitize
   * @returns Sanitized input
   */
  sanitize(input: Record<string, unknown>): Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// ICommandPatternValidator — Single Responsibility
// ─────────────────────────────────────────────────────────────

export interface ICommandValidationResult {
  allowed: boolean;
  reason?: string;
  blockedPattern?: string;
}

export interface ICommandPatternValidator {
  /**
   * Validate shell command against allowlist/blocklist
   * @param command - Command string to validate
   * @returns Validation result
   */
  validate(command: string): ICommandValidationResult;

  /**
   * Check if this tool requires command validation
   * @param toolName - Name of the tool
   * @returns True if command validation needed
   */
  isShellTool(toolName: string): boolean;
}

// ─────────────────────────────────────────────────────────────
// IResourceAccessValidator — Single Responsibility
// ─────────────────────────────────────────────────────────────

export interface IResourceValidationResult {
  allowed: boolean;
  reason?: string;
  blockedPath?: string;
}

export interface IResourceAccessValidator {
  /**
   * Validate resource (file/path) access
   * @param resource - Path or resource identifier
   * @param context - Access context (read/write/execute)
   * @returns Validation result
   */
  validate(
    resource: string,
    context: 'read' | 'write' | 'execute',
  ): IResourceValidationResult;
}

// ─────────────────────────────────────────────────────────────
// ISecurityPolicyProvider — Single Responsibility
// ─────────────────────────────────────────────────────────────

export interface ISecurityPolicy {
  agentType: string;
  tenantId: string;
  policySource: {
    name: string;
    policyVersion: string;
  };
  allowedTools: string[];
  blockedTools: string[];
  allowedPaths: string[];
  blockedPaths: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  maxFileSizeBytes: number;
  promptInjectionDetection: boolean;
  commandValidation: boolean;
  resourceValidation: boolean;
}

export interface ISecurityPolicyProvider {
  /**
   * Get security policy for an agent type
   * @param agentType - Type of agent
   * @param tenantId - Tenant context
   * @returns Security policy or null if not found
   */
  getPolicy(
    agentType: string,
    tenantId: string,
  ): Promise<ISecurityPolicy | null>;

  /**
   * Validate a tool call against agent's policy
   * @param toolName - Tool being called
   * @param policy - Security policy to check against
   * @returns True if allowed
   */
  isToolAllowed(toolName: string, policy: ISecurityPolicy): boolean;

  /**
   * Get the default/fallback security policy
   * @returns Default security policy
   */
  getDefaultPolicy(): ISecurityPolicy;
}

// ─────────────────────────────────────────────────────────────
// ISecurityInterceptor — Facade Interface
// ─────────────────────────────────────────────────────────────

export type SecurityBlockReason =
  | 'PROMPT_INJECTION'
  | 'DANGEROUS_COMMAND'
  | 'FORBIDDEN_RESOURCE'
  | 'POLICY_VIOLATION'
  | 'TOOL_NOT_ALLOWED';

export interface ISecurityValidationResult {
  allowed: boolean;
  reason?: string;
  sanitizedInput?: Record<string, unknown>;
  blockReason?: SecurityBlockReason;
  toolName?: string;
  input?: Record<string, unknown>;
}

export interface ISecurityContext {
  tenantId: string;
  agentType: string;
  userId?: string;
}

export interface ISecurityInterceptor {
  /**
   * Full security validation of a tool call
   * @param tool - The structured tool being called
   * @param input - Tool input to validate
   * @param context - Security context (tenant, agent type)
   * @returns Complete validation result
   */
  validate(
    tool: IStructuredTool,
    input: Record<string, unknown>,
    context: ISecurityContext,
  ): Promise<ISecurityValidationResult>;

  /**
   * Quick check if a tool is allowed for given context
   * @param toolName - Name of the tool
   * @param context - Security context
   * @returns True if tool is allowed
   */
  isToolAllowed(toolName: string, context: ISecurityContext): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────
// ISecurityAuditLogger — Audit Trail Interface
// ─────────────────────────────────────────────────────────────

export interface ISecurityAuditEvent {
  timestamp: Date;
  tenantId: string;
  agentType: string;
  userId?: string;
  toolName: string;
  action: 'ALLOWED' | 'BLOCKED' | 'SANITIZED';
  blockReason?: SecurityBlockReason;
  details?: Record<string, unknown>;
}

export interface ISecurityAuditLogger {
  /**
   * Log a security event
   * @param event - The security event to log
   */
  log(event: ISecurityAuditEvent): void | Promise<void>;
}
