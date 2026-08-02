import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';
import { BaseStructuredTool } from '../../../tools/structured-tool.base';
import type {
  StructuredToolResult,
  ToolExecutionContext,
} from '../../../tools/interfaces/structured-tool.interface';
import { ToolCategory } from '../../../tools/interfaces/structured-tool.interface';
import { CAPABILITY_MAP } from '../maps/capability-map';
import type { IResponseEnvelope } from '../interfaces/response-envelope.interface';
import { ResponseEnvelopeBuilder } from '../builders/response-envelope.builder';

/**
 * ServiceGatewayTool — A single `BaseStructuredTool` that maps namespaced
 * capabilities to existing NestJS service methods. Replaces the 106-tool
 * hand-coded bridge with one DI-injected map.
 *
 * Why one tool, not many (per Article XVI — Capability-Based Architecture):
 * capabilities are reusable. Existing 106 tools duplicate business logic
 * the services already encode. One gateway de-duplicates by routing
 * directly to the services.
 *
 * Tenant isolation (mandatory):
 *   - `tenantId` comes ONLY from `context.tenantId` (set by OfficialAgentGraph
 *     ← ChatService.stream({ tenantIdFromJwt }) ← JWT verified by JwtAuthGuard).
 *   - The tool NEVER reads tenantId from the LLM input.
 *   - All service methods invoked by adapters are tenant-scoped (their
 *     `where` always includes `tenantId`).
 *
 * Strict param keys:
 *   `BaseStructuredTool.coerceAndParse` re-wraps the schema with
 *   `.passthrough()` (structured-tool.base.ts:150), which silently drops
 *   the `.strict()` marker. We therefore add a SECONDARY key-whitelist
 *   check inside executeImpl against `cap.paramsSchema.shape`. Unknown
 *   keys return a structured `{ success: false, error }` rather than
 *   leaking into the service adapter.
 */
@Injectable()
export class ServiceGatewayTool extends BaseStructuredTool {
  protected readonly logger = new Logger(ServiceGatewayTool.name);
  readonly name = 'service-gateway';
  readonly category = ToolCategory.API;

  // Minimal surface — the actual params are re-validated against each
  // capability's strict schema inside executeImpl. The `passthrough` on
  // the base parser means unknown keys here would leak through; that's
  // why we enforce the whitelist below.
  //
  // PHASE-9 GATEWAY FIX (2026-08-01): some chat LLMs (notably DeepSeek's
  // chat model) emit `params` as a JSON-encoded string instead of a
  // nested object — OpenAI's tool_calls JSON-stringifies string-typed
  // properties by default. We accept either shape and transparently
  // convert the string to an object via z.preprocess.
  readonly inputSchema = z.object({
    capability: z.string().describe('Capability name from the platform service map'),
    params: z
      .preprocess(
        (v) => {
          if (typeof v === 'string') {
            try {
              const parsed = JSON.parse(v);
              if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
              }
            } catch {
              // fall through — return the string so the inner record()
              // validator surfaces a clear error.
            }
          }
          return v;
        },
        z.record(z.unknown()),
      )
      .optional(),
  });

  // Tool description is computed at class-load time from CAPABILITY_MAP so
  // the LLM is told exactly what capabilities exist (per FIX-053 /
  // Hermes-tools.md "LLM refuses tool" root cause).
  readonly description = [
    'service-gateway: invoke an approved READ-ONLY tenant-scoped backend capability.',
    'Returns a structured envelope that the frontend renders as tables, charts, or metrics.',
    '',
    'MANDATORY ROUTING (you MUST follow these exactly):',
    '  • User says "dashboard" or "summary" or "metrics" or "stats" or "overview" → MUST use: getDashboardSummary',
    '  • User says "customers" or "customer list" or "all customers" or "my customers" → MUST use: listCustomers',
    '  • User says "projects" or "project list" or "all projects" or "my projects" → MUST use: listProjects',
    '',
    'Capability list:',
    ...Object.values(CAPABILITY_MAP).map(
      (c) => `  - ${c.capability}: ${c.description}`,
    ),
    '',
    'IMPORTANT: When user asks for "dashboard" or "summary" or "metrics" → use getDashboardSummary (NOT listProjects).',
    'IMPORTANT: When user asks for "customers" → use listCustomers (NOT getDashboardSummary).',
    'IMPORTANT: When user asks for "projects" → use listProjects.',
    'IMPORTANT: Never perform a mutation through this tool. Mutations use the governed HITL tool path.',
    '',
    'If user asks for something that does not match any capability above, respond with a plain text apology.',
    '',
    'Format: { capability: "<name>", params: { ... } }.',
  ].join('\n');

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly envelopeBuilder: ResponseEnvelopeBuilder,
  ) {
    super();
  }

  protected async executeImpl(
    input: { capability: string; params?: Record<string, unknown> | string },
    context: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult & { envelope?: IResponseEnvelope }> {
    if (!context?.tenantId) {
      return { success: false, error: 'Tenant context required' };
    }

    // Phase 2: when the chat orchestrator pre-classified the request via
    // the deterministic classifier, `context.metadata?.forcedCapability`
    // carries the canonical capability that MUST be used. If the LLM
    // supplied a different `input.capability`, that's a routing
    // violation — we override and log it.
    const forced = context.metadata?.['forcedCapability'];
    if (typeof forced === 'string' && forced.length > 0) {
      if (input.capability !== forced) {
        this.logger.warn(
          `[service-gateway] Capability override: LLM supplied '${input.capability}', deterministic route forced '${forced}'`,
        );
      }
      input = { ...input, capability: forced };
    }

    const cap = CAPABILITY_MAP[input.capability];
    if (!cap) {
      return {
        success: false,
        error: `Unknown capability: ${input.capability}`,
      };
    }

    // Defense in depth: v1 is a read gateway. Even if a future map edit
    // accidentally registers a write capability, this execution boundary
    // must not bypass the governed legacy/HITL mutation path.
    if (!cap.readOnly) {
      return {
        success: false,
        error: `Write capability ${input.capability} is not permitted through service-gateway`,
      };
    }

    // PHASE-9 GATEWAY FIX (2026-08-01): the schema's `preprocess` (above)
    // already converts string-encoded params to objects, so by the time
    // we reach here `input.params` is always an object (or undefined for
    // no-arg capabilities). The TypeScript type still says `string |
    // object` to document the wire format — we narrow here.
    const rawParams: Record<string, unknown> =
      typeof input.params === 'object' && input.params !== null
        ? (input.params as Record<string, unknown>)
        : {};
    const allowedKeys = this.allowedKeys(cap.paramsSchema);
    const unknownKeys = Object.keys(rawParams).filter(
      (k) => !allowedKeys.includes(k),
    );
    if (unknownKeys.length > 0) {
      return {
        success: false,
        error:
          `Unknown params for capability ${input.capability}: ` +
          `${unknownKeys.join(', ')}. Allowed: ${allowedKeys.join(', ')}`,
      };
    }

    const parsed = cap.paramsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid params: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      };
    }

    let service: unknown;
    try {
      service = this.moduleRef.get(
        cap.serviceToken as Parameters<ModuleRef['get']>[0],
        { strict: false },
      );
    } catch (err) {
      return {
        success: false,
        error:
          `Service ${cap.serviceToken} unavailable: ` +
          (err instanceof Error ? err.message : String(err)),
      };
    }
    if (!service) {
      return {
        success: false,
        error: `Service ${cap.serviceToken} unavailable`,
      };
    }

    try {
      const result = await cap.adapter(
        service,
        context.tenantId,
        parsed.data,
      );
      const envelope = this.envelopeBuilder.buildToolResponse(
        cap.capability,
        { success: true, data: result },
      );
      return {
        success: true,
        data: result,
        metadata: { envelope } as never,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private allowedKeys(schema: unknown): string[] {
    // zod 3 exposes the parsed shape on the schema instance directly
    // (`z.ZodObject.shape`). Walking `_def.shape` works too, but its
    // shape object is a function-style map whose `Object.keys` returns
    // [] — so we always read from `schema.shape` first.
    const direct = (schema as { shape?: Record<string, unknown> }).shape;
    if (direct) {
      return Object.keys(direct);
    }
    const def = (schema as { _def?: { shape?: () => Record<string, unknown> } })
      ?._def;
    if (def?.shape && typeof def.shape === 'function') {
      return Object.keys(def.shape());
    }
    return [];
  }
}
