// src/modules/phase8/application/tenant-scope-enforcer.ts
import { Injectable } from '@nestjs/common';
import { CROSS_TENANT_NOT_FOUND_MARKER } from '../domain/phase8.constants';

export interface TenantScopeCheckInput {
  actorTenantId: string | null;
  recordTenantId: string;
  entityType: string;
  entityId: string;
}

export interface TenantScopeResult {
  sameTenant: boolean;
  denyReason: 'CROSS_TENANT_NOT_FOUND' | 'MISSING_TENANT_CONTEXT' | null;
}

@Injectable()
export class TenantScopeEnforcer {
  assertSameTenant(input: TenantScopeCheckInput): void {
    const result = this.check(input);
    if (!result.sameTenant) {
      const err: Error & { code?: string } = new Error(
        `${CROSS_TENANT_NOT_FOUND_MARKER} entityType=${input.entityType} entityId=${input.entityId}`,
      );
      err.code = 'X_TENANT_NOT_FOUND';
      throw err;
    }
  }

  check(input: TenantScopeCheckInput): TenantScopeResult {
    if (!input.actorTenantId) {
      return { sameTenant: false, denyReason: 'MISSING_TENANT_CONTEXT' };
    }
    if (input.actorTenantId !== input.recordTenantId) {
      return { sameTenant: false, denyReason: 'CROSS_TENANT_NOT_FOUND' };
    }
    return { sameTenant: true, denyReason: null };
  }
}
