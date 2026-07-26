// src/common/outbox/outbox.worker.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

export type EventHandler = (event: any) => Promise<void>;

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly workerId = `worker-${process.pid}-${Date.now()}`;
  private readonly PROCESS_INTERVAL_MS = 1000;
  private readonly PROCESS_BATCH = 10;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private handlers: Map<string, EventHandler> = new Map();
  private circuit = new CircuitBreaker();

  constructor(private readonly outbox: OutboxService) {}

  registerHandler(eventType: string, handler: EventHandler): void {
    this.handlers.set(eventType, handler);
  }

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.timer = setInterval(() => {
      void Promise.resolve()
        .then(() => this.tick())
        .catch((e) => this.logger.error(`Outbox tick failed: ${e}`));
    }, this.PROCESS_INTERVAL_MS);
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      (this.timer as any).unref();
    }
    this.logger.log('Outbox worker started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.started = false;
  }

  isCircuitOpen(): boolean {
    return this.circuit.getState() === CircuitState.OPEN;
  }

  async tick(): Promise<{ processed: number; failed: number; circuitOpen: boolean }> {
    if (!this.circuit.canExecute()) {
      return { processed: 0, failed: 0, circuitOpen: true };
    }

    const events = await this.outbox.claimAvailable(
      this.workerId,
      30000,
      this.PROCESS_BATCH,
    );

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      const handler = this.handlers.get(event.eventType);

      if (!handler) {
        this.logger.warn(`No handler for event type ${event.eventType}`);
        await this.outbox.settleFailure(event.id, 'no-handler', 'no handler registered');
        failed++;
        continue;
      }

      try {
        await handler(event);
        await this.outbox.markCompleted(event.id, this.workerId);
        this.circuit.recordSuccess();
        processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.outbox.settleFailure(event.id, this.workerId, msg);
        this.circuit.recordFailure();
        failed++;
      }
    }

    await this.outbox.recoverStale(new Date());

    return { processed, failed, circuitOpen: false };
  }
}
