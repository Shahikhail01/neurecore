/**
 * Phase 14 — KillSwitchTenantScope guard.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-13-14.md §2 + §6.
 *
 * Wraps the existing KillSwitchService with an explicit
 * `assertTenantContext` rejection of wildcard / empty tenantIds.
 * Per CR-AI-1207 (kill switches at every level), the kill switch
 * surface MUST refuse to render for unknown tenants — otherwise
 * a malicious dashboard query can read all tenants' kill states.
 *
 * SRP — owns ONLY the tenant-scope assertion + thin wrapper.
 * Persistence lives in KillSwitchService.
 */

import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { KillSwitchService } from './kill-switch.service';
import type {
  KillSwitchListResponseDto,
} from '../dto/kill-switch.dto';

export class KillSwitchTenantScopeError extends ForbiddenException {}

@Injectable()
export class KillSwitchTenantScopeService {
  constructor(private readonly inner: KillSwitchService) {}

  private assertScope(tenantId: string, op: string): void {
    if (!tenantId || tenantId === '*') {
      throw new KillSwitchTenantScopeError(
        `tenantId required for ${op}; wildcard or empty forbidden`,
      );
    }
  }

  async list(tenantId: string): Promise<KillSwitchListResponseDto> {
    this.assertScope(tenantId, 'list');
    return this.inner.list(tenantId);
  }

  async set(tenantId: string, actor: unknown, dto: unknown): Promise<unknown> {
    this.assertScope(tenantId, 'set');
    // Cast through unknown: the underlying service has the precise
    // type signature; the wrapper accepts the full DTO shape.
    return (this.inner.set as (t: string, a: unknown, d: unknown) => Promise<unknown>)(
      tenantId,
      actor,
      dto,
    );
  }
}
