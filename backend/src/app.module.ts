import {
  Module,
  MiddlewareConsumer,
  NestModule,
  OnApplicationBootstrap,
  RequestMethod,
} from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigurationModule } from './config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { CommandIdempotencyModule } from './common/idempotency/command-idempotency.module';
import { PersistenceModule } from './common/persistence/persistence.module';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { ServiceIdentitiesModule } from './modules/service-identities/service-identities.module';
import { TimelineEventsModule } from './modules/timeline-events/timeline-events.module';
import { DecisionEvaluationsModule } from './modules/decision-evaluations/decision-evaluations.module';
import { SimulationsModule } from './simulations/simulations.module';
import { SimulationVisibilityModule } from './common/simulation/simulation-visibility.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { EnterpriseEventsModule } from './modules/enterprise-events/enterprise-events.module';
import { ContextPlaneModule } from './modules/context-plane/context-plane.module';
import { WorkRuntimeModule } from './modules/work-runtime/work-runtime.module';
import { EnterpriseCognitionModule } from './modules/enterprise-cognition/enterprise-cognition.module';
import { EnterpriseAutonomyModule } from './modules/enterprise-autonomy/enterprise-autonomy.module';
import { EnterpriseOperatingSystemModule } from './modules/enterprise-operating-system/enterprise-operating-system.module';
import { PlatformOperationsModule } from './modules/platform-operations/platform-operations.module';
import { Phase8Module } from './modules/phase8/phase8.module';
import { EnterpriseIntelligenceNetworkModule } from './modules/enterprise-intelligence-network/enterprise-intelligence-network.module';
import { PlatformSDKModule } from './modules/platform-sdk/platform-sdk.module';
import { CloudPlatformModule } from './modules/cloud-platform/cloud-platform.module';
import { ApplicationFrameworkModule } from './modules/application-framework/application-framework.module';
import { EnterpriseAIGovernanceModule } from './modules/enterprise-ai-governance/ai-governance.module';
import { PlatformEvolutionModule } from './modules/platform-evolution/platform-evolution.module';
import { AgentsModule } from './modules/agents/agents.module';
import { MemoryModule } from './modules/memory/memory.module';
import { ToolsModule } from './modules/tools/tools.module';
import { OrchestrationModule } from './modules/orchestration/orchestration.module';
// Phase 3
import { GovernanceModule } from './modules/governance/governance.module';
import { ApprovalPortModule } from './modules/approval-port/approval-port.module';
import { HermesModule } from './modules/hermes/hermes.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { OutboxWorker } from './common/outbox/outbox.worker';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DepartmentTemplatesModule } from './modules/department-templates/department-templates.module';
import { ModelsModule } from './modules/models/models.module';
import { AIGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuditModule } from './modules/audit/audit.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ReliabilityModule } from './modules/reliability/reliability.module';
import { AgentTemplatesModule } from './modules/agent-templates/agent-templates.module';
import { RoutinesModule } from './modules/routines/routines.module';
import { CostsModule } from './modules/costs/costs.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { GoalsModule } from './modules/goals/goals.module';
import { SecurityModule } from './modules/security/security.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProjectStagesModule } from './modules/project-stages/project-stages.module';
import { ProjectMembersModule } from './modules/project-members/project-members.module';
import { ProjectTypesModule } from './modules/project-types/project-types.module';
import { DeliverablesModule } from './modules/deliverables/deliverables.module';
import { ExecutionLogModule } from './modules/execution-log/execution-log.module';
import { ApprovalChainsModule } from './modules/approval-chains/approval-chains.module';
// Phase 5 — Project Memory + Decision Registry
import { ProjectMemoryModule } from './modules/project-memory/project-memory.module';
import { ProjectDecisionsModule } from './modules/project-decisions/project-decisions.module';
// Phase 3A — Project Automation (AI workforce orchestration)
import { ProjectAutomationModule } from './modules/project-automation/project-automation.module';
// Phase 3B — Project Event Bus + continuous automation
import { ProjectEventsModule } from './modules/project-events/project-events.module';
// Phase 3C — Chief of Staff agent + conversation API
import { ChiefOfStaffModule } from './modules/chief-of-staff/chief-of-staff.module';
// Phase 1-10 — Autonomous Work Layer Reconstruction
import { EnterpriseInitiationModule } from './modules/enterprise-initiation/enterprise-initiation.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { TenantFlagsModule } from './modules/tenant-flags/tenant-flags.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { CorrelationModule } from './common/correlation/correlation.module';
import { CommandModule } from './common/commands/command.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { LoggingModule } from './common/logging/logging.module';
// Phase 3E — Digital Twin + Activity Timeline
import { DigitalTwinModule } from './modules/digital-twin/digital-twin.module';
// Phase 6 — Health Score + BI Dashboards
import { ProjectHealthModule } from './modules/project-health/project-health.module';
// Phase 7 — Client Portal
import { PortalModule } from './modules/portal/portal.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
// Phase 3 — EAOS-1 entity workspace
import { EntitiesModule } from './modules/entities/entities.module';
import { MissionFeedModule } from './modules/mission-feed/mission-feed.module';
import { AIActionsModule } from './modules/ai-actions/ai-actions.module';
import { ActivityModule } from './modules/activity/activity.module';
import { ThreadsModule } from './modules/threads/threads.module';
// Phase 5 pre-req — Observability (Prometheus metrics)
import { MetricsModule } from './modules/metrics/metrics.module';
// Phase 5 pre-req — Feature flag system (kill-switch)
import { FeatureFlagModule } from './common/feature-flag/feature-flag.module';
// Phase 4 — EAOS-2 widgets
import { WidgetsModule } from './modules/widgets/widgets.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TiersModule } from './modules/tiers/tiers.module';
import { IndustriesModule } from './modules/industry/industries.module';
import { FeaturesModule } from './modules/features/features.module';
import { DepartmentsPoolModule } from './modules/departments-pool/departments-pool.module';
import { AgentsPoolModule } from './modules/agents-pool/agents-pool.module';
import { PackagesModule } from './modules/packages/packages.module';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
// Phase 7 — EAOS-5 Solution Packs (Marketplace + install lifecycle)
import { SolutionPacksModule } from './modules/solution-packs/solution-packs.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
// Phase 8 — EAOS-6 First Vertical Pack (Retail)
import { RetailModule } from './modules/retail/retail.module';
import { TenantTemplatesModule } from './modules/tenant-templates/tenant-templates.module';
// Phase 2 — Dashboard aggregation (Command Center)
import { CommandCenterModule } from './modules/command-center/command-center.module';
// Phase 3 — Cross-Department Context
import { ContextModule } from './modules/context/context.module';
// Phase 5 — Batch Approvals & Learning Loop
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { TenantContextMiddleware } from './common/context/tenant-context.middleware';
// TenantContextMiddleware is deprecated — TenantContextGuard (APP_GUARD) replaces it
import { TenantContextModule } from './common/context/tenant-context.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { TenantContextGuard } from './common/guards/tenant-context.guard';
import { CookieAuthModule } from './common/auth/cookie-auth.module';
import { CsrfProtectionMiddleware } from './common/auth/csrf.middleware';

@Module({
  imports: [
    // Config — global, validates env vars at boot
    ConfigurationModule,

    // Phase 9 — Cookie auth (httpOnly + Secure + SameSite=Strict, sole auth path)
    CookieAuthModule,

    // Tenant context — @Global so every module can inject TenantContextService
    // (Phase 1, Task 1.4 + Phase 1E migration)
    TenantContextModule,

    // Rate limiting: 100 req / 60 s per IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Infrastructure (global — no need to import elsewhere)
    DatabaseModule,
    CacheModule,
    IdempotencyModule, // Phase 1 reusable idempotency layer (idempotency_records)
    CommandIdempotencyModule, // @Global — command pattern idempotency wrapper
    PersistenceModule, // @Global — Prisma adapters bound to port interfaces
    SecurityModule, // Centralized secret management

    // Feature modules
    AuthModule,
    TenantsModule,
    UsersModule,
    EventsModule,
    EnterpriseEventsModule, // Enterprise Event Fabric (ADR-001, Phase 2) — @Global

    // Phase 2 — Agent Runtime
    AgentsModule,
    MemoryModule,
    ToolsModule,
    OrchestrationModule,

    // Phase 3 — Governance, Observability, Notifications, Departments, Models
    GovernanceModule,
    ApprovalPortModule, // Phase 7 — Unified Capability Approval Port (ADR-006)
    HermesModule,
    ContextPlaneModule, // Organizational Context Plane (ADR-002, Phase 3) — @Global
    WorkRuntimeModule, // Governed Work Runtime (ADR-003/004, Phase 4)
    EnterpriseCognitionModule, // Enterprise Cognitive Coordination Layer (Phase 5)
    EnterpriseAutonomyModule, // Governed Autonomous Operations (Phase 6)
    EnterpriseOperatingSystemModule, // Enterprise OS / Digital Twin (Phase 7)
    PlatformOperationsModule, // Platform Hardening & Operations (Phase 8)
    EnterpriseIntelligenceNetworkModule, // Knowledge Graph & Intelligence (Phase 9)
    PlatformSDKModule, // Platform SDK & Extensibility (Phase 10)
    CloudPlatformModule, // Cloud Platform & Federation (Phase 11)
    ApplicationFrameworkModule, // Enterprise Applications Framework (Phase 12)
    EnterpriseAIGovernanceModule, // AI Governance & Trust (Phase 13)
    PlatformEvolutionModule, // Platform Evolution & Future Readiness (Phase 14)
    ObservabilityModule,
    NotificationsModule,
    DepartmentsModule,
    DepartmentTemplatesModule,
    ModelsModule,
    AIGatewayModule,
    ChatModule,

    // Phase 4 — Analytics Engine, CRM Connectors, Financial Module & Reliability
    AnalyticsModule,
    ConnectorsModule,
    IntegrationsModule, // Phase A: Google Workspace + Brevo OAuth
    FinanceModule,
    ReliabilityModule,

    // Cross-cutting
    AuditModule, // @Global — AuditService available everywhere
    AgentTemplatesModule, // Phase 2 — template library

    // Settings — Admin configuration
    SettingsModule,

    // Tier-based Agent Pool — Platform tiers & automatic provisioning
    TiersModule,

    // Onboarding wizard (WS-2)
    OnboardingModule,

    // WS-2.1 — Uploads (tenant logos, future avatars/documents)
    UploadsModule,

    // Health monitoring
    HealthModule,

    // Phase 5 — Paperclip Routines/Workflows
    RoutinesModule,

    // Phase 5 — Paperclip Cost Tracking
    CostsModule,

    // Phase 5 — Paperclip Unified Inbox
    InboxModule,

    // Phase 5 — Paperclip Goals
    GoalsModule,

    // Phase 5 — Paperclip Projects
    ProjectsModule,
    CustomersModule,
    ProjectStagesModule,
    ProjectMembersModule,
    ProjectTypesModule,
    DeliverablesModule,
    ExecutionLogModule,
    ApprovalChainsModule,
    ProjectMemoryModule,
    ProjectDecisionsModule,
    ProjectAutomationModule, // Phase 3A
    ProjectEventsModule,     // Phase 3B
    ChiefOfStaffModule,      // Phase 3C
    DigitalTwinModule,       // Phase 3E

    // Phase 1-10 — Autonomous Work Layer Reconstruction
    CorrelationModule,        // @Global — AsyncLocalStorage tenant context
    CommandModule,            // @Global — Command pattern + idempotency
    OutboxModule,             // @Global — Transactional outbox + worker
    LoggingModule,            // @Global — Correlation logger
    EnterpriseInitiationModule, // Phase 2 — Secure initiation
    ExecutionModule,          // Phase 5 — Governed execution runtime
    ReviewsModule,            // Phase 6 — Human review
    AssignmentsModule,        // Phase 4 — Task-to-AI assignment
    TenantFlagsModule,        // @Global — Tenant-scoped feature flags
    TimelineModule,           // Phase 7 — Unified timeline
    ProjectHealthModule,
    // Phase 7 — Client Portal
    PortalModule,

    // Phase 1-10 — Phase 8 (Security, Observability, Operations)
    Phase8Module,

    // Phase 5 — Workflows (EAOS-2 / Paperclip)
    WorkflowsModule,

    // Phase 3 — EAOS-1 entity workspace
    EntitiesModule,
    MissionFeedModule,
    AIActionsModule,
    ActivityModule,
    ThreadsModule,

    // Phase 5 pre-req — Observability (Prometheus + Grafana)
    MetricsModule,
    FeatureFlagModule,

    // Phase 4 — EAOS-2 widgets
    WidgetsModule,

    // Phase 6 — EAOS-4 Knowledge Hub (RAG pipeline)
    KnowledgeModule,

    // Phase 7 — EAOS-5 Solution Packs
    SolutionPacksModule,
    MarketplaceModule,

    // Phase 8 — EAOS-6 First Vertical Pack (Retail)
    RetailModule,

    // Stage 1: Tenant-scoped templates (tenant-editable per industry)
    TenantTemplatesModule,

    // Phase 2 — Dashboard Command Center aggregation
    CommandCenterModule,
    // Phase 3 — Cross-Department Context
    ContextModule,
    // Phase 5 — Batch Approvals & Learning Loop
    ApprovalsModule,

    // Stage 2 Phase 2A — Compliance Checklist Engine
    ComplianceModule,

    // Phase 10 — Admin Business Composition (six pools)
    AgentsPoolModule,       // Pool #1 — AI Employees
    DepartmentsPoolModule,  // Pool #2 — Departments
    IndustriesModule,       // Pool #3 — Industries
    FeaturesModule,         // Pool #5 — Features
    PackagesModule,         // Pool #6 — Packages (composite root)

    // Phase 1 — Simulation-5 modules
    ServiceIdentitiesModule, // service identity + token management
    TimelineEventsModule,    // first-class event log
    DecisionEvaluationsModule, // immutable scores snapshot
    SimulationsModule,       // simulation lifecycle + day-run
    SimulationVisibilityModule, // @Global — default exclusion of simulation artifacts
  ],
  providers: [
    // Global rate-limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global JWT guard (routes opt-out with @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global role guard
    { provide: APP_GUARD, useClass: RolesGuard },

    // Global tenant context guard — runs AFTER JwtAuthGuard to ensure req.user is set.
    // Sets up AsyncLocalStorage context for TenantContextService.tenantId.
    { provide: APP_GUARD, useClass: TenantContextGuard },

    // Global exception → ApiResponse envelope
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Global success → ApiResponse envelope
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },

    // Global audit interceptor — writes audit logs for every mutating request
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    // Global idempotency interceptor — deduplicates replayed requests per tenant+key
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap {
  configure(consumer: MiddlewareConsumer): void {
    // Nest v11+ uses a newer path-to-regexp which requires named wildcards.
    // Using *path avoids noisy startup warnings like "Unsupported route path: /api/*".
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    // Phase 9, Task 9.3: CSRF double-submit cookie validation.
    // Runs BEFORE the JWT guard so unauthenticated mutating requests
    // without a CSRF token are rejected (defense-in-depth).
    consumer
      .apply(CsrfProtectionMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    // Phase 1, Task 1.4: bind the AsyncLocalStorage tenant context for
    // every request after the JWT guard has populated req.user. Services
    // read `tenantContext.tenantId` instead of receiving tenantId as a
    // parameter on every method (EAOS-rbac-model.md §10).
    //
    // NOTE: TenantContextMiddleware is REMOVED because middleware runs BEFORE
    // guards in NestJS, so req.user wasn't set when it tried to resolve context.
    // TenantContextGuard (registered via APP_GUARD above) replaces this and runs
    // after JwtAuthGuard, properly setting up the AsyncLocalStorage context.
    // consumer
    //   .apply(TenantContextMiddleware)
    //   .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }

  // FIX-OUTBOX-RACE: Start the OutboxWorker here, AFTER every module has
  // had a chance to register its handler via onModuleInit. Previously the
  // worker started in onModuleInit which races with consumer module init
  // and silently dead-letters events whose handlers hadn't registered yet.
  constructor(private readonly outboxWorker: OutboxWorker) {}

  onApplicationBootstrap(): void {
    this.outboxWorker.bootstrap();
  }
}
