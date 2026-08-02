/**
 * Architecture test: no `dummy` provider may be exported from the public
 * DI surface of the AnalyticsModule or ServiceGatewayV2Module.
 *
 * Phase 5 replaces the Phase 4 DummyAnalyticsProvider and the
 * StubPredictionProvider / StubRecommendationProvider with real
 * Prisma-backed, abstain-aware implementations. This test is the
 * regression guard.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ANALYTICS_MODULE = join(__dirname, 'analytics.module.ts');
const SERVICE_GATEWAY_V2_MODULE = join(
  __dirname,
  '..',
  'service-gateway-v2',
  'service-gateway-v2.module.ts',
);
const PROVIDERS_DIR = join(__dirname, 'providers');

describe('Analytics architecture', () => {
  it('does not export DummyAnalyticsProvider from the providers directory', () => {
    const files = readdirSync(PROVIDERS_DIR);
    for (const f of files) {
      expect(f.toLowerCase()).not.toMatch(/dummy/);
    }
  });

  it('does not reference DummyAnalyticsProvider in the analytics module', () => {
    const content = readFileSync(ANALYTICS_MODULE, 'utf-8');
    // Strip comments first so a docstring mention of the old class
    // doesn't trip the guard. We only care about real code references.
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/DummyAnalyticsProvider/);
  });

  it('does not reference Stub providers anywhere in the public DI surface', () => {
    const analyticsContent = readFileSync(ANALYTICS_MODULE, 'utf-8');
    const gatewayContent = readFileSync(SERVICE_GATEWAY_V2_MODULE, 'utf-8');
    const strip = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(strip(analyticsContent)).not.toMatch(/StubPredictionProvider/);
    expect(strip(analyticsContent)).not.toMatch(/StubRecommendationProvider/);
    expect(strip(gatewayContent)).not.toMatch(/StubPredictionProvider/);
    expect(strip(gatewayContent)).not.toMatch(/StubRecommendationProvider/);
  });

  it('binds concrete PREDICTION_PROVIDER and RECOMMENDATION_PROVIDER in ServiceGatewayV2Module', () => {
    const content = readFileSync(SERVICE_GATEWAY_V2_MODULE, 'utf-8');
    expect(content).toMatch(/PREDICTION_PROVIDER/);
    expect(content).toMatch(/RECOMMENDATION_PROVIDER/);
    expect(content).toMatch(/PredictionProvider/);
    expect(content).toMatch(/RecommendationProvider/);
  });
});
