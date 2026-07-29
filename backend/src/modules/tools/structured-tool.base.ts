/**
 * BaseStructuredTool — Abstract base class for structured tools
 *
 * SRP: Provides common functionality for all tools
 * OCP: Extend to create new tools without modifying existing code
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type {
  IStructuredTool,
  StructuredToolResult,
  ToolExecutionContext,
} from './interfaces/structured-tool.interface';
import { ToolCategory as TC } from './interfaces/structured-tool.interface';

/**
 * Base class for structured tools with Zod validation
 */
export abstract class BaseStructuredTool implements IStructuredTool {
  protected readonly logger = new Logger(this.constructor.name);

  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly category: TC;
  abstract readonly inputSchema: z.ZodSchema;
  readonly outputSchema?: z.ZodSchema;
  readonly requiredPermissions?: string[];
  readonly version?: string;

  /**
   * Core execution logic - override in subclasses
   */
  protected abstract executeImpl(
    input: z.infer<this['inputSchema']>,
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<unknown>>;

  /**
   * Coerce common LLM mistakes (stringified numbers, stringified booleans)
   * before strict Zod parsing. Most tool-input schemas declared `limit:
   * z.number()` but the LLM frequently returns `limit: "10"` as a JSON
   * string — Zod's strict parse rejects this with "Expected number,
   * received string" and the agent then loops trying the same broken call.
   * `coerceJsonArgs` is a best-effort, opt-in via opt-in opt-in schema shape:
   *   - every string property whose value parses as a finite number is
   *     left alone (object keys, enums, free-text) but numeric-looking
   *     strings are NOT auto-coerced (that would corrupt enums and codes).
   * So we only coerce when the schema explicitly accepts numbers — we let
   * Zod's own coercion handle it. We do, however, normalize enum-case
   * mismatches by uppercasing known-uppercase enum fields (handled below
   * via .transform() in each tool's schema).
   *
   * The only robust generic fix is to make Zod coerce numbers / booleans
   * across the whole input. We do this by mapping over the parsed schema
   * shape (when it is a ZodObject) and replacing every `z.number()` leaf
   * with `z.coerce.number()` for the first parse. This is conservative:
   * it never changes the schema for callers (they keep their strict types
   * via `z.infer`), but it accepts stringified inputs from the LLM.
   */
  async execute(
    input: unknown,
    context: Partial<ToolExecutionContext> = {},
  ): Promise<StructuredToolResult<unknown>> {
    const startTime = Date.now();

    this.logger.debug(`[Tool ${this.name}] execute() called with input=${JSON.stringify(input)?.slice(0, 500)}`);

    // Validate input and capture the parsed (transformed) result so that
    // .transform() calls in the Zod schema (e.g. lowercase enum → uppercase)
    // are applied before executeImpl sees the value. Previously we passed
    // the raw `input` to executeImpl, which meant `budgetType: "fixed"` never
    // got converted to `FIXED_FEE` and Prisma rejected it with
    // "Invalid value for argument `budgetType`. Expected BudgetType."
    let parsedInput: z.infer<this['inputSchema']>;
    try {
      parsedInput = this.coerceAndParse(input);
    } catch (parseErr) {
      const errors =
        parseErr instanceof z.ZodError
          ? parseErr.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
          : [String(parseErr)];
      this.logger.warn(
        `[Tool ${this.name}] input validation failed: ${errors.join(', ')}`,
      );
      return {
        success: false,
        error: `Invalid input: ${errors.join(', ')}`,
        metadata: { durationMs: Date.now() - startTime },
      };
    }

    try {
      const result = await this.executeImpl(parsedInput, context);
      return {
        ...result,
        metadata: {
          ...result.metadata,
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(`Tool ${this.name} execution failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { durationMs: Date.now() - startTime },
      };
    }
  }

  /**
   * LLM tool-call arguments frequently serialize numbers and booleans as
   * strings ("limit": "10", "isActive": "true"). This wraps the parsed
   * schema with a coercion-aware variant so we accept both shapes without
   * requiring every tool author to write `z.coerce.number()` explicitly.
   *
   * The implementation walks the schema tree; for any leaf that is a
   * `z.number()` / `z.boolean()` we replace it with the corresponding
   * `z.coerce.*` form so a JSON string is accepted and coerced. For
   * enums, unions, and string-typed leaves we leave the schema untouched
   * to avoid corrupting codes or free-text.
   *
   * The returned coerced schema is cached per (schema identity) to keep
   * repeated calls cheap.
   */
  private coerceAndParse(input: unknown): z.infer<this['inputSchema']> {
    const coerced = this.getCoercedSchema(this.inputSchema as z.ZodType);
    return coerced.parse(input);
  }

  private coercedSchemaCache = new WeakMap<z.ZodType, z.ZodType>();

  private getCoercedSchema(schema: z.ZodType): z.ZodType {
    const cached = this.coercedSchemaCache.get(schema);
    if (cached) return cached;
    const coerced = this.coerceSchemaNode(schema);
    this.coercedSchemaCache.set(schema, coerced);
    return coerced;
  }

  private coerceSchemaNode(node: z.ZodType): z.ZodType {
    // ZodObject — recurse into each field, preserve optional/default
    if (node instanceof z.ZodObject) {
      const shape: Record<string, z.ZodTypeAny> = (node as z.ZodObject<any>).shape;
      const newShape: Record<string, z.ZodTypeAny> = {};
      for (const [k, v] of Object.entries(shape)) {
        newShape[k] = this.coerceWrapped(v);
      }
      return z.object(newShape).passthrough();
    }
    // ZodArray — coerce the inner element type
    if (node instanceof z.ZodArray) {
      const inner = (node as z.ZodArray<any>)._def.typeName === 'ZodArray'
        ? (node as any)._def.type
        : (node as any).element;
      return z.array(this.coerceSchemaNode(inner));
    }
    // ZodOptional / ZodDefault — coerce inner and re-wrap
    const def: any = (node as any)._def;
    if (def?.typeName === 'ZodOptional') {
      return (this.coerceSchemaNode(def.innerType) as any).optional();
    }
    if (def?.typeName === 'ZodDefault') {
      return (this.coerceSchemaNode(def.innerType) as any).default(
        (node as any)._def.defaultValue,
      );
    }
    // Leaves — coerce numbers and booleans
    if (node instanceof z.ZodNumber) {
      return z.coerce.number();
    }
    if (node instanceof z.ZodBoolean) {
      return z.coerce.boolean();
    }
    return node;
  }

  private coerceWrapped(v: z.ZodTypeAny): z.ZodTypeAny {
    // Preserve .describe(...) metadata where possible.
    const desc = (v as any)._def?.description ?? (v as any).description;
    const coerced = this.coerceSchemaNode(v);
    return desc ? coerced.describe(desc) : coerced;
  }

  /**
   * Validate input against schema
   */
  validate(input: unknown): { valid: boolean; errors?: string[] } {
    try {
      this.inputSchema.parse(input);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  /**
   * Generate OpenAI function calling format
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
  } {
    // Extract properties from the input schema for OpenAI function calling
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    // For ZodObject schemas, we can extract shape
    if (this.inputSchema instanceof z.ZodObject) {
      const shape: Record<string, z.ZodTypeAny> = (
        this.inputSchema as z.ZodObject<any>
      ).shape;
      for (const [key, value] of Object.entries(shape)) {
        const fieldType = this.getFieldType(value);
        properties[key] = fieldType;
        if (!this.isOptional(value)) {
          required.push(key);
        }
      }
    } else {
      // Fallback: treat as having unknown properties
      // In practice, tools should use ZodObject for their input schema
      properties['input'] = { type: 'string', description: 'Tool input' };
    }

    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      },
    };
  }

  /**
   * Helper to determine field type for OpenAI function calling
   */
  private getFieldType(value: z.ZodTypeAny): Record<string, unknown> {
    if (value instanceof z.ZodString) {
      return {
        type: 'string',
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodNumber) {
      return {
        type: 'number',
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodBoolean) {
      return {
        type: 'boolean',
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodArray) {
      return {
        type: 'array',
        items: { type: 'string' },
        description: value.description || '',
      };
    }
    if (value instanceof z.ZodObject) {
      return {
        type: 'object',
        properties: {},
        description: value.description || '',
      };
    }
    return { type: 'string' };
  }

  /**
   * Check if a Zod field is optional
   */
  private isOptional(value: z.ZodTypeAny): boolean {
    if (value instanceof z.ZodOptional) return true;
    if (value instanceof z.ZodDefault) return true;
    return false;
  }

  /**
   * Get tool definition for registration
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      parameters: this.inputSchema,
      requiredPermissions: this.requiredPermissions,
      version: this.version,
    };
  }
}
