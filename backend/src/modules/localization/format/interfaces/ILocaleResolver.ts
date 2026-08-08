/**
 * Phase 29 — Locale resolution contract (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * SOLID
 *   ISP — one method. A formatter never sees this contract; only the
 *         policy service does.
 *   DIP — `LocaleFormatPolicyService` depends on this abstraction, so
 *         it is unit-testable with no Prisma, no tenant row and no
 *         user row, and a future per-request resolver can substitute
 *         the tenant one without touching the policy.
 */

import type { LocaleFormatContext } from './ILocaleFormatter';

export interface LocaleResolutionRequest {
  readonly tenantId: string;
  readonly userId?: string;
  /** Raw `Accept-Language` header, when the caller has one. */
  readonly acceptLanguage?: string;
  /** Explicit override that wins over tenant and user preference. */
  readonly localeOverride?: string;
  /** IANA time zone override (e.g. from the browser). */
  readonly timeZoneOverride?: string;
}

export interface ILocaleResolver {
  resolve(request: LocaleResolutionRequest): Promise<LocaleFormatContext>;
}
