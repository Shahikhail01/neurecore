/**
 * Service Gateway V2 Module — Phase 0-3
 *
 * Extends the proven read-only service-gateway foundation into a governed
 * enterprise AI operating layer.
 *
 * Architecture:
 * - Read capabilities via ReadCapabilityRegistry
 * - Deterministic routing via IntentRuleRegistry + DeterministicIntentClassifier
 * - Mutations via MutationDispatcher → WorkRuntime
 * - Channel adapters via IChannelReceiver/IChannelSender
 * - Recommendations via IRecommendationProvider
 * - Predictions via IPredictionProvider
 */

import { Module, OnModuleInit, Logger, forwardRef } from '@nestjs/common';
import { ReadCapabilityRegistry } from './capabilities/read-capability-registry';
import { SafeProjector } from './capabilities/safe-projector';
import { MutationDispatcher } from './capabilities/mutation-dispatcher';
import {
  IntentRuleRegistry,
  DeterministicIntentClassifier,
} from './router/intent-router';
import { TypedParameterExtractor } from './router/parameter-extractor';
import { AmbiguityResolver } from './router/ambiguity-resolver';
import { ClassifierService } from './router/classifier.service';
import { RoutingService } from './router/routing.service';
import { WorkRuntimeModule } from '../work-runtime/work-runtime.module';
import { RoutingDecisionsModule } from '../routing-decisions/routing-decisions.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MicrosoftGraphModule } from '../integrations/microsoft/microsoft-graph.module';
import { ChatModule } from '../chat/chat.module';
import { EventsModule } from '../events/events.module';
import {
  READ_CAPABILITY_REGISTRY,
  MUTATION_DISPATCHER,
  PREDICTION_PROVIDER,
  RECOMMENDATION_PROVIDER,
} from './interfaces';
import {
  PredictionProvider,
  RecommendationProvider,
} from './recommendations/prediction-recommendation.providers';
import {
  BrevoSender,
  CalendarReceiver,
  CalendarSender,
  CrmReceiver,
  EmailReceiver,
  EmailSender,
  TeamsSender,
  WebChatReceiver,
  WebChatSender,
} from './channels/channel-adapters';

@Module({
  imports: [
    WorkRuntimeModule,
    RoutingDecisionsModule,
    AnalyticsModule,
    IntegrationsModule,
    MicrosoftGraphModule,
    forwardRef(() => ChatModule),
    EventsModule,
  ],
  providers: [
    ReadCapabilityRegistry,
    { provide: READ_CAPABILITY_REGISTRY, useExisting: ReadCapabilityRegistry },
    MutationDispatcher,
    { provide: MUTATION_DISPATCHER, useExisting: MutationDispatcher },
    IntentRuleRegistry,
    DeterministicIntentClassifier,
    TypedParameterExtractor,
    AmbiguityResolver,
    SafeProjector,
    ClassifierService,
    RoutingService,
    PredictionProvider,
    { provide: PREDICTION_PROVIDER, useExisting: PredictionProvider },
    RecommendationProvider,
    { provide: RECOMMENDATION_PROVIDER, useExisting: RecommendationProvider },
    WebChatReceiver,
    WebChatSender,
    EmailReceiver,
    EmailSender,
    CalendarReceiver,
    CalendarSender,
    CrmReceiver,
    BrevoSender,
    TeamsSender,
  ],
  exports: [
    ReadCapabilityRegistry,
    MutationDispatcher,
    IntentRuleRegistry,
    DeterministicIntentClassifier,
    TypedParameterExtractor,
    AmbiguityResolver,
    SafeProjector,
    ClassifierService,
    RoutingService,
    PREDICTION_PROVIDER,
    RECOMMENDATION_PROVIDER,
    WebChatReceiver,
    WebChatSender,
    EmailReceiver,
    EmailSender,
    CalendarReceiver,
    CalendarSender,
    CrmReceiver,
    BrevoSender,
    TeamsSender,
  ],
})
export class ServiceGatewayV2Module implements OnModuleInit {
  private readonly logger = new Logger(ServiceGatewayV2Module.name);

  constructor(
    private readonly intentRuleRegistry: IntentRuleRegistry,
    private readonly readCapabilityRegistry: ReadCapabilityRegistry,
  ) {}

  /**
   * OnModuleInit bootstrap:
   * 1. Seed the intent-rule registry with one deterministic READ rule per
   *    active read capability (`registerBuiltInRules()`).
   * 2. Log a summary of how many rules + how many capabilities are loaded
   *    so operators can spot module wiring bugs at boot.
   *
   * Construction is left to Nest's injection; `registerBuiltInRules()` is
   * idempotent so accidental double-runs (e.g. in a test harness) are
   * safe.
   */
  onModuleInit(): void {
    const intentRules = this.intentRuleRegistry.registerBuiltInRules();
    const capabilityCount = this.readCapabilityRegistry.getCount();
    this.logger.log(
      `ServiceGatewayV2 bootstrap: ${intentRules.length} intent rules, ${capabilityCount} read capabilities`,
    );
  }
}
