import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigurationModule } from './config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { AgentsModule } from './modules/agents/agents.module';
import { MemoryModule } from './modules/memory/memory.module';
import { ToolsModule } from './modules/tools/tools.module';
import { OrchestrationModule } from './modules/orchestration/orchestration.module';
// Phase 3
import { GovernanceModule } from './modules/governance/governance.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DepartmentTemplatesModule } from './modules/department-templates/department-templates.module';
import { ModelsModule } from './modules/models/models.module';
import { AIGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { OpenClawAdapterModule } from './modules/ai-gateway/openclaw-adapter.module';
import { AuditModule } from './modules/audit/audit.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ReliabilityModule } from './modules/reliability/reliability.module';
import { AgentTemplatesModule } from './modules/agent-templates/agent-templates.module';
import { RoutinesModule } from './modules/routines/routines.module';
import { CostsModule } from './modules/costs/costs.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { GoalsModule } from './modules/goals/goals.module';
import { SecurityModule } from './modules/security/security.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TiersModule } from './modules/tiers/tiers.module';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { WorkspaceProvisioningModule } from './modules/workspace-provisioning/workspace-provisioning.module';
import { ChatModule } from './modules/chat/chat.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    // Config — global, validates env vars at boot
    ConfigurationModule,

    // Rate limiting: 100 req / 60 s per IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Infrastructure (global — no need to import elsewhere)
    DatabaseModule,
    CacheModule,
    SecurityModule, // Centralized secret management

    // Feature modules
    AuthModule,
    TenantsModule,
    UsersModule,
    EventsModule,

    // Phase 2 — Agent Runtime
    AgentsModule,
    MemoryModule,
    ToolsModule,
    OrchestrationModule,

    // Phase 3 — Governance, Observability, Notifications, Departments, Models
    GovernanceModule,
    ObservabilityModule,
    NotificationsModule,
    DepartmentsModule,
    DepartmentTemplatesModule,
    ModelsModule,
    AIGatewayModule,
    OpenClawAdapterModule, // OpenClaw channel adapter — POST /api/v1/openclaw/message

    // Phase 4 — Analytics Engine, CRM Connectors, Financial Module & Reliability
    AnalyticsModule,
    ConnectorsModule,
    FinanceModule,
    ReliabilityModule,

    // Cross-cutting
    AuditModule, // @Global — AuditService available everywhere
    AgentTemplatesModule, // Phase 2 — template library

    // Settings — Admin configuration
    SettingsModule,

    // Tier-based Agent Pool — Platform tiers & automatic provisioning
    TiersModule,

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

    // Phase 5 — Onboarding Wizard
    OnboardingModule,

    // Workspace Provisioning — corporate email + cloud folder auto-provisioning
    WorkspaceProvisioningModule,
    ChatModule,
  ],
  providers: [
    // Global rate-limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global JWT guard (routes opt-out with @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global role guard
    { provide: APP_GUARD, useClass: RolesGuard },

    // Global exception → ApiResponse envelope
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Global success → ApiResponse envelope
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },

    // Global audit interceptor — writes audit logs for every mutating request
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Nest v11+ uses a newer path-to-regexp which requires named wildcards.
    // Using *path avoids noisy startup warnings like "Unsupported route path: /api/*".
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
