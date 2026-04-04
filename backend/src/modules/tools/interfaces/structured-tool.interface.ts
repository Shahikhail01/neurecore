/**
 * StructuredTool Interface — LangChain-compatible tool definition
 *
 * SRP: Defines the contract for all agent tools with proper typing
 * OCP: New tools implement this interface without modifying consumers
 * DIP: Consumers depend on this abstraction, not concrete implementations
 */

import { z } from 'zod';
import { Observable } from 'rxjs';

// ─────────────────────────────────────────────────────────────
// Tool Categories
// ─────────────────────────────────────────────────────────────

export enum ToolCategory {
  CALCULATION = 'CALCULATION',
  API = 'API',
  SEARCH = 'SEARCH',
  DATABASE = 'DATABASE',
  FILE = 'FILE',
  COMMUNICATION = 'COMMUNICATION',
  CODE = 'CODE',
  AI = 'AI',
  CUSTOM = 'CUSTOM',
  PRODUCTIVITY = 'PRODUCTIVITY',
  BUSINESS = 'BUSINESS',
  DATA = 'DATA',
  MARKETING = 'MARKETING',
  INFORMATION = 'INFORMATION',
  MONITORING = 'MONITORING',
  FINANCE = 'FINANCE',
  LOCATION = 'LOCATION',
}

// ─────────────────────────────────────────────────────────────
// Base Tool Input/Output
// ─────────────────────────────────────────────────────────────

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    durationMs?: number;
    costUsd?: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Tool Definition (Metadata)
// ─────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: z.ZodSchema; // Zod schema for validation
  requiredPermissions?: string[]; // Permissions needed to use this tool
  examples?: Array<{
    input: Record<string, unknown>;
    output: unknown;
    description: string;
  }>;
  version?: string;
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────
// Streaming Tool Output
// ─────────────────────────────────────────────────────────────

export interface StreamingToolOutput {
  emit(chunk: string): void;
  complete(): void;
  error(error: string): void;
}

// ─────────────────────────────────────────────────────────────
// Tool Execution Context
// ─────────────────────────────────────────────────────────────

export interface ToolExecutionContext {
  tenantId: string;
  agentId?: string;
  taskId?: string;
  userId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Tool Result with structured output
// ─────────────────────────────────────────────────────────────

export interface StructuredToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    durationMs?: number;
    costUsd?: number;
    model?: string;
    cached?: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// Base Interface: IStructuredTool (DIP / OCP)
// ─────────────────────────────────────────────────────────────

/**
 * IStructuredTool — LangChain-compatible tool interface with Zod validation
 *
 * SOLID:
 * - SRP: Tool only handles its own execution logic
 * - OCP: Add new tools by implementing this interface
 * - DIP: Consumers depend on this abstraction
 * - LSP: All implementations are interchangeable
 */
export interface IStructuredTool {
  /** Tool identifier */
  readonly name: string;

  /** Human-readable description for LLM */
  readonly description: string;

  /** Tool category for grouping */
  readonly category: ToolCategory;

  /** Zod schema for input validation */
  readonly inputSchema: z.ZodSchema;

  /** Optional Zod schema for output validation */
  readonly outputSchema?: z.ZodSchema;

  /** Permissions required to use this tool */
  readonly requiredPermissions?: string[];

  /** Version for tracking */
  readonly version?: string;

  /**
   * Execute the tool with validated input
   * @param input - Tool input (will be validated against inputSchema)
   * @param context - Execution context with tenant/agent info
   * @returns Structured result with typed data
   */
  execute(
    input: z.infer<this['inputSchema']>,
    context?: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>>;

  /**
   * Execute with streaming output
   * Use for long-running operations that need real-time feedback
   */
  stream?(
    input: z.infer<this['inputSchema']>,
    context?: ToolExecutionContext,
  ): Promise<Observable<string>>;

  /**
   * Validate input without executing
   * Useful for pre-flight checks
   */
  validate(input: unknown): { valid: boolean; errors?: string[] };

  /**
   * Get OpenAI function calling format
   * Used for tool calling with GPT models
   */
  toFunctionCall(): {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  };

  /**
   * Get tool definition for registration/discovery
   */
  getDefinition(): ToolDefinition;
}

// ─────────────────────────────────────────────────────────────
// Tool Registry Interface
// ─────────────────────────────────────────────────────────────

export interface IToolRegistry {
  /** Register a tool */
  register(tool: IStructuredTool): void;

  /** Unregister a tool */
  unregister(name: string): boolean;

  /** Get a tool by name */
  get(name: string): IStructuredTool | undefined;

  /** List all registered tools */
  list(): ToolDefinition[];

  /** List tools by category */
  listByCategory(category: ToolCategory): ToolDefinition[];

  /** Check if tool exists */
  has(name: string): boolean;

  /** Get tools filtered by permissions */
  getByPermissions(permissions: string[]): IStructuredTool[];
}

// ─────────────────────────────────────────────────────────────
// Injection Token
// ─────────────────────────────────────────────────────────────

export const STRUCTURED_TOOL_REGISTRY = Symbol('STRUCTURED_TOOL_REGISTRY');
export const STRUCTURED_TOOLS = Symbol('STRUCTURED_TOOLS'); // For array injection
