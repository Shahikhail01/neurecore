// src/modules/phase8/observability/golden-path-metrics.service.ts
import { Injectable, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsService } from '../../metrics/metrics.service';
import {
  GoldenPathMetrics,
  buildGoldenPathMetrics,
} from './golden-path-metrics';

interface MetricsServiceLike {
  registry: Registry;
  toExpositionFormat(): Promise<string>;
}

@Injectable()
export class GoldenPathMetricsService implements OnModuleInit {
  private metricsInstance: GoldenPathMetrics | null = null;

  constructor(
    @Optional()
    @Inject(MetricsService)
    private readonly metrics?: MetricsServiceLike,
  ) {}

  onModuleInit(): void {
    if (this.metrics) {
      this.metricsInstance = buildGoldenPathMetrics(this.metrics.registry);
    }
  }

  get metrics_(): GoldenPathMetrics {
    if (!this.metricsInstance) {
      this.metricsInstance = buildGoldenPathMetrics(new Registry());
    }
    return this.metricsInstance;
  }

  async toExpositionFormat(): Promise<string> {
    if (!this.metrics) return '';
    return this.metrics.toExpositionFormat();
  }
}
