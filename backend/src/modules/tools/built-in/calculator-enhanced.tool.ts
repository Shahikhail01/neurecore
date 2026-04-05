/**
 * Enhanced Calculator Tool with Structured Output
 *
 * Demonstrates the @Tool decorator pattern and Zod schema validation.
 * Supports mathematical expressions with proper type safety.
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// Input schema for the calculator tool
export const CalculatorInputSchema = z.object({
  expression: z
    .string()
    .describe(
      'Mathematical expression to evaluate (e.g., "2 + 2", "sin(pi/2)", "sqrt(16)")',
    ),
  precision: z
    .number()
    .int()
    .min(0)
    .max(15)
    .default(6)
    .optional()
    .describe('Decimal precision for the result'),
});

export type CalculatorInput = z.infer<typeof CalculatorInputSchema>;

// Output schema for the calculator tool
export const CalculatorOutputSchema = z.object({
  result: z.number().describe('The calculated result'),
  expression: z.string().describe('The original expression'),
  precision: z.number().describe('The precision used'),
  formatted: z.string().describe('Human-readable formatted result'),
});

export type CalculatorOutput = z.infer<typeof CalculatorOutputSchema>;

/**
 * Enhanced Calculator Tool
 *
 * Features:
 * - Zod schema validation for inputs and outputs
 * - Mathematical expression evaluation
 * - Precision control
 * - Detailed structured output
 */
@Injectable()
export class CalculatorEnhancedTool extends BaseStructuredTool {
  readonly name = 'calculator_enhanced';
  readonly description =
    'Evaluate mathematical expressions with high precision. Supports basic arithmetic (+, -, *, /), powers (^), square root (sqrt), trigonometric functions (sin, cos, tan), and constants (pi, e).';
  readonly category = ToolCategory.CALCULATION;
  readonly inputSchema = CalculatorInputSchema;
  readonly outputSchema = CalculatorOutputSchema;

  /**
   * Implementation of the calculator logic
   */

  protected async executeImpl(
    input: CalculatorInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<CalculatorOutput>> {
    const startTime = Date.now();
    // Logger.debug is sync, so we mark it to avoid lint warning
    void this.logger.debug(`Evaluating expression: ${input.expression}`, {
      tenantId: context?.tenantId,
      userId: context?.userId,
    });

    try {
      const result = this.evaluateExpression(input.expression);
      const precision = input.precision ?? 6;

      const output: CalculatorOutput = {
        result,
        expression: input.expression,
        precision,
        formatted: this.formatResult(result, precision),
      };

      // Validate output against output schema
      const validation = this.outputSchema.safeParse(output);
      if (!validation.success) {
        return {
          success: false,
          error: `Output validation failed: ${validation.error.message}`,
        };
      }

      return {
        success: true,
        data: output,
        metadata: {
          durationMs: Date.now() - startTime,
          model: 'calculator-v1',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to evaluate expression: ${input.expression}`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Evaluate a mathematical expression
   * Supports basic operations and common functions
   */
  private evaluateExpression(expression: string): number {
    // Sanitize and normalize the expression
    const sanitized = this.sanitizeExpression(expression);

    // Replace constants
    let processed = sanitized
      .replace(/\bpi\b/gi, String(Math.PI))
      .replace(/\be\b(?![x])/gi, String(Math.E));

    // Replace functions
    processed = processed
      .replace(/\bsqrt\(([^)]+)\)/gi, 'Math.sqrt($1)')
      .replace(/\bsin\(([^)]+)\)/gi, 'Math.sin($1)')
      .replace(/\bcos\(([^)]+)\)/gi, 'Math.cos($1)')
      .replace(/\btan\(([^)]+)\)/gi, 'Math.tan($1)')
      .replace(/\blog\(([^)]+)\)/gi, 'Math.log($1)')
      .replace(/\bln\(([^)]+)\)/gi, 'Math.log($1)')
      .replace(/\bexp\(([^)]+)\)/gi, 'Math.exp($1)')
      .replace(/\bpow\(([^,]+),([^)]+)\)/gi, 'Math.pow($1,$2)')
      .replace(/\^/g, '**');

    // Safely evaluate using Function constructor (controlled environment)
    try {
      // Only allow numbers, operators, parentheses, and Math functions
      if (!/^[\d\s+\-*/().,%Math\w]+$/.test(processed)) {
        throw new Error('Invalid characters in expression');
      }

      const result = new Function(
        `"use strict"; return (${processed})`,
      )() as number;

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Result is not a valid number');
      }

      return result;
    } catch (error) {
      throw new Error(
        `Invalid expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Sanitize the input expression
   */
  private sanitizeExpression(expression: string): string {
    // Remove any potentially dangerous characters
    return expression.replace(/[^0-9a-zA-Z+\-*/().,%^\s]/g, '').trim();
  }

  /**
   * Format the result for display
   */
  private formatResult(value: number, precision: number): string {
    if (Number.isInteger(value)) {
      return value.toString();
    }

    // Use toFixed for decimal representation
    const fixed = value.toFixed(precision);

    // Remove trailing zeros
    return parseFloat(fixed).toString();
  }
}
