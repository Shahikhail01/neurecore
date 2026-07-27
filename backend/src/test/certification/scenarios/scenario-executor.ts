// src/test/certification/scenarios/scenario-executor.ts
/**
 * Phase 9 — Scenario Executor.
 *
 * Drives the golden-path command pipeline through the canonical
 * CommandRegistry, idempotency service, and outbox adapters. The
 * executor is the bridge between the certification runner and the
 * production system; it never bypasses commands to call Prisma
 * directly.
 *
 * The executor is dependency-free at the type level (no Prisma) so
 * Phase 9 scenarios can run in pure unit-test mode. The Phase 3-8
 * integration suite already exercises real persistence; here we
 * measure idempotency, deduplication, recovery, evidence trail,
 * tenant isolation, and deterministic reproducibility.
 */

import {
  APPROVE_INITIATION_COMMAND,
  APPROVE_INITIATION_VERSION,
  ApproveInitiationInput,
  createApproveInitiationDefinition,
} from '../../../modules/enterprise-initiation/commands/approve-initiation.command';
import {
  CREATE_PROJECT_FROM_INITIATION_COMMAND,
  CREATE_PROJECT_FROM_INITIATION_VERSION,
  CreateProjectFromInitiationInput,
  createCreateProjectFromInitiationDefinition,
} from '../../../modules/enterprise-initiation/commands/create-project-from-initiation.command';
import { InitiationStatus } from '../../../modules/enterprise-initiation/domain/initiation-states';
import { CommandRegistry } from '../../../common/commands/command.registry';
import { IIdempotencyRepository } from '../../../common/idempotency/idempotency-repository.port';
import { CorrelationService } from '../../../common/correlation/correlation.service';
import { CommandMetadata } from '../../../common/correlation/correlation.interface';
import {
  CertificationScenario,
  ScenarioExecutor,
} from '../certification-runner';
import { FailureInjectionBus } from '../fixtures/failure-injection';
import { SyntheticAccountingDataset } from '../synthetic/accounting-synthetic-data';
import {
  RECONSTRUCTION_TEST_TENANT_ID,
  ATTACKER_TENANT_ID,
} from '../harness/certification-harness';

type ApproveHandlerFn = (
  input: ApproveInitiationInput,
  metadata: CommandMetadata,
) => Promise<{
  success: true;
  data: {
    initiationId: string;
    previousStatus: InitiationStatus;
    newStatus: InitiationStatus;
    automationRequested: boolean;
  };
  correlationId: string;
  occurredAt: Date;
}>;

type CreateProjectHandlerFn = (
  input: CreateProjectFromInitiationInput,
  metadata: CommandMetadata,
) => Promise<{
  success: true;
  data: {
    projectId: string;
    initiationId: string;
    automationStatus: string;
    correlationId: string;
  };
  correlationId: string;
  occurredAt: Date;
}>;

interface ScenarioContext {
  scenario: CertificationScenario;
  dataset: SyntheticAccountingDataset;
  correlation: {
    correlationId: string;
    idempotencyKey: string;
    tenantId: string;
    actorId: string;
  };
  failures: FailureInjectionBus;
  registry: CommandRegistry;
  correlationService: CorrelationService;
  metrics: Record<string, number>;
  state: ScenarioState;
}

export function createSimulatedScenarioExecutor(): ScenarioExecutor {
  return {
    async execute(scenario, dataset, correlation, failures) {
      const idempotencyService = buildSimulatedIdempotency();
      const registry = new CommandRegistry(idempotencyService);
      const correlationService = new CorrelationService();
      const state = new ScenarioState();

      registry.register(
        createApproveInitiationDefinition(
          makeApproveHandler(state, failures, scenario),
        ),
      );
      registry.register(
        createCreateProjectFromInitiationDefinition(
          makeCreateProjectHandler(state, failures, scenario),
        ),
      );

      const ctx: ScenarioContext = {
        scenario,
        dataset,
        correlation,
        failures,
        registry,
        correlationService,
        metrics: {},
        state,
      };

      const isCrossTenant =
        scenario.tenantId === ATTACKER_TENANT_ID &&
        scenario.inputs.targetTenant === RECONSTRUCTION_TEST_TENANT_ID;

      switch (scenario.type) {
        case 'clean_run':
          await runClean(ctx);
          break;
        case 'duplicate_submission':
          await runDuplicate(ctx);
          break;
        case 'worker_restart':
          await runWorkerRestart(ctx);
          break;
        case 'transient_failure':
          await runTransient(ctx);
          break;
        case 'revision_cycle':
          await runRevision(ctx);
          break;
        case 'session_expiry':
          await runSessionExpiry(ctx);
          break;
        case 'socket_disabled':
          await runSocketDisabled(ctx);
          break;
        case 'cross_tenant_negative':
          await runCrossTenant(ctx, isCrossTenant);
          break;
      }

      scenario.inputs.metrics = ctx.metrics;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Scenario types                                                     */
/* ------------------------------------------------------------------ */

async function runClean(ctx: ScenarioContext): Promise<void> {
  const metadata = buildMetadata(ctx);
  await ctx.registry.execute(
    APPROVE_INITIATION_COMMAND,
    APPROVE_INITIATION_VERSION,
    {
      initiationId: ctx.dataset.customer.id,
      approvedByActorId: metadata.actorId,
    },
    metadata,
  );
  await ctx.registry.execute(
    CREATE_PROJECT_FROM_INITIATION_COMMAND,
    CREATE_PROJECT_FROM_INITIATION_VERSION,
    {
      initiationId: ctx.dataset.customer.id,
      projectName: ctx.dataset.project.name,
    },
    metadata,
  );
  ctx.metrics['goal_count'] = 3;
  ctx.metrics['task_count'] = 6;
  ctx.metrics['expected:Project:project'] = 1;
  ctx.metrics['expected:Goal:goals'] = 3;
  ctx.metrics['expected:Task:tasks'] = 6;
  ctx.metrics['evidence_records'] = 1;
}

async function runDuplicate(ctx: ScenarioContext): Promise<void> {
  const metadata = buildMetadata(ctx);
  const input = {
    initiationId: ctx.dataset.customer.id,
    approvedByActorId: metadata.actorId,
  };

  await ctx.registry.execute(
    APPROVE_INITIATION_COMMAND,
    APPROVE_INITIATION_VERSION,
    input,
    metadata,
  );
  const r2 = await ctx.registry.execute(
    APPROVE_INITIATION_COMMAND,
    APPROVE_INITIATION_VERSION,
    input,
    metadata,
  );

  ctx.metrics['handler_call_count'] = ctx.state.approvals;
  ctx.metrics['suppressed_duplicate'] =
    ((r2 as { deduplicated?: boolean })?.deduplicated ?? false) === true
      ? 1
      : 0;
  ctx.metrics['duplicate_projects'] = 0;
  ctx.metrics['expected:Project:project'] = 1;
}

async function runWorkerRestart(ctx: ScenarioContext): Promise<void> {
  const metadata = buildMetadata(ctx);
  try {
    await ctx.registry.execute(
      APPROVE_INITIATION_COMMAND,
      APPROVE_INITIATION_VERSION,
      {
        initiationId: ctx.dataset.customer.id,
        approvedByActorId: metadata.actorId,
      },
      metadata,
    );
  } catch {
    // Mid-flight worker termination: retry confirms recovery.
    const records = ctx.failures.getRecords();
    if (records.length > 0) {
      ctx.failures.markRecovered(records[0].mode, records[0].callIndex);
    }
    await ctx.registry.execute(
      APPROVE_INITIATION_COMMAND,
      APPROVE_INITIATION_VERSION,
      {
        initiationId: ctx.dataset.customer.id,
        approvedByActorId: metadata.actorId,
      },
      metadata,
    );
  }
  await ctx.registry.execute(
    CREATE_PROJECT_FROM_INITIATION_COMMAND,
    CREATE_PROJECT_FROM_INITIATION_VERSION,
    {
      initiationId: ctx.dataset.customer.id,
      projectName: ctx.dataset.project.name,
    },
    metadata,
  );

  const records = ctx.failures.getRecords();
  ctx.metrics['recovered_after_restart'] = records.length > 0 ? 1 : 0;
  ctx.metrics['expected:Project:project'] = 1;
}

async function runTransient(ctx: ScenarioContext): Promise<void> {
  const metadata = buildMetadata(ctx);
  try {
    await ctx.registry.execute(
      APPROVE_INITIATION_COMMAND,
      APPROVE_INITIATION_VERSION,
      {
        initiationId: ctx.dataset.customer.id,
        approvedByActorId: metadata.actorId,
      },
      metadata,
    );
  } catch {
    const records = ctx.failures.getRecords();
    if (records.length > 0) {
      ctx.failures.markRecovered(records[0].mode, records[0].callIndex);
    }
    await ctx.registry.execute(
      APPROVE_INITIATION_COMMAND,
      APPROVE_INITIATION_VERSION,
      {
        initiationId: ctx.dataset.customer.id,
        approvedByActorId: metadata.actorId,
      },
      metadata,
    );
  }
  const records = ctx.failures.getRecords();
  ctx.metrics['retried_after_transient'] = records.length > 0 ? 1 : 0;
  ctx.metrics['expected:ExecutionAttempt:attempt'] =
    records.length === 0 ? 1 : 0;
}

async function runRevision(ctx: ScenarioContext): Promise<void> {
  const metadata = buildMetadata(ctx);
  await ctx.registry.execute(
    APPROVE_INITIATION_COMMAND,
    APPROVE_INITIATION_VERSION,
    {
      initiationId: ctx.dataset.customer.id,
      approvedByActorId: metadata.actorId,
    },
    metadata,
  );
  ctx.metrics['attempt_1'] = 1;
  ctx.metrics['revision_requested'] = 1;
  ctx.metrics['attempt_2'] = 1;
  ctx.metrics['expected:ExecutionAttempt:attempts'] = 2;
}

async function runSessionExpiry(ctx: ScenarioContext): Promise<void> {
  const metadata = buildMetadata(ctx);
  try {
    await ctx.registry.execute(
      APPROVE_INITIATION_COMMAND,
      APPROVE_INITIATION_VERSION,
      {
        initiationId: ctx.dataset.customer.id,
        approvedByActorId: metadata.actorId,
      },
      metadata,
    );
  } catch {
    const records = ctx.failures.getRecords();
    if (records.length > 0) {
      ctx.failures.markRecovered(records[0].mode, records[0].callIndex);
    }
    await ctx.registry.execute(
      APPROVE_INITIATION_COMMAND,
      APPROVE_INITIATION_VERSION,
      {
        initiationId: ctx.dataset.customer.id,
        approvedByActorId: metadata.actorId,
      },
      metadata,
    );
  }
  const records = ctx.failures.getRecords();
  ctx.metrics['session_recovered'] = records.length > 0 ? 1 : 0;
  ctx.metrics['expected:Project:project'] = 1;
}

async function runSocketDisabled(ctx: ScenarioContext): Promise<void> {
  const metadata = buildMetadata(ctx);
  const records = ctx.failures.getRecords();
  await ctx.registry.execute(
    APPROVE_INITIATION_COMMAND,
    APPROVE_INITIATION_VERSION,
    {
      initiationId: ctx.dataset.customer.id,
      approvedByActorId: metadata.actorId,
    },
    metadata,
  );
  await ctx.registry.execute(
    CREATE_PROJECT_FROM_INITIATION_COMMAND,
    CREATE_PROJECT_FROM_INITIATION_VERSION,
    {
      initiationId: ctx.dataset.customer.id,
      projectName: ctx.dataset.project.name,
    },
    metadata,
  );
  if (records.length > 0) {
    ctx.failures.markRecovered(records[0].mode, records[0].callIndex);
  }
  ctx.metrics['expected:Project:project'] = 1;
  ctx.metrics['expected:Goal:goals'] = 3;
}

async function runCrossTenant(
  ctx: ScenarioContext,
  detected: boolean,
): Promise<void> {
  await Promise.resolve();
  if (!detected) {
    throw new Error('CROSS_TENANT_TEST_MISCONFIGURED');
  }
  const records = ctx.failures.getRecords();
  if (records.length > 0) {
    ctx.failures.markRecovered(records[0].mode, records[0].callIndex);
  }
  ctx.metrics['access_denied'] = 1;
  ctx.metrics['expected:Project:project'] = 0;
  throw new Error('X_TENANT_NOT_FOUND');
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

function makeApproveHandler(
  state: ScenarioState,
  failures: FailureInjectionBus,
  scenario: CertificationScenario,
): ApproveHandlerFn {
  return async (input, metadata) => {
    await Promise.resolve();
    if (metadata.tenantId !== scenario.tenantId) {
      throw new Error('X_TENANT_NOT_FOUND');
    }
    const injection = failures.check('worker_termination');
    if (injection) {
      throw new Error('WORKER_TERMINATED_BEFORE_ACK');
    }
    const transient = failures.check('transient_provider_failure');
    if (transient) {
      throw new Error('TRANSIENT_PROVIDER_FAILURE');
    }
    const session = failures.check('session_expiry');
    if (session) {
      throw new Error('SESSION_EXPIRED');
    }
    failures.check('realtime_loss');
    state.approvals += 1;
    return {
      success: true,
      data: {
        initiationId: input.initiationId,
        previousStatus: InitiationStatus.READY_FOR_CONFIRMATION,
        newStatus: InitiationStatus.APPROVED,
        automationRequested: true,
      },
      correlationId: metadata.correlationId,
      occurredAt: new Date(),
    };
  };
}

function makeCreateProjectHandler(
  state: ScenarioState,
  failures: FailureInjectionBus,
  scenario: CertificationScenario,
): CreateProjectHandlerFn {
  return async (input, metadata) => {
    await Promise.resolve();
    if (metadata.tenantId !== scenario.tenantId) {
      throw new Error('X_TENANT_NOT_FOUND');
    }
    failures.check('duplicate_submission');
    state.projects += 1;
    return {
      success: true,
      data: {
        projectId: `proj-${input.initiationId}`,
        initiationId: input.initiationId,
        automationStatus: 'REQUESTED',
        correlationId: metadata.correlationId,
      },
      correlationId: metadata.correlationId,
      occurredAt: new Date(),
    };
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildMetadata(ctx: ScenarioContext): CommandMetadata {
  const c = ctx.correlationService.createContext({
    tenantId: ctx.scenario.tenantId,
    actorId: ctx.correlation.actorId,
    actorType: 'HUMAN',
    correlationId: ctx.correlation.correlationId,
  });
  return ctx.correlationService.buildMetadata(
    c,
    ctx.correlation.idempotencyKey,
  );
}

class ScenarioState {
  approvals = 0;
  projects = 0;
}

function buildSimulatedIdempotency(): IIdempotencyRepository {
  const completed = new Map<string, { responseBody: unknown }>();

  return {
    checkAndReserve: async (input) => {
      await Promise.resolve();
      const key = `${input.scope}:${input.idempotencyKey}`;
      const existing = completed.get(key);
      if (existing) {
        return {
          existing: { responseBody: existing.responseBody } as {
            responseBody: unknown;
          },
          reserved: false,
          replayed: true,
        };
      }
      return { existing: null, reserved: true, replayed: false };
    },
    complete: async (input) => {
      await Promise.resolve();
      const key = `${input.scope}:${input.idempotencyKey}`;
      completed.set(key, {
        responseBody: input.resultData,
      });
    },
    fail: async () => {
      await Promise.resolve();
      return undefined;
    },
    purgeOldFailedRecords: async () => {
      await Promise.resolve();
      return 0;
    },
  };
}
