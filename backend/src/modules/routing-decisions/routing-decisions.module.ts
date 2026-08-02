import { Module } from '@nestjs/common';
import { RoutingDecisionsService } from './routing-decisions.service';

/**
 * RoutingDecisionsModule — persists the output of the Phase-2
 * DeterministicIntentClassifier so every classified prompt leaves an
 * auditable record of which rule fired, which canonical capability was
 * selected, and whether the routing was ambiguous.
 *
 * Mirrors DecisionEvaluationsModule / TimelineEventsModule in shape:
 * a single service, exported through the module, backed by PrismaService.
 * No controllers — read access goes through the service layer so that
 * tenant-scoping is enforced uniformly.
 */
@Module({
  providers: [RoutingDecisionsService],
  exports: [RoutingDecisionsService],
})
export class RoutingDecisionsModule {}
