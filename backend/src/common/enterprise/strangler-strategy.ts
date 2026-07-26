// src/common/enterprise/strangler-strategy.ts
export type ExecutionEngine = 'legacy' | 'canonical';

export interface IsolationStrategy {
  executionEngineVersion: ExecutionEngine;
  ownershipMarker: string;
  telemetryTag: string;
}

export interface EngineRoutingDecision {
  engine: ExecutionEngine;
  reason: string;
  aggregateOwner?: ExecutionEngine;
}

export const STRANGLER_CONFIG = {
  isolationMechanism: 'persisted_execution_engine_version' as const,

  getRoute(entity: {
    id: string;
    executionEngineVersion?: string;
  }): EngineRoutingDecision {
    if (!entity.executionEngineVersion) {
      return { engine: 'legacy', reason: 'no engine version persisted' };
    }
    if (entity.executionEngineVersion === 'canonical') {
      return {
        engine: 'canonical',
        reason: 'aggregate owned by canonical engine',
        aggregateOwner: 'canonical',
      };
    }
    return {
      engine: 'legacy',
      reason: 'aggregate owned by legacy engine',
      aggregateOwner: 'legacy',
    };
  },

  determineOwnership(
    tenantFlag: { canonical: boolean },
    aggregateEngine?: string,
  ): EngineRoutingDecision {
    if (aggregateEngine === 'canonical' && !tenantFlag.canonical) {
      throw new Error('CANONICAL_AGGREGATE_ROUTE_DISABLED');
    }
    if (aggregateEngine === 'legacy' && tenantFlag.canonical) {
      throw new Error('LEGACY_AGGREGATE_REQUIRES_MIGRATION');
    }
    if (aggregateEngine === 'canonical') {
      return {
        engine: 'canonical',
        reason: 'aggregate is canonical',
        aggregateOwner: 'canonical',
      };
    }
    return {
      engine: tenantFlag.canonical ? 'canonical' : 'legacy',
      reason: tenantFlag.canonical ? 'tenant flag enabled' : 'tenant flag disabled',
    };
  },
};
