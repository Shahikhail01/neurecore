/**
 * Phase 30 — Cost ceiling tenant-scope guardrail (CR-AI-1305).
 *
 * Mirrors `KillSwitchTenantScopeService` (Phase 14): the admin
 * surface must refuse to read or write ceilings for an unknown or
 * wildcard tenant, otherwise a crafted dashboard query could read or
 * lift another tenant's containment controls.
 *
 * SOLID
 *   SRP — owns ONLY the tenant assertion + a thin pass-through.
 *   DIP — wraps the injected service; it holds no policy of its own.
 */

import { Injectable } from '@nestjs/common';
import { CostCeilingScopeError } from './cost-ceiling.errors';
import { CostCeilingService, type CeilingStatus } from './cost-ceiling.service';
import {
  TenantCostCeilingRepository,
  type SetCeilingInput,
} from './config/tenant-cost-ceiling.repository';
import type { CeilingConfig } from './interfaces/ICeilingRule';

@Injectable()
export class CostCeilingTenantScopeService {
  constructor(
    private readonly service: CostCeilingService,
    private readonly repository: TenantCostCeilingRepository,
  ) {}

  async status(tenantId: string): Promise<CeilingStatus> {
    this.assertScope(tenantId, 'status');
    return this.service.status(tenantId);
  }

  async list(tenantId: string): Promise<ReadonlyArray<CeilingConfig>> {
    this.assertScope(tenantId, 'list');
    return this.repository.list(tenantId);
  }

  async set(input: SetCeilingInput): Promise<CeilingConfig> {
    this.assertScope(input.tenantId, 'set');
    return this.repository.set(input);
  }

  private assertScope(tenantId: string, operation: string): void {
    if (!tenantId || tenantId === '*') {
      throw new CostCeilingScopeError(operation);
    }
  }
}
