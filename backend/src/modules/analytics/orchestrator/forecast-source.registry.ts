/**
 * Phase 26 — ForecastSourceRegistry.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §7 (P26).
 *
 * SOLID — OCP: a new forecast source (e.g. SubscriptionMRR) =
 * one implementation + one registry key. The orchestrator is
 * untouched.
 *
 * SRP: owns ONLY the source lookup + registration.
 *
 * DIP: the registry depends on the `FORECAST_SOURCE` token —
 * Nest multi-injects every registered source. Consumers depend on
 * the `FORECAST_SOURCE_REGISTRY` token.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  FORECAST_SOURCE,
  FORECAST_SOURCE_REGISTRY,
  type IForecastSource,
} from '../interfaces/IForecastSource';

@Injectable()
export class ForecastSourceRegistry implements OnModuleInit {
  private readonly logger = new Logger(ForecastSourceRegistry.name);
  private readonly sources = new Map<string, IForecastSource>();

  constructor(
    @Inject(FORECAST_SOURCE)
    private readonly injectedSources: ReadonlyArray<IForecastSource>,
  ) {}

  onModuleInit(): void {
    for (const s of this.injectedSources) {
      this.sources.set(s.sourceId, s);
    }
    this.logger.log(
      `ForecastSourceRegistry wired ${this.sources.size} source(s): ${[...this.sources.keys()].join(', ')}`,
    );
  }

  register(source: IForecastSource): void {
    this.sources.set(source.sourceId, source);
  }

  get(sourceId: string): IForecastSource {
    const s = this.sources.get(sourceId);
    if (!s) {
      throw new Error(`forecast source ${sourceId} not registered`);
    }
    return s;
  }

  has(sourceId: string): boolean {
    return this.sources.has(sourceId);
  }

  /** All registered source ids — sorted by `priority` ascending, then sourceId. */
  ordered(): ReadonlyArray<IForecastSource> {
    return [...this.sources.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.sourceId.localeCompare(b.sourceId);
    });
  }
}

export const forecastSourceRegistryProvider = {
  provide: FORECAST_SOURCE_REGISTRY,
  useFactory: (registry: ForecastSourceRegistry) => registry,
  inject: [ForecastSourceRegistry],
};
