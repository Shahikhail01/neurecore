/**
 * Phase 29 — Locale format policy (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * The single entry point every backend surface uses to render a value
 * for a human. It resolves the locale once, then delegates to the
 * registered formatter for the requested kind — so a screen can never
 * re-introduce a hard-coded `en-US`, a server-zone timestamp, or a
 * USD-only currency symbol.
 *
 * SOLID
 *   SRP — owns ONLY the compose step (resolve → format).
 *   OCP — new kinds arrive through the registry; this class never
 *         gains a branch.
 *   ISP — depends on two one-method contracts.
 *   DIP — both collaborators are injected through DI tokens.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  LOCALE_FORMATTER_REGISTRY,
  LOCALE_RESOLVER,
  type LocaleFormatContext,
  type LocaleFormatKind,
  type LocaleFormatValue,
} from './interfaces/ILocaleFormatter';
import type {
  ILocaleResolver,
  LocaleResolutionRequest,
} from './interfaces/ILocaleResolver';
import type { LocaleFormatterRegistry } from './locale-formatter.registry';

@Injectable()
export class LocaleFormatPolicyService {
  constructor(
    @Inject(LOCALE_RESOLVER) private readonly resolver: ILocaleResolver,
    @Inject(LOCALE_FORMATTER_REGISTRY)
    private readonly registry: LocaleFormatterRegistry,
  ) {}

  /** Resolve the formatting context once, then reuse it for a page. */
  async contextFor(
    request: LocaleResolutionRequest,
  ): Promise<LocaleFormatContext> {
    return this.resolver.resolve(request);
  }

  /** Resolve + format a single value. */
  async format(
    kind: LocaleFormatKind,
    value: LocaleFormatValue,
    request: LocaleResolutionRequest,
  ): Promise<string> {
    const context = await this.contextFor(request);
    return this.formatWith(kind, value, context);
  }

  /** Format with an already-resolved context — no IO, fully sync. */
  formatWith(
    kind: LocaleFormatKind,
    value: LocaleFormatValue,
    context: LocaleFormatContext,
  ): string {
    return this.registry.get(kind).format(value, context);
  }

  /** Kinds this policy can render — drives the FE capability probe. */
  supportedKinds(): ReadonlyArray<LocaleFormatKind> {
    return this.registry.kinds();
  }
}
