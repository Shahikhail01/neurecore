// src/modules/phase8/phase8.module.ts
import { Global, Module } from '@nestjs/common';
import { Phase8PermissionService } from './application/phase8-permission.service';
import { SideEffectApprovalService } from './application/side-effect-approval.service';
import { ArtifactAccessService } from './application/artifact-access.service';
import { TenantScopeEnforcer } from './application/tenant-scope-enforcer';
import { GoldenPathMetricsService } from './observability/golden-path-metrics.service';

@Global()
@Module({
  providers: [
    Phase8PermissionService,
    SideEffectApprovalService,
    ArtifactAccessService,
    TenantScopeEnforcer,
    GoldenPathMetricsService,
  ],
  exports: [
    Phase8PermissionService,
    SideEffectApprovalService,
    ArtifactAccessService,
    TenantScopeEnforcer,
    GoldenPathMetricsService,
  ],
})
export class Phase8Module {}
