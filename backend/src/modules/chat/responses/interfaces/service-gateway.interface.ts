import type { z } from 'zod';

/**
 * Adapter call shape: each capability carries its own strict paramsSchema
 * (the LLM sees only the fields it must provide) and an adapter that calls
 * the resolved service with the right positional/typed args. This is
 * necessary because NestJS service methods have varied signatures
 * (e.g. `findAll(tenantId, options)`, `findById(id, tenantId)`,
 * `getSummary()`). A single `(tenantId, paramsObject)` gateway signature
 * would silently mis-route.
 *
 * The `params` argument inside the adapter is typed as `unknown` because
 * `z.ZodType<P>` does not propagate the inferred shape through the type
 * parameter. Adapters therefore cast `params` to the concrete input type
 * expected by the service method (e.g. `params as ListProjectsOptions`).
 * The gateway's runtime `safeParse` already validated `params` against
 * `cap.paramsSchema` before the adapter runs, so the cast is safe.
 */
export interface IServiceCapability<R = unknown> {
  capability: string;
  /**
   * DI lookup token for the service class. **Must be the class itself**
   * (e.g. `ProjectsService`), NOT a string class-name like
   * `'ProjectsService'`. Nest's `ModuleRef.get(token)` resolves only by
   * class identity (or registered string/symbol DI token), so a plain
   * string never matches. See service-gateway.tool.ts `executeImpl`.
   */
  serviceToken: unknown;
  paramsSchema: z.ZodTypeAny;
  adapter: (service: unknown, tenantId: string, params: unknown) => Promise<R>;
  readOnly: true;
  description: string;
}

export type CapabilityMap = Record<string, IServiceCapability>;
