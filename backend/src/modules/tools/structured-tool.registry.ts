/**
 * Structured Tool Registry
 *
 * Registry for managing and discovering structured tools.
 * Provides dependency injection support via NestJS.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IStructuredTool,
  ToolDefinition,
  ToolCategory,
} from './interfaces/structured-tool.interface';
import type { SecurityInterceptorService } from '../agents/security/security-interceptor.service';
import type { ISecurityContext } from '../agents/security/interfaces/security.interfaces';

/**
 * Registry for managing IStructuredTool instances
 */
@Injectable()
export class StructuredToolRegistry {
  private readonly logger = new Logger(StructuredToolRegistry.name);
  private readonly tools: Map<string, IStructuredTool> = new Map();
  private readonly categoryIndex: Map<ToolCategory, Set<string>> = new Map();

  /**
   * Register a structured tool
   */
  register(tool: IStructuredTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(
        `Tool '${tool.name}' is already registered. Overwriting.`,
      );
    }

    this.tools.set(tool.name, tool);

    // Update category index
    if (!this.categoryIndex.has(tool.category)) {
      this.categoryIndex.set(tool.category, new Set());
    }
    this.categoryIndex.get(tool.category)!.add(tool.name);

    this.logger.log(`Registered tool: ${tool.name} (${tool.category})`);
  }

  /**
   * Unregister a tool by name
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    this.tools.delete(name);

    // Update category index
    const categoryTools = this.categoryIndex.get(tool.category);
    if (categoryTools) {
      categoryTools.delete(name);
    }

    this.logger.log(`Unregistered tool: ${name}`);
    return true;
  }

  /**
   * Get a tool by name
   */
  get(name: string): IStructuredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): IStructuredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): IStructuredTool[] {
    const names = this.categoryIndex.get(category);
    if (!names) {
      return [];
    }
    return Array.from(names)
      .map((name) => this.tools.get(name))
      .filter((tool): tool is IStructuredTool => tool !== undefined);
  }

  /**
   * Get all tool definitions for LLM function calling
   */
  getFunctionDefinitions(): Array<{
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
  }> {
    return this.getAll().map((tool) => tool.toFunctionCall());
  }

  /**
   * Get all tool definitions as structured definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => tool.getDefinition());
  }

  /**
   * List all tool names
   */
  listToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools count
   */
  getCount(): number {
    return this.tools.size;
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool by name with validation
   */
  async execute<T = unknown>(
    toolName: string,
    input: unknown,
    context?: Partial<{ tenantId: string; userId: string; sessionId: string }>,
  ): Promise<T> {
    const tool = this.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // Validate input
    const validation = tool.validate(input);
    if (!validation.valid) {
      throw new Error(
        `Invalid input for tool '${toolName}': ${validation.errors?.join(', ')}`,
      );
    }

    // Execute with context
    const result = await tool.execute(
      input as never,
      context as Parameters<typeof tool.execute>[1],
    );

    if (!result.success) {
      throw new Error(`Tool '${toolName}' execution failed: ${result.error}`);
    }

    return result.data as T;
  }

  /**
   * Convert all registered tools to LangChain DynamicStructuredTool instances
   * compatible with @langchain/langgraph ToolNode.
   *
   * Security validation is performed before every tool execution when a
   * securityContext and securityInterceptor are supplied.
   *
   * SOLID — OCP: new method; existing get/register/execute unchanged.
   * LSP:  DynamicStructuredTool wraps IStructuredTool without subclassing it.
   */
  async toLangChainTools(
    securityContext?: Pick<
      ISecurityContext,
      'tenantId' | 'agentType' | 'userId'
    >,
    securityInterceptor?: SecurityInterceptorService,
  ): Promise<any[]> {
    const { DynamicStructuredTool } = await import('@langchain/core/tools');

    return Array.from(this.tools.values()).map(
      (tool) =>
        new DynamicStructuredTool({
          name: tool.name,
          description: tool.description,
          schema: tool.inputSchema as import('zod').ZodObject<any>,
          func: async (input: Record<string, unknown>) => {
            // SECURITY: validate before every tool execution
            if (securityInterceptor && securityContext) {
              const check = await securityInterceptor.validate(
                tool,
                input,
                securityContext,
              );
              if (!check.allowed) {
                throw new Error(`Security blocked: ${check.reason}`);
              }
              input =
                (check.sanitizedInput as Record<string, unknown>) ?? input;
            }

            const result = await tool.execute(input, {
              tenantId: securityContext?.tenantId ?? '',
              agentId: securityContext?.agentType,
            });

            if (!result.success) {
              throw new Error(result.error ?? 'Tool execution failed');
            }

            return JSON.stringify(result.data ?? null);
          },
        }),
    );
  }

  /**
   * Clear all registered tools (useful for testing)
   */
  clear(): void {
    this.tools.clear();
    this.categoryIndex.clear();
    this.logger.log('Cleared all registered tools');
  }
}
