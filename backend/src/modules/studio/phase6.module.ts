/**
 * Phase 6 — Studio Codegen + Marketplace publish + Scheduler + SLA + Service Ops.
 *
 * Source plan: §5.13.6/7/8/10/11/17, §5.14.1/4/5, §5.9.5/6/7, §5.10.2.
 *
 * Solid:
 *   • SRP — controllers compose; services own their business rules.
 *   • All Phase 6 entry points refuse the wildcard tenant id.
 */

import { Module } from '@nestjs/common';
import { StudioCodegenService } from './studio-codegen.service';
import { ComponentPublishService } from './component-publish.service';
import { SchedulerRunner } from './scheduler-runner';
import { SlaTimerService } from '../sla/sla-timer.service';
import {
  LandingPageService,
  FieldWorkOrderService,
  RootCauseAnalysisService,
} from '../service-ops/service-ops.service';
import { StudioDashboardService } from './studio-dashboard.service';
import { StudioRuntimeController } from './phase6.controller';
import { LocalizationModule } from '../localization/localization.module';

@Module({
  imports: [LocalizationModule],
  controllers: [StudioRuntimeController],
  providers: [
    StudioCodegenService,
    ComponentPublishService,
    SchedulerRunner,
    SlaTimerService,
    LandingPageService,
    FieldWorkOrderService,
    RootCauseAnalysisService,
    StudioDashboardService,
  ],
  exports: [
    StudioCodegenService,
    ComponentPublishService,
    SchedulerRunner,
    SlaTimerService,
    LandingPageService,
    FieldWorkOrderService,
    RootCauseAnalysisService,
    StudioDashboardService,
  ],
})
export class Phase6Module {}
