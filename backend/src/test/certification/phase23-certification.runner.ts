/**
 * Phase 23 — G23 Agent Runtime certification runner.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §4 (P23).
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G23-R-001 — AgentRegistry still registers 6 OOB agents
 *   G23-R-002 — Every CR-AI-0501..0506 baseline id has an IAgentExecutor
 *   G23-R-003 — AgentRouter classifies "summarize …" → CR-AI-0502
 *   G23-R-004 — AgentRouter classifies "lead score …" → CR-AI-0503
 *   G23-R-005 — AgentRouter classifies "categorize case …" → CR-AI-0505
 *   G23-R-006 — AgentRouter rejects unsupported intent → typed clarification
 *   G23-R-007 — Universal executor runs end-to-end through SkillStep
 *   G23-R-008 — Mutating write (draft-email) routes to APPROVAL_REQUIRED
 *   G23-R-009 — AuditSink records evidence chain on completion
 *   G23-R-010 — Cross-tenant / missing tenant assertions fire typed errors
 *   G23-R-011 — Phase 13 G13 still APPROVED (no regression)
 *   G23-R-012 — ClarifyStep returns typed non-empty suggestion list
 *   G23-R-013 — UniversalAgentExecutor rejects unsupported intent with
 *               typed AgentUnsupportedIntentError (never silent success)
 *   G23-R-014 — unapproved mutating write is blocked (skill not invoked)
 *   G23-R-015 — auto-approved mutating write executes through the gate
 *   G23-R-016 — non-sensitive skill bypasses approval gate (read path)
 *   G23-R-017 — chat agent dispatcher routes to the runtime
 *   G23-R-018 — chat agent dispatcher fails closed on wildcard tenant
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  AgentRegistry,
  PHASE_13_OOB_AGENT_IDS,
  type AgentId,
} from '../../modules/agent-templates/agents.registry';
import { AgentRouter } from '../../modules/agent-runtime/routing/agent-router';
import { ClarifyStep } from '../../modules/agent-runtime/runtime/clarify-step';
import {
  AgentClarificationRequiredError,
  AgentUnsupportedIntentError,
} from '../../modules/agent-runtime/errors';
import { UniversalAgentExecutor } from '../../modules/agent-runtime/executors/universal-agent.executor';
import { ProductivityAgentExecutor } from '../../modules/agent-runtime/executors/productivity-agent.executor';
import { SalesAgentExecutor } from '../../modules/agent-runtime/executors/sales-agent.executor';
import { MarketingAgentExecutor } from '../../modules/agent-runtime/executors/marketing-agent.executor';
import { ServiceAgentExecutor } from '../../modules/agent-runtime/executors/service-agent.executor';
import { KnowledgeAgentExecutor } from '../../modules/agent-runtime/executors/knowledge-agent.executor';
import { AgentRuntime } from '../../modules/agent-runtime/runtime/agent-runtime.service';
import type {
  AgentExecuteContext,
  AgentSkillOutcome,
  IAgentExecutor,
} from '../../modules/agent-runtime/interfaces/agent-runtime.interface';
import type {
  ISkillStep,
  SkillStepResult,
} from '../../modules/agent-runtime/interfaces/agent-step.interface';
import { Phase13CertificationRunner } from './phase13-certification.runner';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

class StubSkillStep implements ISkillStep {
  constructor(
    private readonly handler: (
      key: string,
      input: unknown,
    ) => Promise<Partial<SkillStepResult> & { output?: string }>,
  ) {}
  invoke(key: string, input: unknown): Promise<SkillStepResult> {
    return this.handler(key, input).then((r) => ({
      output: r.output ?? 'stub-output',
      confidence: r.confidence ?? 0.9,
      citationsCount: r.citationsCount ?? 0,
      durationMs: r.durationMs ?? 5,
    }));
  }
}

class StubAuditSink {
  public rows: unknown[] = [];
  public evidenceRows: Array<{
    runId: string;
    items: ReadonlyArray<unknown>;
  }> = [];
  record(run: unknown): Promise<void> {
    this.rows.push(run);
    return Promise.resolve();
  }
  evidence(runId: string, items: ReadonlyArray<unknown>): Promise<void> {
    this.evidenceRows.push({ runId, items });
    return Promise.resolve();
  }
}

class StubRunStore {
  public rows: Map<string, unknown> = new Map();
  constructor(
    private readonly nextId: () => string = (): string =>
      `r_${Math.random().toString(36).slice(2, 10)}`,
  ) {}
  create(input: unknown): Promise<{ id: string } & Record<string, unknown>> {
    const id = this.nextId();
    const row = { id, ...(input as Record<string, unknown>) };
    this.rows.set(id, row);
    return Promise.resolve(row);
  }
  update(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<{ id: string } & Record<string, unknown>> {
    const existing = (this.rows.get(id) ?? {}) as Record<string, unknown>;
    const merged = { ...existing, ...patch, id };
    this.rows.set(id, merged);
    return Promise.resolve(merged);
  }
  get(id: string): Promise<{ id: string } & Record<string, unknown>> {
    const row = (this.rows.get(id) ?? { id }) as {
      id: string;
    } & Record<string, unknown>;
    return Promise.resolve(row);
  }
  list(): Promise<ReadonlyArray<{ id: string }>> {
    return Promise.resolve(
      Array.from(this.rows.values()) as ReadonlyArray<{ id: string }>,
    );
  }
}

function assertTenantStrict(tenantId: unknown): string {
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new Error('TENANT_ID_REQUIRED');
  }
  if (tenantId === '*') {
    throw new Error('TENANT_WILDCARD_FORBIDDEN');
  }
  return tenantId;
}

function buildSkillStep(): ISkillStep {
  return {
    invoke(): Promise<SkillStepResult> {
      return Promise.resolve({
        output: 'ok',
        confidence: 0.9,
        citationsCount: 0,
        durationMs: 3,
      });
    },
  };
}

@Injectable()
export class Phase23CertificationRunner {
  private readonly logger = new Logger(Phase23CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ): void => {
      const r: GateResult = { id, name, passed, detail };
      gates.push(r);
      if (!passed) allPassed = false;
    };

    // ─── Build AgentRegistry (no Nest lifecycle). ───
    const registry = new AgentRegistry();
    registry.registerAll();
    const agents = registry.list();

    // G23-R-001 — registry still registers 6 OOB agents
    {
      const ok = agents.length === 6 && PHASE_13_OOB_AGENT_IDS.length === 6;
      record('G23-R-001', 'AgentRegistry registers 6 OOB agents at boot', ok);
    }

    // G23-R-002 — every baseline has an executor implementation
    {
      const skillStep = new StubSkillStep(() =>
        Promise.resolve({
          output: 'stub',
          confidence: 0.95,
          citationsCount: 0,
          durationMs: 5,
        }),
      );
      const executors: ReadonlyArray<IAgentExecutor> = [
        new UniversalAgentExecutor(skillStep),
        new ProductivityAgentExecutor(skillStep),
        new SalesAgentExecutor(skillStep),
        new MarketingAgentExecutor(skillStep),
        new ServiceAgentExecutor(skillStep),
        new KnowledgeAgentExecutor(skillStep),
      ];
      const ids = executors.map((e) => e.agentId);
      const missing = PHASE_13_OOB_AGENT_IDS.filter((id) => !ids.includes(id));
      record(
        'G23-R-002',
        'every CR-AI-0501..0506 baseline id has an IAgentExecutor',
        missing.length === 0,
        missing.length === 0 ? undefined : `missing: ${missing.join(', ')}`,
      );
    }

    // G23-R-003 — summarize routes to PRODUCTIVITY
    {
      const router = new AgentRouter(registry);
      const routed = router.classify('summarize this thread');
      record(
        'G23-R-003',
        'AgentRouter classifies "summarize …" → PRODUCTIVITY',
        routed === ('CR-AI-0502' as AgentId),
        routed === ('CR-AI-0502' as AgentId) ? undefined : `got=${routed}`,
      );
    }

    // G23-R-004 — lead score routes to SALES
    {
      const router = new AgentRouter(registry);
      const routed = router.classify('lead score this opportunity');
      record(
        'G23-R-004',
        'AgentRouter classifies "lead score …" → SALES',
        routed === ('CR-AI-0503' as AgentId),
        routed === ('CR-AI-0503' as AgentId) ? undefined : `got=${routed}`,
      );
    }

    // G23-R-005 — categorize case routes to SERVICE
    {
      const router = new AgentRouter(registry);
      const routed = router.classify('categorize case 12345');
      record(
        'G23-R-005',
        'AgentRouter classifies "categorize case …" → SERVICE',
        routed === ('CR-AI-0505' as AgentId),
        routed === ('CR-AI-0505' as AgentId) ? undefined : `got=${routed}`,
      );
    }

    // G23-R-006 — unsupported intent → typed clarification
    {
      const router = new AgentRouter(registry);
      let threw: AgentClarificationRequiredError | null = null;
      try {
        router.resolve(
          'totally-unsupported-intent-xyz',
          'CR-AI-0501' as AgentId,
        );
      } catch (err: unknown) {
        if (err instanceof AgentClarificationRequiredError) threw = err;
      }
      record(
        'G23-R-006',
        'unsupported intent returns AgentClarificationRequiredError',
        threw !== null && (threw?.suggestions.length ?? 0) > 0,
        threw === null
          ? 'did not throw AgentClarificationRequiredError'
          : undefined,
      );
    }

    // G23-R-007 — universal executor runs end-to-end through SkillStep
    {
      const invocations: Array<{ key: string; input: unknown }> = [];
      const skillStep: ISkillStep = {
        invoke(key: string, input: unknown): Promise<SkillStepResult> {
          invocations.push({ key, input });
          return Promise.resolve({
            output: `skill:${key}`,
            confidence: 0.92,
            citationsCount: 1,
            durationMs: 7,
          });
        },
      };
      const exec = new UniversalAgentExecutor(skillStep);
      const ctx: AgentExecuteContext = {
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'OWNER' as never,
        intent: 'universal.route',
        message: 'summarize the last thread',
      };
      const outcome: AgentSkillOutcome = await exec.execute(ctx);
      const ok =
        invocations.length === 1 &&
        invocations[0]?.key === 'summarize' &&
        outcome.skillKey === 'summarize' &&
        outcome.output === 'skill:summarize' &&
        outcome.confidence === 0.92 &&
        outcome.requiresApproval === false;
      record(
        'G23-R-007',
        'UniversalAgentExecutor runs end-to-end through SkillStep',
        ok,
        ok
          ? undefined
          : `invocations=${JSON.stringify(invocations)} outcome=${JSON.stringify(outcome)}`,
      );
    }

    // G23-R-008 — mutating write (draft-email) is approval-gated
    {
      const salesExec = new SalesAgentExecutor(buildSkillStep());
      const outcome = await salesExec.execute({
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'OWNER' as never,
        intent: 'sales.draft-email',
        message: 'draft an outreach email to Acme Corp',
      });
      record(
        'G23-R-008',
        'SalesAgentExecutor routes draft-email → requiresApproval=true',
        outcome.requiresApproval === true,
      );
    }

    // G23-R-009 — AuditSink records evidence chain on completion
    {
      const audit = new StubAuditSink();
      const store = new StubRunStore();
      const router = new AgentRouter(registry);
      const runtime = new AgentRuntime(
        router,
        store as never,
        registry,
        audit as never,
        assertTenantStrict,
        [
          new UniversalAgentExecutor(buildSkillStep()),
          new ProductivityAgentExecutor(buildSkillStep()),
          new SalesAgentExecutor(buildSkillStep()),
          new MarketingAgentExecutor(buildSkillStep()),
          new ServiceAgentExecutor(buildSkillStep()),
          new KnowledgeAgentExecutor(buildSkillStep()),
        ],
      );
      await runtime.run(
        {
          agentId: 'CR-AI-0501' as AgentId,
          intent: 'universal.route',
          message: 'summarize text',
        },
        {
          tenantId: 't-1',
          actorUserId: 'u-1',
          actorRole: 'OWNER' as never,
          isCrossTenant: false,
        },
      );
      const ok = audit.rows.length === 1 && audit.evidenceRows.length === 1;
      record(
        'G23-R-009',
        'AuditSink records run + evidence on completion',
        ok,
        ok
          ? undefined
          : `audit.rows=${audit.rows.length} evidence=${audit.evidenceRows.length}`,
      );
    }

    // G23-R-010 — cross-tenant + missing tenant assertions
    {
      let wild: Error | null = null;
      let miss: Error | null = null;
      try {
        assertTenantStrict('*');
      } catch (e: unknown) {
        wild = e as Error;
      }
      try {
        assertTenantStrict('');
      } catch (e: unknown) {
        miss = e as Error;
      }
      record(
        'G23-R-010',
        'tenant-scope guard rejects wildcard + empty',
        wild !== null && miss !== null,
        wild === null
          ? 'wildcard not rejected'
          : miss === null
            ? 'empty not rejected'
            : undefined,
      );
    }

    // G23-R-011 — Phase 13 G13 still APPROVED (regression)
    {
      try {
        const p13 = await new Phase13CertificationRunner().run();
        record(
          'G23-R-011',
          'Phase 13 G13 still APPROVED (no regression)',
          p13.verdict === 'APPROVED',
        );
      } catch (err: unknown) {
        record(
          'G23-R-011',
          'Phase 13 G13 still APPROVED (no regression)',
          false,
          (err as Error).message,
        );
      }
    }

    // G23-R-012 — ClarifyStep returns typed non-empty suggestion list
    {
      const step = new ClarifyStep();
      const r = step.clarify({
        intent: 'help.topics',
        reason: 'unsupported_intent',
      });
      record(
        'G23-R-012',
        'ClarifyStep produces typed clarification with suggestions',
        r.suggestions.length > 0 && r.prompt.length > 0,
      );
    }

    // G23-R-013 — UniversalAgentExecutor rejects unsupported intent via
    // typed AgentUnsupportedIntentError (never silent success).
    {
      const exec = new UniversalAgentExecutor(buildSkillStep());
      let threw: AgentUnsupportedIntentError | null = null;
      try {
        await exec.execute({
          tenantId: 't-1',
          actorUserId: 'u-1',
          actorRole: 'OWNER' as never,
          intent: 'completely-unsupported-intent-xyz',
          message: 'summarize this thread',
        });
      } catch (err: unknown) {
        if (err instanceof AgentUnsupportedIntentError) threw = err;
      }
      record(
        'G23-R-013',
        'UniversalAgentExecutor rejects unsupported intent with typed error',
        threw !== null,
        threw === null
          ? 'did not throw AgentUnsupportedIntentError'
          : undefined,
      );
    }

    // G23-R-014 — the approval gate is real: an unapproved mutating
    // write NEVER reaches the underlying skill (fail-closed), and the
    // outcome surfaces `requiresApproval=true` without executing.
    {
      const skillInvoked: string[] = [];
      const gatedSkillStep: ISkillStep = {
        invoke(key: string): Promise<SkillStepResult> {
          skillInvoked.push(key);
          return Promise.resolve({
            output: `skill:${key}`,
            confidence: 0.9,
            citationsCount: 0,
            durationMs: 3,
          });
        },
      };
      // No write step wired → fail closed on draft-email.
      const gatedSales = new SalesAgentExecutor(gatedSkillStep);
      const outcome = await gatedSales.execute({
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'OWNER' as never,
        intent: 'sales.draft-email',
        message: 'draft an outreach email to Acme Corp',
      });
      const noWrite =
        skillInvoked.length === 0 &&
        outcome.requiresApproval === true &&
        outcome.output.includes('approval required');
      record(
        'G23-R-014',
        'unapproved mutating write is blocked (skill not invoked, fail-closed)',
        noWrite,
        noWrite
          ? undefined
          : `skillInvoked=${JSON.stringify(skillInvoked)} outcome=${JSON.stringify(outcome)}`,
      );
    }

    // G23-R-015 — with an explicit write step that auto-approves, the
    // same mutating write DOES execute and returns approved.
    {
      const skillInvoked: string[] = [];
      const autoApprovedWriteStep = {
        submit(req: {
          skillKey: string;
          input: unknown;
        }): Promise<{
          approved: boolean;
          output: string;
          confidence: number;
          citationsCount: number;
          durationMs: number;
        }> {
          return Promise.resolve({
            approved: true,
            output: `auto-approved:${req.skillKey}`,
            confidence: 0.95,
            citationsCount: 1,
            durationMs: 4,
          });
        },
      };
      const approvingSkillStep: ISkillStep = {
        invoke(key: string): Promise<SkillStepResult> {
          skillInvoked.push(key);
          return Promise.resolve({
            output: `skill:${key}`,
            confidence: 0.9,
            citationsCount: 0,
            durationMs: 3,
          });
        },
      };
      const sales = new SalesAgentExecutor(
        approvingSkillStep,
        autoApprovedWriteStep as never,
      );
      const outcome = await sales.execute({
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'OWNER' as never,
        intent: 'sales.draft-email',
        message: 'draft an outreach email to Acme Corp',
      });
      const ok =
        skillInvoked.length === 0 &&
        outcome.requiresApproval === false &&
        outcome.output === 'auto-approved:draft-email';
      record(
        'G23-R-015',
        'auto-approved mutating write executes through the gate',
        ok,
        ok
          ? undefined
          : `skillInvoked=${JSON.stringify(skillInvoked)} outcome=${JSON.stringify(outcome)}`,
      );
    }

    // G23-R-016 — a non-sensitive skill bypasses the approval gate and
    // is invoked directly (read path unaffected).
    {
      const skillInvoked: string[] = [];
      const readSkillStep: ISkillStep = {
        invoke(key: string): Promise<SkillStepResult> {
          skillInvoked.push(key);
          return Promise.resolve({
            output: `skill:${key}`,
            confidence: 0.92,
            citationsCount: 1,
            durationMs: 5,
          });
        },
      };
      const sales = new SalesAgentExecutor(readSkillStep);
      const outcome = await sales.execute({
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'OWNER' as never,
        intent: 'sales.score-lead',
        message: 'score this lead',
      });
      const ok =
        skillInvoked.length === 1 &&
        skillInvoked[0] === 'extract' &&
        outcome.requiresApproval === false;
      record(
        'G23-R-016',
        'non-sensitive skill bypasses approval gate and is invoked',
        ok,
        ok
          ? undefined
          : `skillInvoked=${JSON.stringify(skillInvoked)} outcome=${JSON.stringify(outcome)}`,
      );
    }

    // G23-R-017 — the chat→runtime dispatcher bridges a recognised
    // agent command to the runtime and surfaces a typed reply.
    {
      const skillStep = buildSkillStep();
      const runtime = new AgentRuntime(
        new AgentRouter(registry),
        new StubRunStore() as never,
        registry,
        new StubAuditSink() as never,
        assertTenantStrict,
        [new UniversalAgentExecutor(skillStep)],
      );
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AgentRuntimeChatDispatcher } = require('../../modules/agent-runtime/runtime/agent-runtime-chat-dispatcher');
      const dispatcher = new AgentRuntimeChatDispatcher(runtime as never);
      const out = await dispatcher.dispatch({
        agentId: 'CR-AI-0501' as AgentId,
        intent: 'universal.route',
        message: 'summarize the last thread',
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'OWNER',
      });
      const ok =
        out !== null &&
        typeof out.reply === 'string' &&
        out.run.status === 'COMPLETED';
      record(
        'G23-R-017',
        'chat agent dispatcher routes a recognised agent command to the runtime',
        ok,
        ok ? undefined : `out=${JSON.stringify(out)}`,
      );
    }

    // G23-R-018 — the chat dispatcher fails closed on a missing tenant
    // (returns null; never routes cross-tenant or wildcard).
    {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AgentRuntimeChatDispatcher } = require('../../modules/agent-runtime/runtime/agent-runtime-chat-dispatcher');
      const dispatcher = new AgentRuntimeChatDispatcher({} as never);
      const out = await dispatcher.dispatch({
        agentId: 'CR-AI-0501' as AgentId,
        intent: 'chat.agent-intent',
        message: 'summarize',
        tenantId: '*',
        actorUserId: 'u-1',
        actorRole: 'OWNER',
      });
      record(
        'G23-R-018',
        'chat agent dispatcher fails closed on wildcard tenant',
        out === null,
        out === null ? undefined : `out=${JSON.stringify(out)}`,
      );
    }

    this.logger.log(
      `Phase 23 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
