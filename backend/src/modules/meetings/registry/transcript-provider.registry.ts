/**
 * Phase 25 — TranscriptProviderRegistry.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * SOLID — OCP: a 4th live provider = one new
 * `ITranscriptProvider` implementation + one
 * `registry.register(OUTLOOK, provider)` call. The orchestrator
 * (`TranscriptIngestionService`) is untouched.
 *
 * LSP: every registered provider substitutes `ITranscriptProvider`;
 * the orchestrator never special-cases a provider.
 *
 * SRP: owns ONLY the provider→meeting-type lookup. Consent,
 * ingestion, and CRM linkage live in their own services.
 *
 * DIP: providers are DI-injected and registered via
 * `OnModuleInit`. The orchestrator depends on the registry through
 * the `TRANSCRIPT_PROVIDER_REGISTRY` token — not on the providers
 * directly.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MeetingProvider, Prisma } from '@prisma/client';
import {
  TRANSCRIPT_PROVIDER,
  TRANSCRIPT_PROVIDER_REGISTRY,
  type ITranscriptProvider,
} from '../interfaces/ITranscriptProvider';
import { TranscriptProviderUnavailableError } from '../providers/transcript-provider.errors';

@Injectable()
export class TranscriptProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(TranscriptProviderRegistry.name);
  private readonly providers = new Map<MeetingProvider, ITranscriptProvider>();

  constructor(
    @Inject(TRANSCRIPT_PROVIDER)
    private readonly injectedProviders: ReadonlyArray<ITranscriptProvider>,
  ) {}

  onModuleInit(): void {
    for (const p of this.injectedProviders) {
      this.providers.set(p.provider, p);
    }
    this.logger.log(
      `TranscriptProviderRegistry wired ${this.providers.size} provider(s): ${[...this.providers.keys()].join(', ')}`,
    );
  }

  register(provider: ITranscriptProvider): void {
    this.providers.set(provider.provider, provider);
  }

  get(provider: MeetingProvider): ITranscriptProvider {
    const p = this.providers.get(provider);
    if (!p) {
      throw new TranscriptProviderUnavailableError(
        `no transcript provider registered for ${provider}`,
        String(provider),
        'get',
      );
    }
    return p;
  }

  has(provider: MeetingProvider): boolean {
    return this.providers.has(provider);
  }

  /** All registered provider ids — used by integrity guards + dashboards. */
  registered(): ReadonlyArray<MeetingProvider> {
    return [...this.providers.keys()];
  }
}

/** DI provider binding — exports the registry token with a factory that uses Nest's multi-injection. */
export const transcriptProviderRegistryProvider = {
  provide: TRANSCRIPT_PROVIDER_REGISTRY,
  useFactory: (registry: TranscriptProviderRegistry) => registry,
  inject: [TranscriptProviderRegistry],
};

// Re-export the prisma namespace for ergonomic imports — the
// provider registry may need it in future (e.g. consent lookup
// from provider payload). Kept here so the seam is discoverable.
export type { Prisma };
