import { Module, Global } from '@nestjs/common';
import { HermesRegistryService } from './services/hermes-registry.service';
import { ToolGatewayService } from './services/tool-gateway.service';
import { HermesSessionService } from './services/hermes-session.service';
import { HermesMemoryService } from './services/hermes-memory.service';
import { HermesContextService } from './services/hermes-context.service';
import { HermesTenantGuard } from './guards/hermes-tenant.guard';
import { ApprovalWorkflowEngine } from './services/approval-workflow.engine';
import { ThreadService } from './services/thread.service';
import { THREAD_SERVICE } from './interfaces/IThreadService';
import { HERMES_EVENT_BUS } from './interfaces/hermes-event-bus.interface';
import { ACTIVITY_SERVICE } from './interfaces/IActivityService';
import { AGENT_MESSAGING_GUARD } from './interfaces/IAgentMessagingGuard';
import { PARTICIPANT_RESOLVER } from './interfaces/IParticipantResolver';
import { ActivityService } from './services/activity.service';
import { HermesActivityBusService } from './services/hermes-activity-bus.service';
import { ParticipantResolver } from './services/participant-resolver.service';
import { AgentMessagingService } from './services/agent-messaging.service';
import { AgentMessagingGuard } from './services/agent-messaging.guard';
import { PresenceService } from './services/presence.service';
import { ConversationIntelligenceService } from './services/conversation-intelligence.service';
import { EntityGraphService } from './services/entity-graph.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { ThreadSummarizationService } from './services/thread-summarization.service';
import { DigestService } from './services/digest.service';
import { EntityHealthRollupService } from './services/entity-health-rollup.service';
import { CostCenterService } from './services/cost-center.service';
import { RiskDetectionService } from './services/risk-detection.service';
import { EscalationService } from './services/escalation.service';
import { FollowUpService } from './services/follow-up.service';
import { WorkflowTemplateService } from './services/workflow-template.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { RetentionJobService } from './services/retention-job.service';
import { ExplainabilityController } from './controllers/explainability.controller';
import { ComplianceController } from './controllers/compliance.controller';
import { ToolsModule } from '../tools/tools.module';
import { AgentsModule } from '../agents/agents.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModelsModule } from '../models/models.module';
import { MissionFeedModule } from '../mission-feed/mission-feed.module';
import { EventsModule } from '../events/events.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Global()
@Module({
  imports: [
    ToolsModule,
    AgentsModule,
    KnowledgeModule,
    NotificationsModule,
    ModelsModule,
    MissionFeedModule,
    EventsModule,
    ApprovalsModule,
  ],
  controllers: [ExplainabilityController, ComplianceController],
  providers: [
    HermesRegistryService,
    ToolGatewayService,
    HermesSessionService,
    HermesMemoryService,
    HermesContextService,
    HermesTenantGuard,
    ApprovalWorkflowEngine,
    ThreadService,
    { provide: THREAD_SERVICE, useExisting: ThreadService },
    { provide: HERMES_EVENT_BUS, useExisting: HermesActivityBusService },
    { provide: ACTIVITY_SERVICE, useExisting: ActivityService },
    { provide: AGENT_MESSAGING_GUARD, useExisting: AgentMessagingGuard },
    { provide: PARTICIPANT_RESOLVER, useExisting: ParticipantResolver },
    ActivityService,
    HermesActivityBusService,
    ParticipantResolver,
    AgentMessagingService,
    AgentMessagingGuard,
    PresenceService,
    ConversationIntelligenceService,
    EntityGraphService,
    DependencyGraphService,
    ThreadSummarizationService,
    DigestService,
    EntityHealthRollupService,
    CostCenterService,
    RiskDetectionService,
    EscalationService,
    FollowUpService,
    WorkflowTemplateService,
    NotificationPreferenceService,
    RetentionJobService,
  ],
  exports: [
    HermesRegistryService,
    ToolGatewayService,
    HermesSessionService,
    HermesMemoryService,
    HermesContextService,
    HermesTenantGuard,
    ApprovalWorkflowEngine,
    ThreadService,
    ActivityService,
    HermesActivityBusService,
    ParticipantResolver,
    AgentMessagingService,
    AgentMessagingGuard,
    PresenceService,
    ConversationIntelligenceService,
    EntityGraphService,
    DependencyGraphService,
    ThreadSummarizationService,
    DigestService,
    EntityHealthRollupService,
    CostCenterService,
    RiskDetectionService,
    EscalationService,
    FollowUpService,
    WorkflowTemplateService,
    NotificationPreferenceService,
    RetentionJobService,
  ],
})
export class HermesModule {}
