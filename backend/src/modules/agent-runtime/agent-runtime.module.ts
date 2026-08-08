/**
 * Phase 23 — AgentRuntimeModule.
 *
 * Wires the new agent runtime (CR-AI-0501..0506) end-to-end:
 *   - AgentRouter (intent → agentId)
 *   - AgentRunStore (persistence)
 *   - AgentRunAuditSink (append-only evidence)
 *   - AgentTenantScopeGuard (tenant safety)
 *   - 6 executors (one per OOB agent)
 *   - AgentRuntime (orchestrator)
 *   - AgentRuntimeController (HTTP surface)
 *
 * SOLID — OCP: a 7th agent = one executor import + one `useExisting`
 *   in the multi-provider array. Zero edits to runtime, router, or
 *   controller.
 * SOLID — DIP: every collaborator injected via DI token, never
 *   `new`'d at module construction.
 */

import { Module } from '@nestjs/common';
import { SkillRegistryModule } from '../skill-registry/skill-registry.module';
import { AgentTemplatesModule } from '../agent-templates/agent-templates.module';
import { AgentsModule } from '../agents/agents.module';
import { ApprovalPortModule } from '../approval-port/approval-port.module';
import { AgentRuntimeController } from './agent-runtime.controller';
import { AgentRuntimeRunController } from './agent-runtime-run.controller';
import { AgentRuntime } from './runtime/agent-runtime.service';
import { AgentRunStore } from './runtime/agent-run-store.service';
import { AgentRunAuditSink } from './runtime/audit-sink';
import { AgentRouter } from './routing/agent-router';
import { ClarifyStep } from './runtime/clarify-step';
import { SkillStep } from './runtime/skill-step';
import { WriteStep } from './runtime/write-step';
import {
  AgentRuntimeChatDispatcher,
  AGENT_CHAT_DISPATCHER,
} from './runtime/agent-runtime-chat-dispatcher';
import { UniversalAgentExecutor } from './executors/universal-agent.executor';
import { ProductivityAgentExecutor } from './executors/productivity-agent.executor';
import { SalesAgentExecutor } from './executors/sales-agent.executor';
import { MarketingAgentExecutor } from './executors/marketing-agent.executor';
import { ServiceAgentExecutor } from './executors/service-agent.executor';
import { KnowledgeAgentExecutor } from './executors/knowledge-agent.executor';
import {
  AGENT_EXECUTORS,
  AGENT_REGISTRY,
  AGENT_RUNTIME,
  AUDIT_SINK,
  SKILL_STEP,
  TENANT_SCOPE,
  WRITE_STEP,
} from './agent-runtime.tokens';
import { AgentTenantScopeGuard } from '../agents/agents-tenant-scope.guard';
import { AgentRegistry } from '../agent-templates/agents.registry';

const ALL_EXECUTORS = [
  UniversalAgentExecutor,
  ProductivityAgentExecutor,
  SalesAgentExecutor,
  MarketingAgentExecutor,
  ServiceAgentExecutor,
  KnowledgeAgentExecutor,
];

@Module({
  imports: [
    SkillRegistryModule,
    AgentTemplatesModule,
    AgentsModule,
    ApprovalPortModule,
  ],
  controllers: [AgentRuntimeController, AgentRuntimeRunController],
  providers: [
    AgentRunStore,
    AgentRunAuditSink,
    AgentRouter,
    ClarifyStep,
    SkillStep,
    WriteStep,
    ...ALL_EXECUTORS,
    {
      provide: AGENT_REGISTRY,
      useExisting: AgentRegistry,
    },
    {
      provide: SKILL_STEP,
      useExisting: SkillStep,
    },
    {
      provide: WRITE_STEP,
      useExisting: WriteStep,
    },
    {
      provide: AUDIT_SINK,
      useExisting: AgentRunAuditSink,
    },
    {
      provide: TENANT_SCOPE,
      useFactory: (
        guard: AgentTenantScopeGuard,
      ): ((tenantId: unknown) => string) => {
        return (tenantId: unknown) => guard.assert('agent-runtime', tenantId);
      },
      inject: [AgentTenantScopeGuard],
    },
    {
      provide: AGENT_EXECUTORS,
      // Multi-provider — every executor is registered as an
      // IAgentExecutor under the same token.
      useFactory: (
        u: UniversalAgentExecutor,
        p: ProductivityAgentExecutor,
        s: SalesAgentExecutor,
        m: MarketingAgentExecutor,
        sv: ServiceAgentExecutor,
        k: KnowledgeAgentExecutor,
      ) => [u, p, s, m, sv, k],
      inject: [
        UniversalAgentExecutor,
        ProductivityAgentExecutor,
        SalesAgentExecutor,
        MarketingAgentExecutor,
        ServiceAgentExecutor,
        KnowledgeAgentExecutor,
      ],
    },
    {
      provide: AGENT_RUNTIME,
      useExisting: AgentRuntime,
    },
    {
      provide: AGENT_CHAT_DISPATCHER,
      useExisting: AgentRuntimeChatDispatcher,
    },
    AgentRuntimeChatDispatcher,
  ],
  exports: [AGENT_RUNTIME, AGENT_CHAT_DISPATCHER],
})
export class AgentRuntimeModule {}
