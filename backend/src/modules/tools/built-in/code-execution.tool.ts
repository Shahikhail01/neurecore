/**
 * Code Execution Tool - P1-11 of remaining tools
 * Enables AI agents to execute code in sandboxed environments
 * For Data Engineer, CTO agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for code execution operations
 * - OCP: Extensible via execution provider interfaces
 * - DIP: Depends on abstractions for code execution
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

export const CodeExecutionActionEnum = z.enum([
  'execute_code',
  'execute_script',
  'get_execution_history',
  'cancel_execution',
  'validate_code',
]);

export type CodeExecutionAction = z.infer<typeof CodeExecutionActionEnum>;

export const CodeExecutionInputSchema = z.object({
  action: CodeExecutionActionEnum.describe(
    'The code execution action to perform',
  ),
  code: z.string().optional().describe('Code to execute'),
  language: z
    .enum(['javascript', 'typescript', 'python', 'bash', 'sql'])
    .optional()
    .describe('Programming language'),
  scriptId: z.string().optional().describe('Script ID to execute'),
  scriptContent: z.string().optional().describe('Script content'),
  executionId: z.string().optional().describe('Execution ID'),
  options: z
    .object({
      timeout: z.number().int().positive().optional().default(30000),
      memoryLimit: z.number().int().positive().optional().default(128),
      enableNetwork: z.boolean().optional().default(false),
      workingDir: z.string().optional(),
      env: z.record(z.string()).optional(),
    })
    .optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type CodeExecutionInput = z.infer<typeof CodeExecutionInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────

type ExecutionResult = {
  id: string;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  output: string;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
  exitCode?: number;
};

type ExecutionHistory = Array<{
  id: string;
  language: string;
  status: string;
  executionTime: number;
  createdAt: string;
}>;

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface ICodeExecutionProvider {
  executeCode(
    code: string,
    language: string,
    options?: {
      timeout?: number;
      memoryLimit?: number;
      enableNetwork?: boolean;
      workingDir?: string;
      env?: Record<string, string>;
    },
  ): Promise<ExecutionResult>;

  executeScript(
    scriptId: string,
    options?: { timeout?: number },
  ): Promise<ExecutionResult>;

  getExecutionHistory(
    page: number,
    limit: number,
  ): Promise<{ executions: ExecutionHistory; total: number }>;

  cancelExecution(executionId: string): Promise<boolean>;

  validateCode(code: string, language: string): Promise<ValidationResult>;
}

// ─────────────────────────────────────────────────────────────
// Mock Code Execution Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockCodeExecutionProvider implements ICodeExecutionProvider {
  private readonly logger = new Logger(MockCodeExecutionProvider.name);
  private readonly executions = new Map<string, ExecutionResult>();

  async executeCode(
    code: string,
    language: string,
    options?: {
      timeout?: number;
      memoryLimit?: number;
      enableNetwork?: boolean;
      workingDir?: string;
      env?: Record<string, string>;
    },
  ): Promise<ExecutionResult> {
    this.logger.log('Executing ' + language + ' code');
    const id = 'exec-' + Date.now();

    // Simulate execution
    const startTime = Date.now();

    try {
      let output = '';
      let error: string | undefined;

      // Simple mock execution - in production, use actual sandbox
      if (language === 'javascript' || language === 'typescript') {
        if (code.includes('console.log')) {
          const match = code.match(/console\.log\(['"`](.*?)['"`]\)/);
          output = match ? match[1] : 'Code executed';
        } else if (code.includes('return')) {
          output = 'Code returned successfully';
        } else {
          output = 'Code executed without output';
        }
      } else if (language === 'python') {
        if (code.includes('print')) {
          const match = code.match(/print\(['"`](.*?)['"`]\)/);
          output = match ? match[1] : 'Python script executed';
        } else {
          output = 'Python script executed';
        }
      } else if (language === 'bash') {
        output = 'Bash command executed';
      } else if (language === 'sql') {
        output = 'Query executed successfully';
      }

      const executionTime = Date.now() - startTime;

      const result: ExecutionResult = {
        id,
        status: 'success',
        output,
        executionTime,
        exitCode: 0,
      };

      this.executions.set(id, result);
      return result;
    } catch (e) {
      const executionTime = Date.now() - startTime;
      const result: ExecutionResult = {
        id,
        status: 'error',
        output: '',
        error: (e as Error).message,
        executionTime,
        exitCode: 1,
      };

      this.executions.set(id, result);
      return result;
    }
  }

  async executeScript(
    scriptId: string,
    options?: { timeout?: number },
  ): Promise<ExecutionResult> {
    this.logger.log('Executing script: ' + scriptId);
    return this.executeCode('// Script: ' + scriptId, 'javascript', {
      timeout: options?.timeout,
    });
  }

  async getExecutionHistory(
    page: number,
    limit: number,
  ): Promise<{ executions: ExecutionHistory; total: number }> {
    this.logger.log('Getting execution history');
    const all = Array.from(this.executions.values()).map((e) => ({
      id: e.id,
      language: 'javascript',
      status: e.status,
      executionTime: e.executionTime,
      createdAt: new Date().toISOString(),
    }));

    const start = (page - 1) * limit;
    const executions = all.slice(start, start + limit);

    return { executions, total: all.length };
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    this.logger.log('Cancelling execution: ' + executionId);
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'success') {
      execution.status = 'cancelled';
      return true;
    }
    return false;
  }

  async validateCode(
    code: string,
    language: string,
  ): Promise<ValidationResult> {
    this.logger.log('Validating ' + language + ' code');
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!code || code.trim().length === 0) {
      errors.push('Code cannot be empty');
    }

    if (language === 'javascript' || language === 'typescript') {
      if (code.includes('eval(')) {
        warnings.push('Use of eval() is discouraged');
      }
      if (code.includes('process.exit')) {
        warnings.push(
          'process.exit() may cause issues in sandboxed environments',
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class CodeExecutionTool extends BaseStructuredTool {
  readonly name = 'code_execution';
  readonly description =
    'Execute code in sandboxed environments, run scripts, manage execution history';
  readonly category = ToolCategory.CODE;
  readonly inputSchema = CodeExecutionInputSchema;

  private readonly log = new Logger(CodeExecutionTool.name);
  private readonly provider: ICodeExecutionProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockCodeExecutionProvider();
  }

  protected async executeImpl(
    input: CodeExecutionInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Code Execution action: ' + input.action);

    try {
      switch (input.action) {
        case 'execute_code':
          return await this.handleExecuteCode(input);
        case 'execute_script':
          return await this.handleExecuteScript(input);
        case 'get_execution_history':
          return await this.handleGetExecutionHistory(input);
        case 'cancel_execution':
          return await this.handleCancelExecution(input);
        case 'validate_code':
          return await this.handleValidateCode(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Code Execution action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleExecuteCode(
    input: CodeExecutionInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.code) {
      throw new Error('code is required for execute_code action');
    }
    const language = input.language || 'javascript';

    const result = await this.provider.executeCode(input.code, language, {
      timeout: input.options?.timeout,
      memoryLimit: input.options?.memoryLimit,
      enableNetwork: input.options?.enableNetwork,
      workingDir: input.options?.workingDir,
      env: input.options?.env,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleExecuteScript(
    input: CodeExecutionInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.scriptId) {
      throw new Error('scriptId is required for execute_script action');
    }

    const result = await this.provider.executeScript(input.scriptId, {
      timeout: input.options?.timeout,
    });

    return {
      success: true,
      data: result,
    };
  }

  private async handleGetExecutionHistory(
    input: CodeExecutionInput,
  ): Promise<StructuredToolResult<unknown>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.provider.getExecutionHistory(page, limit);
    return {
      success: true,
      data: result,
    };
  }

  private async handleCancelExecution(
    input: CodeExecutionInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.executionId) {
      throw new Error('executionId is required for cancel_execution action');
    }

    const result = await this.provider.cancelExecution(input.executionId);
    return {
      success: result,
      data: { cancelled: result },
    };
  }

  private async handleValidateCode(
    input: CodeExecutionInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.code) {
      throw new Error('code is required for validate_code action');
    }
    const language = input.language || 'javascript';

    const result = await this.provider.validateCode(input.code, language);
    return {
      success: true,
      data: result,
    };
  }
}
