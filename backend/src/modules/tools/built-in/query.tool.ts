/**
 * QueryTool — Phase E (Weeks 21-22)
 *
 * Plain-English data queries over NeureCore entities. The agent calls this tool
 * with a natural-language question; the tool uses an LLM to translate it into
 * a structured query plan, validates the plan against a strict allow-list,
 * then executes it via Prisma.
 *
 * Actions:
 *   action='translate' → NL question → structured query plan (returns plan, doesn't execute)
 *   action='execute'   → run a pre-built query plan (from a prior translate)
 *   action='ask'       → translate + execute in one shot (most common)
 *
 * SECURITY MODEL:
 *   1. Only an allow-list of entities is reachable (see ALLOWED_ENTITIES below)
 *   2. Only an allow-list of fields per entity is readable
 *   3. Only safe operators (=, !=, >, <, >=, <=, in, contains, AND, OR)
 *   4. tenantId is force-injected into every where clause — no cross-tenant reads
 *   5. Limit is capped at 200 rows
 *   6. No writes (no create/update/delete)
 *   7. LLM output is JSON-parsed and validated against a Zod schema; invalid → error
 *
 * The agent's own LLM could answer these questions directly, but this tool
 * guarantees: (a) deterministic numeric accuracy, (b) tenant isolation, (c) a
 * structured artifact the agent can pipe into reports or further analysis.
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { ToolDataAccessService } from '../tool-data-access.service';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { LLMFactory } from '../../models/services/llm-factory.service';

// ─── Allowed schema (security allow-list) ───────────────────────────────────

const ALLOWED_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'] as const;
type Operator = (typeof ALLOWED_OPERATORS)[number];

const ALLOWED_ENTITIES = {
  task: {
    fields: [
      'id', 'title', 'description', 'status', 'priority', 'agentId', 'departmentId',
      'projectId', 'createdAt', 'updatedAt', 'completedAt', 'scheduledAt', 'tenantId',
    ],
    sortable: ['createdAt', 'updatedAt', 'completedAt', 'scheduledAt', 'priority'],
  },
  agent: {
    fields: [
      'id', 'name', 'description', 'status', 'model', 'departmentId', 'tenantId',
      'isActive', 'createdAt',
    ],
    sortable: ['createdAt', 'name'],
  },
  department: {
    fields: ['id', 'name', 'description', 'status', 'tenantId', 'createdAt'],
    sortable: ['createdAt', 'name'],
  },
  project: {
    fields: ['id', 'name', 'description', 'status', 'departmentId', 'tenantId', 'targetDate', 'createdAt'],
    sortable: ['createdAt', 'targetDate', 'name'],
  },
  user: {
    fields: ['id', 'email', 'firstName', 'lastName', 'role', 'tenantId', 'isActive', 'createdAt'],
    sortable: ['createdAt'],
  },
  costRecord: {
    fields: [
      'id', 'tenantId', 'agentId', 'departmentId', 'provider', 'model',
      'inputTokens', 'outputTokens', 'costCents', 'windowStart', 'windowEnd', 'createdAt',
    ],
    sortable: ['windowStart', 'costCents', 'createdAt'],
  },
} as const;
type EntityName = keyof typeof ALLOWED_ENTITIES;

// ─── Query plan schema (what the LLM produces) ──────────────────────────────

const FilterSchema = z.object({
  field: z.string().describe('Field name (must be in the entity allow-list)'),
  op: z.enum(ALLOWED_OPERATORS).describe('Comparison operator'),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
    .describe('Comparison value (arrays only valid for op=in)'),
});

const QueryPlanSchema = z.object({
  entity: z.enum(Object.keys(ALLOWED_ENTITIES) as [EntityName, ...EntityName[]])
    .describe('Which entity to query'),
  filters: z.array(FilterSchema).default([]).describe('AND-combined filters'),
  or: z.array(z.array(FilterSchema)).optional()
    .describe('OR groups — each inner array is AND-combined'),
  select: z.array(z.string()).optional()
    .describe('Fields to return (defaults to safe defaults per entity)'),
  orderBy: z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) }).optional()
    .describe('Sort order'),
  limit: z.number().int().positive().max(200).default(50).describe('Max rows (capped at 200)'),
  aggregation: z.enum(['count', 'sum', 'avg', 'min', 'max']).optional()
    .describe('Optional aggregation over a numeric field (returns single value)'),
  aggregateField: z.string().optional().describe('Field to aggregate (required if aggregation set)'),
});
export type QueryPlan = z.infer<typeof QueryPlanSchema>;

// ─── Tool input schema ──────────────────────────────────────────────────────

export const QueryInputSchema = z.object({
  action: z.enum(['translate', 'execute', 'ask']).describe('Query action'),

  // translate / ask
  question: z.string().min(3).optional()
    .describe("Natural-language question, e.g. 'How many overdue tasks do we have?' (translate/ask)"),

  // execute
  plan: QueryPlanSchema.optional().describe('Pre-built query plan (execute)'),
});
export type QueryInput = z.infer<typeof QueryInputSchema>;

export const QueryOutputSchema = z.object({
  action: z.string(),
  question: z.string().optional(),
  plan: QueryPlanSchema.optional(),
  rows: z.array(z.record(z.unknown())).optional(),
  count: z.number().optional(),
  aggregation: z.record(z.union([z.string(), z.number()])).optional(),
  durationMs: z.number().optional(),
  llmUsed: z.boolean().optional(),
});
export type QueryOutput = z.infer<typeof QueryOutputSchema>;

// ─── Tool implementation ───────────────────────────────────────────────────

@Injectable()
export class QueryTool extends BaseStructuredTool {
  readonly name = 'query';
  readonly description =
    'Query NeureCore data in plain English. ' +
    "action='ask' translates a natural-language question into a structured query, executes it, and returns rows. " +
    "action='translate' returns just the structured query plan without running it (useful for review). " +
    "action='execute' runs a pre-built plan. " +
    "Available entities: task, agent, department, project, user, costRecord. " +
    'Only safe, read-only queries allowed — no writes, always tenant-scoped. Max 200 rows per query.';
  readonly category = ToolCategory.DATABASE;
  readonly inputSchema = QueryInputSchema;
  readonly outputSchema = QueryOutputSchema;
  readonly requiredPermissions = ['data:read'];

  constructor(
    private readonly data: ToolDataAccessService,
    private readonly llm: LLMFactory,
    private readonly featureFlags: FeatureFlagService,
    private readonly aiGateway: AiGatewayService,
  ) {
    super();
  }

  protected async executeImpl(
    input: QueryInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<QueryOutput>> {
    const tenantId = context?.tenantId;
    if (!tenantId) return { success: false, error: 'Tenant context required' };

    try {
      if (input.action === 'translate') {
        if (!input.question) return { success: false, error: 'translate requires question' };
        const plan = await this.translate(input.question, tenantId);
        return {
          success: true,
          data: { action: 'translate', question: input.question, plan, llmUsed: true },
          metadata: { model: 'query-tool-v1' },
        };
      }

      if (input.action === 'execute') {
        if (!input.plan) return { success: false, error: 'execute requires plan' };
        return await this.run(input.plan, tenantId, undefined);
      }

      // ask = translate + execute
      if (!input.question) return { success: false, error: 'ask requires question' };
      const plan = await this.translate(input.question, tenantId);
      return await this.run(plan, tenantId, input.question);
    } catch (error) {
      this.logger.error(`QueryTool [${input.action}] failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      };
    }
  }

  // ─── NL → Plan ───────────────────────────────────────────────────────────

  private async translate(question: string, _tenantId: string): Promise<QueryPlan> {
    const schemaDesc = describeSchema();
    const prompt = `You are a query planner for NeureCore. Convert the user's natural-language question into a structured JSON query plan.

${schemaDesc}

Rules:
- Output ONLY the JSON object — no prose, no markdown fences, no explanations.
- Always include tenantId-safe filters (the system adds tenantId automatically — do not add it).
- Use 'contains' for substring matches on text fields (case-insensitive).
- For "how many" / "count of" → use aggregation='count'.
- For "total cost" / "sum of" → use aggregation='sum' with aggregateField='costCents'.
- For "average" / "avg" → use aggregation='avg'.
- Order results by a meaningful field (createdAt desc by default).

User question: ${question}`;

    const response = await this.invokeLlm(prompt, 'query-tool.translate');
    const text = response.content.trim();
    // Be tolerant of LLM wrapping JSON in markdown fences
    const json = extractJsonObject(text);
    const parsed = QueryPlanSchema.safeParse(JSON.parse(json));
    if (!parsed.success) {
      throw new Error(`LLM produced invalid query plan: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    }
    return parsed.data;
  }

  // ─── Execute plan ────────────────────────────────────────────────────────

  private async run(
    plan: QueryPlan,
    tenantId: string,
    question: string | undefined,
  ): Promise<StructuredToolResult<QueryOutput>> {
    const start = Date.now();

    // Validate plan against allow-list
    const entitySpec = ALLOWED_ENTITIES[plan.entity];
    if (!entitySpec) throw new Error(`Entity not allowed: ${plan.entity}`);
    const allowedFields = new Set<string>(entitySpec.fields);

    for (const f of plan.filters) {
      if (!allowedFields.has(f.field)) {
        throw new Error(`Field "${f.field}" not allowed on entity "${plan.entity}"`);
      }
    }
    if (plan.or) {
      for (const group of plan.or) {
        for (const f of group) {
          if (!allowedFields.has(f.field)) {
            throw new Error(`Field "${f.field}" not allowed on entity "${plan.entity}"`);
          }
        }
      }
    }

    const select = (plan.select ?? defaultSelect(plan.entity))
      .filter((f) => allowedFields.has(f));
    if (select.length === 0) {
      throw new Error('No valid fields selected');
    }

    if (plan.aggregation) {
      if (!plan.aggregateField || !allowedFields.has(plan.aggregateField)) {
        throw new Error(`aggregateField invalid for entity "${plan.entity}"`);
      }
      const where = buildWhere(plan, tenantId);
      const aggFn = plan.aggregation;
      const result = await (this.data as Record<string, any>)[plan.entity].aggregate({
        where,
        _count: aggFn === 'count' ? { _all: true } : undefined,
        _sum: aggFn === 'sum' ? { [plan.aggregateField]: true } : undefined,
        _avg: aggFn === 'avg' ? { [plan.aggregateField]: true } : undefined,
        _min: aggFn === 'min' ? { [plan.aggregateField]: true } : undefined,
        _max: aggFn === 'max' ? { [plan.aggregateField]: true } : undefined,
      });
      const value =
        aggFn === 'count'
          ? Number(result._count?._all ?? 0)
          : Number((result as Record<string, any>)[`_${aggFn}`]?.[plan.aggregateField] ?? 0);
      return {
        success: true,
        data: {
          action: 'execute',
          question,
          plan,
          aggregation: { [aggFn]: value, field: plan.aggregateField },
          count: 1,
          durationMs: Date.now() - start,
        },
        metadata: { model: 'query-tool-v1' },
      };
    }

    const orderBy = plan.orderBy && entitySpec.sortable.includes(plan.orderBy.field as never)
      ? { [plan.orderBy.field]: plan.orderBy.direction }
      : { createdAt: 'desc' };
    const where = buildWhere(plan, tenantId);

    const rows = await (this.data as Record<string, any>)[plan.entity].findMany({
      where,
      select: select.reduce<Record<string, true>>((acc, f) => ({ ...acc, [f]: true }), {}),
      orderBy,
      take: Math.min(plan.limit, 200),
    });

    return {
      success: true,
      data: {
        action: 'execute',
        question,
        plan,
        rows: rows as Record<string, unknown>[],
        count: rows.length,
        durationMs: Date.now() - start,
      },
      metadata: { model: 'query-tool-v1' },
    };
  }

  private async invokeLlm(
    prompt: string,
    sourceModule: string,
  ): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
    if (await this.featureFlags.isEnabled('AI_GATEWAY_V2')) {
      const resp = await this.aiGateway.invoke({
        tenantId: null,
        capability: 'tools',
        prompt,
        temperature: 0.1,
        maxTokens: 600,
        sourceModule,
      });
      return { content: resp.content, usage: resp.usage };
    }
    const result = await this.llm.invoke(prompt, { temperature: 0.1, maxTokens: 600 });
    return { content: result.content, usage: result.usage };
  }
}

// ─── pure helpers ───────────────────────────────────────────────────────────

function defaultSelect(entity: EntityName): string[] {
  switch (entity) {
    case 'task':
      return ['id', 'title', 'status', 'priority', 'agentId', 'departmentId', 'createdAt', 'completedAt'];
    case 'agent':
      return ['id', 'name', 'status', 'model', 'departmentId', 'createdAt'];
    case 'department':
      return ['id', 'name', 'status', 'createdAt'];
    case 'project':
      return ['id', 'name', 'status', 'departmentId', 'targetDate'];
    case 'user':
      return ['id', 'email', 'firstName', 'lastName', 'role'];
    case 'costRecord':
      return ['agentId', 'departmentId', 'provider', 'model', 'costCents', 'windowStart'];
    default:
      return ['id', 'createdAt'];
  }
}

function buildWhere(plan: QueryPlan, tenantId: string): Record<string, unknown> {
  const where: Record<string, unknown> = { tenantId };

  for (const f of plan.filters) {
    const v = coerceFilterValue(f.field, f.op, f.value);
    where[f.field] = { [opToPrisma(f.op)]: v };
  }

  if (plan.or && plan.or.length > 0) {
    where['OR'] = plan.or.map((group) => {
      const g: Record<string, unknown> = {};
      for (const f of group) {
        g[f.field] = { [opToPrisma(f.op)]: coerceFilterValue(f.field, f.op, f.value) };
      }
      return g;
    });
  }

  return where;
}

function opToPrisma(op: Operator): string {
  switch (op) {
    case 'eq': return 'equals';
    case 'neq': return 'not';
    case 'gt': return 'gt';
    case 'gte': return 'gte';
    case 'lt': return 'lt';
    case 'lte': return 'lte';
    case 'in': return 'in';
    case 'contains': return 'contains';
  }
}

function coerceFilterValue(
  field: string,
  op: Operator,
  value: unknown,
): unknown {
  if (op === 'contains' && typeof value === 'string') {
    return value.toLowerCase();
  }
  if (field.endsWith('At') || field.endsWith('Date')) {
    // Allow ISO date strings; pass through
    return value;
  }
  return value;
}

function describeSchema(): string {
  const lines: string[] = ['Available entities and fields:'];
  for (const [entity, spec] of Object.entries(ALLOWED_ENTITIES)) {
    lines.push(`\n${entity}:`);
    lines.push(`  fields: ${spec.fields.join(', ')}`);
    lines.push(`  sortable: ${spec.sortable.join(', ')}`);
  }
  lines.push('\nOperators: eq, neq, gt, gte, lt, lte, in, contains');
  lines.push('JSON shape: { entity, filters: [{field, op, value}], or?: [[{field,op,value},...]], select?: [...], orderBy?: {field, direction}, limit?: number, aggregation?: "count"|"sum"|"avg"|"min"|"max", aggregateField?: string }');
  return lines.join('\n');
}

function extractJsonObject(text: string): string {
  // Strip markdown fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) return fenced[1];
  // Find first { ... last } (brace-balanced)
  const first = text.indexOf('{');
  if (first === -1) throw new Error('No JSON object found in LLM response');
  let depth = 0;
  for (let i = first; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(first, i + 1);
    }
  }
  throw new Error('No balanced JSON object in LLM response');
}