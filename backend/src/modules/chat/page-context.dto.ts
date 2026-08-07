/**
 * Phase 15 — PageContext DTO.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE_15_18.md §4.
 *
 * Closes CR-AI-0002: the assistant now sees a typed, server-side
 * re-authorised representation of the page the actor is on. The FE
 * never claims authority — every PageContext field is verified by
 * the PageContextGateway (the canonical owner).
 *
 * SRP — owns ONLY the typed-shape declaration + Zod-style validator.
 * Re-authorization is the gateway's job (page-context.gateway.ts).
 *
 * SECURITY: the FE renders the chip purely from the gateway's
 * response. Anything not in this DTO is dropped at the boundary.
 */

import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import type { TenantContext } from '../../common/context/tenant-context';

/**
 * Pages the assistant knows how to anchor against. Adding a new
 * entityType means extending the gateway's allow-list — never
 * widening the FE's claim surface.
 */
export const SUPPORTED_ENTITY_TYPES = [
  'customer',
  'project',
  'deal',
  'quote',
  'task',
  'knowledgeEntry',
  'thread',
  'dashboard',
  'campaign',
  'case',
] as const;

export type PageEntityType = (typeof SUPPORTED_ENTITY_TYPES)[number];

export interface PageContextField {
  readonly name: string;
  readonly value: string;
}

export interface PageContextShape {
  readonly entityType: PageEntityType;
  readonly entityId: string;
  readonly fields?: ReadonlyArray<PageContextField>;
  readonly locale?: string;
  readonly timezone?: string;
  readonly allowedActions?: ReadonlyArray<string>;
}

export class PageContextDto implements PageContextShape {
  @IsString()
  @IsIn(SUPPORTED_ENTITY_TYPES as unknown as string[])
  entityType!: PageEntityType;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsArray()
  fields?: PageContextField[];

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedActions?: string[];
}

/**
 * Narrow type guard — moves a `Record<string, unknown>` through the
 * validator into a typed `PageContextShape` or returns null.
 *
 * Used by the gateway. Throws nothing — null means "no usable page
 * context", which the chat dispatcher treats as no page context.
 */
export function asPageContextShape(
  input: unknown,
): PageContextShape | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Record<string, unknown>;
  if (typeof i['entityType'] !== 'string') return null;
  if (typeof i['entityId'] !== 'string') return null;
  // Tight allow-list — unknown entityType is dropped, not coerced.
  const entityType = i['entityType'] as string;
  if (!SUPPORTED_ENTITY_TYPES.includes(entityType as PageEntityType)) {
    return null;
  }
  return {
    entityType: entityType as PageEntityType,
    entityId: i['entityId'],
    fields: Array.isArray(i['fields'])
      ? (i['fields'] as PageContextField[])
      : undefined,
    locale: typeof i['locale'] === 'string' ? i['locale'] : undefined,
    timezone: typeof i['timezone'] === 'string' ? i['timezone'] : undefined,
    allowedActions: Array.isArray(i['allowedActions'])
      ? (i['allowedActions'] as string[])
      : undefined,
  };
}

/**
 * Throw-safe validator used by the gateway when the FE posts a
 * PageContext as raw JSON. Returns null on any structural problem;
 * callers MUST treat null as "page context unavailable" (per
 * CR-AI-0002 — never trust the client).
 */
export function validatePageContext(input: unknown): PageContextShape | null {
  return asPageContextShape(input);
}

/**
 * Re-export for downstream callers.
 */
export type { TenantContext };
