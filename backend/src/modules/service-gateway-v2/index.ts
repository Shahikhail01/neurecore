/**
 * Service Gateway V2 — Public Exports
 *
 * Phase 0-8 implementation per NC-AWL-IMP-1 and service-gateway-impv2-plan.md
 */

// Core interfaces
export * from './interfaces';

// Ownership manifest
export * from './ownership/capability-ownership-manifest';

// Router
export * from './router/intent-router';
export * from './router/parameter-extractor';
export * from './router/ambiguity-resolver';

// Capabilities
export * from './capabilities/read-capability-registry';
export * from './capabilities/mutation-dispatcher';
export * from './capabilities/agent-skill-builder';

// Recommendations
export * from './recommendations/prediction-recommendation.contracts';

// Channels
export * from './channels/channel-adapters';

// Certification
export * from './certification/tenant-isolation-probe';

// Rollout (Phase 8 — NC-AWL-IMP-1 §11.3)
export * from './rollout/slo-counters';
export * from './rollout/service-gateway-flags';
export * from './rollout/service-gateway-flags.controller';
export * from './rollout/service-gateway-flags.module';
