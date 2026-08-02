/**
 * IndustriesModule — wires the Industry pool.
 *
 * Phase 10 — Admin Business Composition.
 * INDUSTRY-GROUPS-CONCEPT.md Phase 2: also exposes IndustryGroupsService +
 * the public /api/v1/industries/groups + /capabilities endpoints.
 *
 * Stage 2 Phase 2B: exposes IndustryCustomerFieldsService for dynamic
 * customer field definitions per industry.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6 (R3) — exports 5 industry
 * provider symbols (INDUSTRY_METADATA, INDUSTRY_NAV, INDUSTRY_CUSTOMER_FIELD,
 * INDUSTRY_APPROVAL_ADDONS, INDUSTRY_WIDGETS) so downstream modules depend
 * on narrow interfaces, not on PrismaService.
 */

import { Module } from '@nestjs/common';
import { IndustriesController } from './industries.controller';
import { IndustriesService } from './industries.service';
import { IndustryGroupsService } from './industry-groups.service';
import { IndustryCustomerFieldsService } from './customer-fields/industry-customer-fields.service';
import {
  INDUSTRY_METADATA,
  INDUSTRY_NAV,
  INDUSTRY_CUSTOMER_FIELD,
  INDUSTRY_APPROVAL_ADDONS,
  INDUSTRY_WIDGETS,
} from './interfaces';
import { INDUSTRY_APPROVAL_ADDONS_PROVIDER, IndustryApprovalAddonBridge } from './providers/industry-approval-addon-bridge';
import { IndustryNavProviderImpl } from './providers/industry-nav.provider';
import { IndustryCustomerFieldProviderImpl } from './providers/industry-customer-field.provider';
import { IndustryWidgetProviderImpl } from './providers/industry-widget.provider';
import { ApprovalChainsModule } from '../approval-chains/approval-chains.module';
import { WidgetsModule } from '../widgets/widgets.module';

@Module({
  // Phase 5.B R3 binding fix (2026-08-01): several industry providers inject
  // services from sibling modules that were never wired into
  // IndustriesModule.imports — a latent bug masked by a stale dist that
  // never had these providers compiled in.
  //   - IndustryApprovalAddonBridge → ApprovalAddonRegistry (approval-chains/)
  //   - IndustryWidgetProviderImpl  → WidgetRegistry       (widgets/)
  imports: [ApprovalChainsModule, WidgetsModule],
  controllers: [IndustriesController],
  providers: [
    IndustriesService,
    IndustryGroupsService,
    IndustryCustomerFieldsService,

    // ─── R3 (PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.3.6) ───
    { provide: INDUSTRY_METADATA, useExisting: IndustriesService },
    { provide: INDUSTRY_NAV, useClass: IndustryNavProviderImpl },
    {
      provide: INDUSTRY_CUSTOMER_FIELD,
      useClass: IndustryCustomerFieldProviderImpl,
    },
    { provide: INDUSTRY_APPROVAL_ADDONS, useClass: IndustryApprovalAddonBridge },
    { provide: INDUSTRY_WIDGETS, useClass: IndustryWidgetProviderImpl },
  ],
  exports: [
    IndustriesService,
    IndustryGroupsService,
    IndustryCustomerFieldsService,
    INDUSTRY_METADATA,
    INDUSTRY_NAV,
    INDUSTRY_CUSTOMER_FIELD,
    INDUSTRY_APPROVAL_ADDONS,
    INDUSTRY_WIDGETS,
  ],
})
export class IndustriesModule {}
