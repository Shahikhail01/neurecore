/**
 * Code Analysis Tool - P1-8 of remaining tools
 * Enables AI agents to perform static code analysis for CTO, DevOps agents
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for code analysis operations
 * - OCP: Extensible via analysis provider interfaces
 * - DIP: Depends on abstractions for code analysis
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

export const CodeAnalysisActionEnum = z.enum([
  'analyze_code',
  'check_security',
  'get_metrics',
  'suggest_improvements',
  'list_issues',
]);

export type CodeAnalysisAction = z.infer<typeof CodeAnalysisActionEnum>;

export const CodeAnalysisInputSchema = z.object({
  action: CodeAnalysisActionEnum.describe(
    'The code analysis action to perform',
  ),
  code: z.string().optional().describe('Code to analyze'),
  language: z
    .enum([
      'javascript',
      'typescript',
      'python',
      'java',
      'go',
      'rust',
      'csharp',
    ])
    .optional()
    .describe('Programming language'),
  projectPath: z.string().optional().describe('Project path to analyze'),
  options: z
    .object({
      includeSecurity: z.boolean().optional().default(true),
      includePerformance: z.boolean().optional().default(true),
      includeBestPractices: z.boolean().optional().default(true),
    })
    .optional(),
});

export type CodeAnalysisInput = z.infer<typeof CodeAnalysisInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schemas
// ─────────────────────────────────────────────────────────────

export const CodeIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.string(),
  message: z.string(),
  line: z.number().optional(),
  suggestion: z.string().optional(),
});

export const CodeMetricsSchema = z.object({
  linesOfCode: z.number(),
  complexity: z.number(),
  maintainability: z.number(),
  testCoverage: z.number().optional(),
});

export const CodeAnalysisOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  issues: z.array(CodeIssueSchema).optional(),
  metrics: CodeMetricsSchema.optional(),
  suggestions: z.array(z.string()).optional(),
});

// ─────────────────────────────────────────────────────────────
// Output Types (Explicit TypeScript types to avoid SWC issues)
// Using Array<T> instead of T[] to avoid SWC parsing issues
// ─────────────────────────────────────────────────────────────

type CodeIssue = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  line?: number;
  suggestion?: string;
};

type CodeMetrics = {
  linesOfCode: number;
  complexity: number;
  maintainability: number;
  testCoverage?: number;
};

type CodeIssueList = Array<CodeIssue>;
type CodeMetricsResult = CodeMetrics;
type SuggestionsList = Array<string>;

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface ICodeAnalysisProvider {
  analyzeCode(options: {
    code: string;
    language?: string;
    options?: {
      includeSecurity?: boolean;
      includePerformance?: boolean;
      includeBestPractices?: boolean;
    };
  }): Promise<{ issues: CodeIssueList; metrics: CodeMetricsResult }>;

  checkSecurity(
    code: string,
    language?: string,
  ): Promise<{ issues: CodeIssueList }>;

  getMetrics(code: string, language?: string): Promise<CodeMetricsResult>;

  suggestImprovements(
    code: string,
    language?: string,
  ): Promise<{ suggestions: SuggestionsList }>;
}

// ─────────────────────────────────────────────────────────────
// Mock Code Analysis Provider
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockCodeAnalysisProvider implements ICodeAnalysisProvider {
  private readonly logger = new Logger(MockCodeAnalysisProvider.name);

  async analyzeCode(options: {
    code: string;
    language?: string;
    options?: {
      includeSecurity?: boolean;
      includePerformance?: boolean;
      includeBestPractices?: boolean;
    };
  }): Promise<{ issues: CodeIssueList; metrics: CodeMetricsResult }> {
    this.logger.log('Analyzing code: ' + (options.language || 'auto'));
    const lines = options.code.split('\n').length;
    return {
      issues: [
        {
          id: '1',
          severity: 'medium' as const,
          category: 'Best Practices',
          message: 'Consider adding JSDoc comments',
          line: 5,
          suggestion: 'Add documentation for better maintainability',
        },
      ],
      metrics: {
        linesOfCode: lines,
        complexity: Math.floor(Math.random() * 20) + 1,
        maintainability: Math.floor(Math.random() * 30) + 70,
        testCoverage: Math.floor(Math.random() * 40) + 60,
      },
    };
  }

  async checkSecurity(
    code: string,
    language?: string,
  ): Promise<{ issues: CodeIssueList }> {
    this.logger.log('Checking security: ' + (language || 'auto'));
    const issues: CodeIssueList = [];
    if (code.includes('eval(')) {
      issues.push({
        id: 'sec-1',
        severity: 'high' as const,
        category: 'Security',
        message: 'Avoid using eval()',
        suggestion: 'Use safer alternatives',
      });
    }
    if (
      code.includes('password') &&
      code.includes('=') &&
      !code.includes('process.env')
    ) {
      issues.push({
        id: 'sec-2',
        severity: 'critical' as const,
        category: 'Security',
        message: 'Potential hardcoded credentials',
        suggestion: 'Use environment variables',
      });
    }
    return { issues };
  }

  async getMetrics(
    code: string,
    language?: string,
  ): Promise<CodeMetricsResult> {
    this.logger.log('Getting metrics: ' + (language || 'auto'));
    const lines = code.split('\n').length;
    return {
      linesOfCode: lines,
      complexity: Math.floor(Math.random() * 20) + 1,
      maintainability: Math.floor(Math.random() * 30) + 70,
      testCoverage: Math.floor(Math.random() * 40) + 60,
    };
  }

  async suggestImprovements(
    code: string,
    language?: string,
  ): Promise<{ suggestions: SuggestionsList }> {
    this.logger.log('Generating suggestions: ' + (language || 'auto'));
    return {
      suggestions: [
        'Consider extracting complex logic into smaller functions',
        'Add error handling for better resilience',
        'Use type hints for better code documentation',
        'Consider caching frequently called results',
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class CodeAnalysisTool extends BaseStructuredTool {
  readonly name = 'code_analysis';
  readonly description =
    'Perform static code analysis, security checks, and get improvement suggestions';
  readonly category = ToolCategory.CODE;
  readonly inputSchema = CodeAnalysisInputSchema;

  private readonly log = new Logger(CodeAnalysisTool.name);
  private readonly provider: ICodeAnalysisProvider;

  constructor(private readonly config: ConfigService) {
    super();
    this.provider = new MockCodeAnalysisProvider();
  }

  protected async executeImpl(
    input: CodeAnalysisInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.log.log('Executing Code Analysis action: ' + input.action);

    try {
      switch (input.action) {
        case 'analyze_code':
          return await this.handleAnalyzeCode(input);
        case 'check_security':
          return await this.handleCheckSecurity(input);
        case 'get_metrics':
          return await this.handleGetMetrics(input);
        case 'suggest_improvements':
          return await this.handleSuggestImprovements(input);
        case 'list_issues':
          return await this.handleListIssues(input);
        default:
          throw new Error('Unknown action: ' + input.action);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Code Analysis action failed: ' + err.message, err.stack);
      return { success: false, error: err.message };
    }
  }

  private async handleAnalyzeCode(
    input: CodeAnalysisInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.code) {
      throw new Error('code is required for analyze_code action');
    }
    const result = await this.provider.analyzeCode({
      code: input.code,
      language: input.language,
      options: input.options,
    });
    return {
      success: true,
      data: { issues: result.issues, metrics: result.metrics },
    };
  }

  private async handleCheckSecurity(
    input: CodeAnalysisInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.code) {
      throw new Error('code is required for check_security action');
    }
    const result = await this.provider.checkSecurity(
      input.code,
      input.language,
    );
    return { success: true, data: { issues: result.issues } };
  }

  private async handleGetMetrics(
    input: CodeAnalysisInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.code) {
      throw new Error('code is required for get_metrics action');
    }
    const metrics = await this.provider.getMetrics(input.code, input.language);
    return { success: true, data: { metrics } };
  }

  private async handleSuggestImprovements(
    input: CodeAnalysisInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.code) {
      throw new Error('code is required for suggest_improvements action');
    }
    const result = await this.provider.suggestImprovements(
      input.code,
      input.language,
    );
    return { success: true, data: { suggestions: result.suggestions } };
  }

  private async handleListIssues(
    input: CodeAnalysisInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.code) {
      throw new Error('code is required for list_issues action');
    }
    const result = await this.provider.analyzeCode({
      code: input.code,
      language: input.language,
    });
    return { success: true, data: { issues: result.issues } };
  }
}
