/**
 * Governance — Module.
 *
 * Reconciles the original governance surface (ADR-009 / Phase 7 Approval
 * Port dependency) with the Phase 2 + Phase 7 governance additions.
 *
 * WHY this file is structured this way:
 *   A Phase 0.5 route-collision fix previously replaced this module with a
 *   minimal version, which silently removed the `GOVERNANCE_EVALUATOR`
 *   provider (via GovernanceRulesService) plus governance's
 *   ApprovalsService / ApprovalScoringService / ApprovalEnrichmentService.
 *   `ApprovalPortService` (and context-plane / work-runtime) inject
 *   `GOVERNANCE_EVALUATOR` at DI time, so the full app failed to boot.
 *
 *   This module restores the original providers + controllers AND keeps the
 *   Phase 2 / Phase 7 governance surface (seed/domains/controls-predefined,
 *   custom-authoring, composition) so nothing regresses.
 *
 * Solid:
 *   • SRP — governance business rules live in the services; this file only
 *     wires providers + controllers.
 *   • DIP — `GOVERNANCE_EVALUATOR` is a port (Symbol) backed by
 *     GovernanceRulesService; consumers depend on the abstraction.
 *   • OCP — new governance controllers/providers register here; no existing
 *     entry is edited.
 */

import { Module } from '@nestjs/common';
import {
  GovernanceRulesController,
  GovernancePoliciesController,
  GovernanceAnomaliesController,
  ApprovalsController,
} from './governance.controller';
import { GovernanceSurfaceController } from './governance-surface.controller';
import { GovernanceService } from './governance.service';
import { GovernanceRulesService } from './services/governance-rules.service';
import { ApprovalsService } from './services/approvals.service';
import { ApprovalScoringService } from './services/approval-scoring.service';
import { ApprovalEnrichmentService } from './services/approval-enrichment.service';
import { GOVERNANCE_EVALUATOR } from './interfaces/governance-evaluator.interface';
import { CustomGovernanceControlService } from './governance-authoring.service';
import { GovernanceCompositionService } from './governance-composition.service';
import { AuditModule } from '@/modules/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [
    // Original governance controllers (Phase 7 Approval Port surface).
    GovernanceRulesController,
    GovernancePoliciesController,
    GovernanceAnomaliesController,
    ApprovalsController,
    // Phase 2 governance application surface.
    GovernanceSurfaceController,
  ],
  providers: [
    GovernanceService,
    GovernanceRulesService,
    ApprovalsService,
    ApprovalScoringService,
    ApprovalEnrichmentService,
    // Phase 7: custom control authoring + composition.
    CustomGovernanceControlService,
    GovernanceCompositionService,
    // ADR-009: expose governance evaluation as a port. GovernanceRulesService
    // stays owned by governance/; consumers depend on the port.
    { provide: GOVERNANCE_EVALUATOR, useExisting: GovernanceRulesService },
  ],
  exports: [
    GovernanceService,
    GovernanceRulesService,
    ApprovalsService,
    ApprovalScoringService,
    ApprovalEnrichmentService,
    CustomGovernanceControlService,
    GovernanceCompositionService,
    GOVERNANCE_EVALUATOR,
  ],
})
export class GovernanceModule {}
