// src/common/outbox/outbox.worker.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type {
  IOutboxRepository,
  OutboxEventRecord,
} from './outbox-repository.port';
import { OUTBOX_REPOSITORY } from './outbox-repository.port';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

export type EventHandler = (event: OutboxEventRecord) => Promise<void>;

export interface WorkerOptions {
  /** Time interval between ticks (ms). */
  processIntervalMs: number;
  /** Maximum number of rows claimed per tick. */
  processBatch: number;
  /** Lease lifetime (ms) granted to a claimed row. */
  leaseMs: number;
  /** Maximum tolerated concurrent ticks (1 = strictly serial). */
  maxConcurrentTicks: number;
  /** Maximum total processed-count before refusing further dispatch. */
  maxProcessingCount?: number;
}

export const DEFAULT_WORKER_OPTIONS: WorkerOptions = {
  processIntervalMs: 1000,
  processBatch: 10,
  leaseMs: 30000,
  maxConcurrentTicks: 1,
  maxProcessingCount: 50,
};

export interface TickResult {
  processed: number;
  failed: number;
  retried: number;
  deadLettered: number;
  circuitOpen: boolean;
}

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly workerId = `worker-${process.pid}-${Date.now()}`;
  private readonly options: WorkerOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  /** Single in-flight tick at a time — prevents overlapping loops. */
  private inflight: Promise<void> | null = null;
  private inflightStartedAt: number | null = null;
  private handlers: Map<string, EventHandler> = new Map();
  private circuit = new CircuitBreaker();
  private shuttingDown = false;

  /**
   * Production wiring: NestJS resolves `OUTBOX_REPOSITORY` through
   * `OutboxWorker.setModuleRef(this.moduleRef)` registered by `OutboxModule`.
   *
   * Test wiring: callers may construct the worker directly with
   *   new OutboxWorker(repo, options)
   * to bypass DI.
   */
  private outbox: IOutboxRepository | null;

  private static moduleRef: ModuleRef | null = null;

  /** Called by `OutboxModule.onModuleInit` to enable production DI resolution. */
  static setModuleRef(moduleRef: ModuleRef): void {
    OutboxWorker.moduleRef = moduleRef;
  }

  constructor(...args: unknown[]) {
    let repo: IOutboxRepository | null = null;
    let opts: Partial<WorkerOptions> = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!arg || typeof arg !== 'object') continue;
      const a = arg as { publish?: unknown } & Partial<WorkerOptions>;
      if (typeof a.publish === 'function') {
        repo = a as unknown as IOutboxRepository;
        continue;
      }
      if (
        'processIntervalMs' in a ||
        'leaseMs' in a ||
        'processBatch' in a
      ) {
        opts = a as Partial<WorkerOptions>;
      }
    }
    if (!repo && args.length > 0) {
      // First arg may be the repo directly when the test calls
      //   new OutboxWorker(repo, opts)
      // and some Object.prototype methods shadow the typed check above.
      const firstArg = args[0] as { publish?: unknown } | null;
      if (firstArg && typeof firstArg.publish === 'function') {
        repo = firstArg as unknown as IOutboxRepository;
      }
    }
    // Production paths leave `repo` null until onModuleInit resolves it
    // through OutboxWorker.moduleRef. Test paths always set it directly.
    this.outbox = (repo ?? null) as IOutboxRepository | null;
    this.options = { ...DEFAULT_WORKER_OPTIONS, ...opts };
  }

  onModuleInit(): void {
    if (!this.outbox || typeof (this.outbox as any).publish !== 'function') {
      if (OutboxWorker.moduleRef) {
        try {
          this.outbox = OutboxWorker.moduleRef.get<IOutboxRepository>(
            OUTBOX_REPOSITORY,
            { strict: false },
          );
        } catch (e) {
          this.logger.error(
            `Failed to resolve OUTBOX_REPOSITORY: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
    }
    if (!this.outbox || typeof (this.outbox as any).publish !== 'function') {
      throw new Error('OUTBOX_REPOSITORY_REQUIRED');
    }
    this.start();
  }

  private requireRepo(): IOutboxRepository {
    if (!this.outbox || typeof this.outbox.publish !== 'function') {
      throw new Error('OUTBOX_REPOSITORY_NOT_INITIALIZED');
    }
    return this.outbox;
  }

  async onModuleDestroy(): Promise<void> {
    this.stop();
    if (this.inflight) {
      try {
        await this.inflight;
      } catch {
        // ignore
      }
    }
    if (this.outbox && typeof this.outbox.releaseWorker === 'function') {
      try {
        await this.outbox.releaseWorker(this.workerId);
      } catch (e) {
        this.logger.warn(
          `releaseWorker failed during shutdown: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  registerHandler(eventType: string, handler: EventHandler): void {
    this.handlers.set(eventType, handler);
    this.logger.log(`Registered handler for ${eventType}`);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.timer = setInterval(() => {
      if (this.shuttingDown) return;
      void this.tickSafely();
    }, this.options.processIntervalMs);
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      (this.timer as any).unref();
    }
    this.logger.log(
      `Outbox worker started (${this.workerId}); interval=${this.options.processIntervalMs}ms, batch=${this.options.processBatch}, leaseMs=${this.options.leaseMs}`,
    );
  }

  stop(): void {
    this.shuttingDown = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.started = false;
  }

  isCircuitOpen(): boolean {
    return this.circuit.getState() === CircuitState.OPEN;
  }

  /** Returns the current tick metrics; useful for /health endpoints. */
  async tick(): Promise<TickResult> {
    if (!this.circuit.canExecute()) {
      return {
        processed: 0,
        failed: 0,
        retried: 0,
        deadLettered: 0,
        circuitOpen: true,
      };
    }
    const repo = this.requireRepo();

    // Stale-lease recovery happens at the head of every tick.
    const staleRecovered = await repo
      .recoverStale(new Date())
      .catch((e: unknown) => {
        this.logger.error(`recoverStale failed: ${e}`);
        return 0;
      });
    if (staleRecovered > 0) {
      this.logger.warn(`Recovered ${staleRecovered} stale lease(s)`);
    }

    const events = await repo.claimAvailable(
      this.workerId,
      this.options.leaseMs,
      this.options.processBatch,
    );

    let processed = 0;
    let failed = 0;
    let retried = 0;
    let deadLettered = 0;

    for (const event of events) {
      const handler = this.handlers.get(event.eventType);
      if (!handler) {
        this.logger.warn(`No handler for event type ${event.eventType}`);
        const promoted = await repo
          .settleFailure(
            event.id,
            this.workerId,
            'no handler registered',
            new Date(Date.now() + this.options.leaseMs),
            'INVALID_INPUT',
          )
          .catch((e: unknown) => {
            this.logger.error(
              `settleFailure(no-handler) failed: ${
                e instanceof Error ? e.message : String(e)
              }`,
            );
            return false;
          });
        deadLettered += promoted ? 1 : 0;
        retried += promoted ? 0 : 1;
        continue;
      }

      try {
        await handler(event);
        await repo.markProcessed(event.id, this.workerId);
        this.circuit.recordSuccess();
        processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const classification = classifyFailure(e);
        const nextAt = new Date(Date.now() + this.options.leaseMs);
        try {
          const promoted = await repo.settleFailure(
            event.id,
            this.workerId,
            msg,
            nextAt,
            classification,
          );
          if (promoted) deadLettered++;
          else retried++;
        } catch (settleErr) {
          this.logger.error(
            `settleFailure failed for ${event.id}: ${
              settleErr instanceof Error
                ? settleErr.message
                : String(settleErr)
            }`,
          );
        }
        this.circuit.recordFailure();
        failed++;
      }
    }

    return { processed, failed, retried, deadLettered, circuitOpen: false };
  }

  /** Run a tick without overlapping the previous one. */
  tickSafely(): Promise<void> {
    if (this.inflight) {
      if (
        this.inflightStartedAt &&
        Date.now() - this.inflightStartedAt > this.options.leaseMs
      ) {
        this.logger.warn(
          'Previous tick exceeded lease interval; allowing new tick anyway',
        );
      } else {
        return Promise.resolve();
      }
    }
    this.inflightStartedAt = Date.now();
    this.inflight = (async () => {
      try {
        await this.tick();
      } catch (e) {
        this.logger.error(`Outbox tick failed: ${e}`);
      } finally {
        this.inflight = null;
        this.inflightStartedAt = null;
      }
    })();
    return this.inflight;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  getOptions(): WorkerOptions {
    return { ...this.options };
  }
}

function classifyFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err);
  if (msg.includes('policy')) return 'POLICY_DENIAL';
  if (msg.includes('not found') || msg.includes('invalid')) {
    return 'INVALID_INPUT';
  }
  if (msg.includes('deadline') || msg.includes('timeout')) {
    return 'TRANSIENT_INFRASTRUCTURE';
  }
  return 'TRANSIENT_INFRASTRUCTURE';
}
