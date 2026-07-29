// src/common/outbox/outbox.worker.ts
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
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
}

export const DEFAULT_WORKER_OPTIONS: WorkerOptions = {
  processIntervalMs: 1000,
  processBatch: 10,
  leaseMs: 30000,
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
   * Production constructor. NestJS DI resolves `OUTBOX_REPOSITORY` through
   * `@Inject(OUTBOX_REPOSITORY)` and the registered token-based provider.
   *
   * Tests should use `OutboxWorker.forTesting(repo, options)` to bypass DI.
   */
  constructor(
    @Inject(OUTBOX_REPOSITORY) outbox: IOutboxRepository,
    @Optional() options?: Partial<WorkerOptions>,
  ) {
    this.outbox = outbox;
    this.options = { ...DEFAULT_WORKER_OPTIONS, ...(options ?? {}) };
  }

  /** Test-only factory that emulates the production constructor signature. */
  static forTesting(
    repo: IOutboxRepository,
    options?: Partial<WorkerOptions>,
  ): OutboxWorker {
    const w = Object.create(OutboxWorker.prototype) as OutboxWorker;
    (w as any).outbox = repo;
    (w as any).options = { ...DEFAULT_WORKER_OPTIONS, ...(options ?? {}) };
    Object.assign(w, {
      logger: new Logger(OutboxWorker.name),
      workerId: `worker-test-${process.pid}-${Date.now()}`,
      timer: null,
      started: false,
      inflight: null,
      inflightStartedAt: null,
      handlers: new Map<string, EventHandler>(),
      circuit: new CircuitBreaker(),
      shuttingDown: false,
    });
    return w;
  }

  private outbox: IOutboxRepository;

  // FIX-OUTBOX-RACE: do NOT auto-start in onModuleInit. Modules that depend
  // on OutboxWorker register their handlers in their own onModuleInit
  // (or onApplicationBootstrap). If we start here, any handler registered
  // AFTER OutboxWorker's onModuleInit will miss events that arrive in the
  // gap. The worker is now started lazily by an explicit bootstrap hook
  // (see app.module.ts) AFTER all module onModuleInit hooks have run.
  onModuleInit(): void {
    // Intentionally empty.
  }

  /**
   * Start polling the outbox. MUST be called after every consumer module
   * has had a chance to call registerHandler(). app.module.ts wires this
   * via OnApplicationBootstrap on the AppModule itself.
   */
  bootstrap(): void {
    this.start();
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

    // Stale-lease recovery happens at the head of every tick.
    const staleRecovered = await this.outbox
      .recoverStale(new Date())
      .catch((e: unknown) => {
        this.logger.error(`recoverStale failed: ${e}`);
        return 0;
      });
    if (staleRecovered > 0) {
      this.logger.warn(`Recovered ${staleRecovered} stale lease(s)`);
    }

    const events = await this.outbox.claimAvailable(
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
          const promoted = await this.outbox
          .settleFailure(
            event.id,
            this.workerId,
            'no handler registered',
            new Date(Date.now() + this.options.leaseMs),
            event.retryCount + 1,
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
        await this.outbox.markProcessed(event.id, this.workerId);
        this.circuit.recordSuccess();
        processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const classification = classifyFailure(e);
        const nextAt = new Date(Date.now() + this.options.leaseMs);
        try {
          const promoted = await this.outbox.settleFailure(
            event.id,
            this.workerId,
            msg,
            nextAt,
            event.retryCount + 1,
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
