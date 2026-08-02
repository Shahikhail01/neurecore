/**
 * TypedParameterExtractor — Phase 2
 *
 * Deterministic parsing first; constrained LLM structured extraction second;
 * strict schema validation last.
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { ExtractionInput } from '../interfaces';

@Injectable()
export class TypedParameterExtractor {
  private readonly logger = new Logger(TypedParameterExtractor.name);

  async extract<P extends z.ZodTypeAny>(
    input: ExtractionInput,
  ): Promise<z.infer<P>> {
    const { message, schema } = input;
    const zodSchema = schema as z.ZodTypeAny;

    // Step 1: Deterministic parsing from known patterns
    const deterministic = this.tryDeterministicParse(message, zodSchema);
    if (deterministic.success) {
      return deterministic.data as z.infer<P>;
    }

    // Step 2: Constrained LLM extraction (if deterministic fails)
    // This would call the LLM with a constrained prompt
    // For now, fall back to validation errors
    const parsed = zodSchema.safeParse({});
    if (!parsed.success) {
      this.logger.warn(`Parameter extraction failed: ${parsed.error.message}`);
      throw new Error(
        `Invalid params: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }

    return parsed.data as z.infer<P>;
  }

  private tryDeterministicParse(
    message: string,
    schema: z.ZodTypeAny,
  ): { success: boolean; data?: unknown } {
    // Extract known field patterns from natural language
    const extracted: Record<string, unknown> = {};

    // Extract ID fields (UUID-like patterns)
    const idMatch = message.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
    if (idMatch) {
      extracted['id'] = idMatch[1];
    }

    // Extract status values
    const statusMatch = message.match(/\b(ACTIVE|INACTIVE|PENDING|COMPLETED|FAILED|ARCHIVED|LEAD|PROPOSAL_SENT|WON|LOST|DRAFT|READY|ASSIGNED|IN_PROGRESS|NEEDS_REVIEW|APPROVED|BLOCKED|CANCELLED)\b/gi);
    if (statusMatch) {
      extracted['status'] = statusMatch[0].toUpperCase();
    }

    // Extract numeric values
    const numberMatch = message.match(/\b(\d+)\b/);
    if (numberMatch) {
      extracted['limit'] = parseInt(numberMatch[1], 10);
      extracted['page'] = 1;
    }

    // Extract search queries
    const searchMatch = message.match(/(?:search|find|look for|looking for)\s+(?:["']?)([^"']+)(?:["']?)$/i);
    if (searchMatch) {
      extracted['search'] = searchMatch[1].trim();
    }

    // If we extracted something, try to merge with schema defaults
    if (Object.keys(extracted).length > 0) {
      const parsed = (schema as z.ZodObject<z.ZodRawShape>).safeParse(extracted);
      if (parsed.success) {
        return { success: true, data: parsed.data };
      }
    }

    return { success: false };
  }

  validateSchema(input: unknown, schema: z.ZodTypeAny): { valid: boolean; errors?: string[] } {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        valid: false,
        errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      };
    }
    return { valid: true };
  }
}
