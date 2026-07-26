// src/common/correlation/correlation.interface.ts
export interface CommandMetadata {
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  occurredAt: string;
  schemaVersion: number;
}

export interface CorrelationContext {
  correlationId: string;
  causationId: string | null;
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
}
