// src/common/ports/audit.port.ts
import { AUDIT_REPOSITORY } from './di-tokens';

export { AUDIT_REPOSITORY };

export interface AuditEntry {
  tenantId: string;
  actor: string;
  action: string;
  resource: string;
  resourceId: string;
  correlationId?: string;
  causationId?: string;
  result?: 'success' | 'failure';
  details?: Record<string, unknown>;
}

export type TransactionalClient = any;

export interface IAuditRepository {
  record(entry: AuditEntry, tx?: TransactionalClient): Promise<void>;
}
