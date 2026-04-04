/**
 * DatabaseQueryTool
 *
 * Executes read-only (SELECT) SQL queries against the application database
 * via Prisma's raw query interface.
 *
 * Security:
 *   - SELECT-only gate: rejects any statement that does not start with SELECT.
 *   - Parameterized execution: parameters are passed separately from the SQL
 *     template, preventing SQL injection via the params array.
 *   - Response truncation: returns at most 100 rows to avoid data exfiltration
 *     at scale.
 *   - Error sanitization: Prisma error details are never surfaced to the caller.
 *   - Tenant isolation note: callers MUST include tenant filtering in the query;
 *     this tool does NOT automatically append tenantId constraints.
 *
 * SOLID:
 *   SRP  — query execution only; result interpretation is the caller's concern.
 *   DIP  — depends on PrismaService abstraction.
 */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const DatabaseQueryInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      'A parameterized SELECT SQL statement. Use $1, $2, … placeholders for parameters.',
    ),
  params: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .max(20)
    .optional()
    .describe(
      'Ordered list of parameter values matching $1, $2, … placeholders',
    ),
});

type DatabaseQueryInput = z.infer<typeof DatabaseQueryInputSchema>;

const SELECT_REGEX = /^\s*SELECT\b/i;

@Injectable()
export class DatabaseQueryTool extends BaseStructuredTool {
  readonly name = 'database_query';
  readonly description =
    'Execute a read-only (SELECT) SQL query against the application database. ' +
    'Use parameterized placeholders ($1, $2, …) for dynamic values. ' +
    'Returns up to 100 rows. ' +
    'You MUST include tenantId in your WHERE clause to enforce data isolation.';
  readonly category = ToolCategory.DATABASE;
  readonly inputSchema = DatabaseQueryInputSchema;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected async executeImpl(
    input: DatabaseQueryInput,
    _context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<{ rows: unknown[]; rowCount: number }>> {
    // ── Security gate: SELECT only ────────────────────────────────────────
    if (!SELECT_REGEX.test(input.query)) {
      return {
        success: false,
        error: 'Only SELECT statements are permitted',
      };
    }

    const params = input.params ?? [];

    try {
      // $queryRawUnsafe with positional params is fully parameterized —
      // the param values are never interpolated into the SQL string.
      const rows = await (
        this.prisma.$queryRawUnsafe as (
          sql: string,
          ...values: unknown[]
        ) => Promise<unknown[]>
      )(input.query, ...params);

      // Truncate to 100 rows to prevent large data exfiltration
      const truncated = Array.isArray(rows) ? rows.slice(0, 100) : [];

      return {
        success: true,
        data: { rows: truncated, rowCount: truncated.length },
      };
    } catch {
      // Never surface Prisma internal error details (may contain schema info)
      this.logger.error('[DatabaseQueryTool] Query failed');
      return { success: false, error: 'Database query failed' };
    }
  }
}
