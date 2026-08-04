/**
 * Phase 7 — Service Ops 360 + Governance Authoring + XAI.
 *
 * Source plan: §5.9.1/2/3/4/8, §5.10.1/4/5, §5.11.3/4/5, §5.13.13/16,
 *              §5.14.3/8/9/12, §5.4.17.
 *
 * Solid:
 *   • Module is `@Global` so chat / hermes / agents can inject the
 *     service ops services without re-importing.
 *   • All Phase 7 entry points refuse the wildcard tenant id.
 */

import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { CustomerTouchpointService } from './service-ops-360.service';
import { CaseTriageService } from './service-ops-360.service';
import { RealTimeGuidanceService } from './service-ops-360.service';
import { ChatbotPersonaService } from './service-ops-360.service';
import { KnowledgeGapService } from './service-ops-360.service';
import { QuoteService } from './service-ops-360.service';
import { FieldSalesAssignmentService } from './service-ops-360.service';
import { SalesLeadRoutingService } from './service-ops-360.service';
import { EventService } from './service-ops-360.service';
import { PartnerService } from './service-ops-360.service';
import { CustomerIntentService } from './service-ops-360.service';
import { CustomGovernanceControlService } from '../governance/governance-authoring.service';
import { OperationalGovernanceService } from '../governance/governance-authoring.service';
import { SecurityGovernanceService } from '../governance/governance-authoring.service';
import { InternalComplianceService } from '../governance/governance-authoring.service';
import { GovernanceCompositionService } from '../governance/governance-composition.service';
import { XaiService } from '../xai/xai.service';
import { Phase7Controller } from './phase7.controller';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [Phase7Controller],
  providers: [
    CustomerTouchpointService,
    CaseTriageService,
    RealTimeGuidanceService,
    ChatbotPersonaService,
    KnowledgeGapService,
    QuoteService,
    FieldSalesAssignmentService,
    SalesLeadRoutingService,
    EventService,
    PartnerService,
    CustomerIntentService,
    CustomGovernanceControlService,
    OperationalGovernanceService,
    SecurityGovernanceService,
    InternalComplianceService,
    GovernanceCompositionService,
    XaiService,
  ],
  exports: [
    CustomerTouchpointService,
    CaseTriageService,
    RealTimeGuidanceService,
    ChatbotPersonaService,
    KnowledgeGapService,
    QuoteService,
    FieldSalesAssignmentService,
    SalesLeadRoutingService,
    EventService,
    PartnerService,
    CustomerIntentService,
    CustomGovernanceControlService,
    OperationalGovernanceService,
    SecurityGovernanceService,
    InternalComplianceService,
    GovernanceCompositionService,
    XaiService,
  ],
})
export class Phase7Module {}
