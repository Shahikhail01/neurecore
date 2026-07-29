/**
 * EnterpriseEventTransport — durable at-least-once transport (ADR-001).
 *
 * Responsibilities (NO business logic):
 *   - publish(): validate → write outbox row (optionally in a caller tx).
 *   - dispatch worker: outbox PENDING → create per-consumer inbox rows → mark
 *     outbox DISPATCHED. (Fan-out is decoupled from processing.)
 *   - process worker: claim PENDING inbox rows atomically (lease), invoke the
 *     consumer handler, mark PROCESSED / FAILED(+retry) / DEAD_LETTER.
 *   - stale-lease recovery: PROCESSING past lease → FAILED for retry.
 *   - replayDeadLetter(): tenant-scoped, re-enqueues a dead-lettered delivery.
 *
 * Delivery guarantee: AT-LEAST-ONCE. Consumers must be idempotent; business-
 * effect idempotency is provided by IdempotencyService (ADR-001 §6).
 *
 * Timers use .unref() so the DI boot gate (createApplicationContext, 60s) does
 * not hang; tick methods are also exposed for deterministic tests.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  EnterpriseEvent,
  PublishEventInput,
} from '../contracts/enterprise-event.interface';
import {
  ConsumerRegistration,
  ConsumerStatus,
  IEnterpriseEventTransport,
  PublishResult,
} from '../contracts/enterprise-event-transport.interface';
import { getEventContract } from '../contracts/enterprise-event-registry';
import { validatePublishInput } from '../validation/event-contract.validator';

// Inbox lease. The transport claims a row for at most this long; if the
// consumer hasn't settled by then, the row is reclaimed and the event is
// retried. Most consumers (audit, UI projection, knowledge graph sync, etc.)
// complete in well under a second. The execution consumer drives a real
// AI run via the ExecutionWorker, which can take 2-3 minutes — so the lease
// has to be long enough to cover the worst case, otherwise the consumer
// wakes up, finds the row has been reclaimed, and the AI run is wasted.
// 180s matches the execution.worker.ts internal leaseMs.
const LEASE_MS = 180_000; // 180s processing lease (covers long-running AI exec)
const MAX_RETRIES = 3; // attempts before dead-letter
const BACKOFF_BASE_MS = 1000; // 1s, 4s, 16s (base^attempt * 1s via 4^n here)
const DISPATCH_BATCH = 50;
const PROCESS_BATCH = 50;

@Injectable()
export class EnterpriseEventTransport
  implements IEnterpriseEventTransport, OnModuleDestroy
{
  private readonly logger = new Logger(EnterpriseEventTransport.name);
  private readonly consumers: ConsumerRegistration[] = [];
  private dispatchTimer: ReturnType<typeof setInterval> | null = null;
  private processTimer: ReturnType<typeof setInterval> | null = null;
  private recoveryTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(
    private readonly prisma: PrismaService,
    // Optional so unit tests can construct without the flag service.
    @Optional() private readonly clock: { now: () => Date } = { now: () => new Date() },
  ) {}

  // ── Registration ──────────────────────────────────────────────────────────

  registerConsumer(registration: ConsumerRegistration): void {
    const existing = this.consumers.find(
      (c) => c.consumerId === registration.consumerId,
    );
    if (existing) {
      this.logger.warn(
        `Consumer "${registration.consumerId}" already registered; replacing`,
      );
      this.consumers.splice(this.consumers.indexOf(existing), 1);
    }
    this.consumers.push(registration);
    this.logger.log(
      `Registered consumer "${registration.consumerId}" for ${
        registration.eventTypes === '*'
          ? 'ALL events'
          : registration.eventTypes.join(', ')
      }`,
    );
  }

  private consumersFor(eventType: string): ConsumerRegistration[] {
    return this.consumers.filter(
      (c) => c.eventTypes === '*' || c.eventTypes.includes(eventType),
    );
  }

  // ── Publish (transactional outbox) ─────────────────────────────────────────

  async publish(
    input: PublishEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PublishResult> {
    validatePublishInput(input);
    const contract = getEventContract(input.eventType)!;
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;

    const correlationId = input.correlationId ?? randomUUID();

    // Producer-side dedup on (tenantId, idempotencyKey).
    const existing = await client.enterpriseEventOutbox.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return { eventId: existing.id, deduplicated: true };
    }

    try {
      const row = await client.enterpriseEventOutbox.create({
        data: {
          eventType: input.eventType,
          version: input.version ?? contract.version,
          tenantId: input.tenantId,
          actorId: input.actorId ?? null,
          actorType: input.actorType ?? 'SYSTEM',
          correlationId,
          causationId: input.causationId ?? null,
          idempotencyKey: input.idempotencyKey,
          sourceModule: input.sourceModule,
          payload: input.payload as Prisma.InputJsonValue,
          status: 'PENDING',
        },
        select: { id: true },
      });
      return { eventId: row.id, deduplicated: false };
    } catch (e: unknown) {
      // Unique race: another writer inserted the same (tenant, key) concurrently.
      if (
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: string }).code === 'P2002'
      ) {
        const dup = await client.enterpriseEventOutbox.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          select: { id: true },
        });
        if (dup) return { eventId: dup.id, deduplicated: true };
      }
      throw e;
    }
  }

  // ── Dispatch: outbox PENDING → consumer inbox rows ──────────────────────────

  /** Create inbox rows for PENDING outbox events, then mark them DISPATCHED. */
  async dispatchPending(limit = DISPATCH_BATCH): Promise<number> {
    const pending = await this.prisma.enterpriseEventOutbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let dispatched = 0;
    for (const evt of pending) {
      const targets = this.consumersFor(evt.eventType);
      // Even with zero consumers we mark DISPATCHED so the outbox drains;
      // the event remains durably stored for audit/replay.
      for (const c of targets) {
        try {
          await this.prisma.enterpriseEventInbox.upsert({
            where: {
              eventId_consumerId: { eventId: evt.id, consumerId: c.consumerId },
            },
            create: {
              eventId: evt.id,
              consumerId: c.consumerId,
              tenantId: evt.tenantId,
              status: 'PENDING',
            },
            update: {}, // idempotent: never duplicate an inbox row
          });
        } catch (e: unknown) {
          // Defensive: even though upsert is supposed to be atomic, a concurrent
          // worker can still race and produce P2002. Swallow it — the existing
          // row is equivalent to what we would have created.
          if (
            typeof e === 'object' &&
            e !== null &&
            (e as { code?: string }).code === 'P2002'
          ) {
            continue;
          }
          throw e;
        }
      }
      await this.prisma.enterpriseEventOutbox.update({
        where: { id: evt.id },
        data: { status: 'DISPATCHED', dispatchedAt: this.clock.now() },
      });
      dispatched++;
    }
    return dispatched;
  }

  // ── Process: claim inbox rows atomically, invoke handlers ───────────────────

  /** Process PENDING/retryable inbox rows for all registered consumers. */
  async processPending(limit = PROCESS_BATCH): Promise<number> {
    const candidates = await this.prisma.enterpriseEventInbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const entry of candidates) {
      const claimed = await this.claim(entry.id);
      if (!claimed) continue; // another worker won the claim
      await this.runConsumer(claimed.id, claimed.leaseToken!);
      processed++;
    }
    return processed;
  }

  /**
   * Atomically claim a PENDING inbox row: set PROCESSING + unique lease token +
   * expiry, only if still PENDING. Returns the claimed row or null if lost.
   */
  private async claim(
    inboxId: string,
  ): Promise<{ id: string; leaseToken: string } | null> {
    const leaseToken = randomUUID();
    const now = this.clock.now();
    const expires = new Date(now.getTime() + LEASE_MS);

    // Conditional update — the WHERE status:'PENDING' guarantees only one
    // worker transitions PENDING→PROCESSING (atomic compare-and-set).
    const res = await this.prisma.enterpriseEventInbox.updateMany({
      where: { id: inboxId, status: 'PENDING' },
      data: {
        status: 'PROCESSING',
        leaseToken,
        leaseExpiresAt: expires,
        claimedAt: now,
      },
    });
    if (res.count !== 1) return null;
    return { id: inboxId, leaseToken };
  }

  /** Invoke the consumer handler for a claimed inbox row and settle its state. */
  private async runConsumer(inboxId: string, leaseToken: string): Promise<void> {
    const entry = await this.prisma.enterpriseEventInbox.findUnique({
      where: { id: inboxId },
    });
    if (!entry || entry.leaseToken !== leaseToken) return; // lost lease

    const event = await this.prisma.enterpriseEventOutbox.findUnique({
      where: { id: entry.eventId },
    });
    if (!event) {
      this.logger.error(`Event ${entry.eventId} not found for inbox ${inboxId}`);
      await this.releaseFailed(inboxId, leaseToken, 'event not found');
      return;
    }

    const consumer = this.consumers.find(
      (c) => c.consumerId === entry.consumerId,
    );
    const evt = this.toEnterpriseEvent(event);

    if (!consumer) {
      // Consumer no longer registered — leave PENDING is wrong; mark FAILED so
      // recovery/backoff applies, but do not dead-letter a transient config gap.
      await this.releaseFailed(inboxId, leaseToken, 'consumer not registered');
      return;
    }

    try {
      await consumer.handler(evt);
      await this.prisma.enterpriseEventInbox.updateMany({
        where: { id: inboxId, leaseToken },
        data: {
          status: 'PROCESSED',
          processedAt: this.clock.now(),
          leaseToken: null,
          leaseExpiresAt: null,
          lastError: null,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.settleFailure(entry, leaseToken, message, evt);
    }
  }

  private async settleFailure(
    entry: { id: string; retryCount: number; consumerId: string; tenantId: string },
    leaseToken: string,
    message: string,
    evt: EnterpriseEvent,
  ): Promise<void> {
    const nextRetry = entry.retryCount + 1;
    if (nextRetry >= MAX_RETRIES) {
      // Promote to dead-letter (terminal for this consumer).
      await this.prisma.$transaction([
        this.prisma.enterpriseEventInbox.updateMany({
          where: { id: entry.id, leaseToken },
          data: {
            status: 'DEAD_LETTER',
            retryCount: nextRetry,
            lastError: message,
            leaseToken: null,
            leaseExpiresAt: null,
          },
        }),
        this.prisma.enterpriseEventDeadLetter.create({
          data: {
            originalEventId: evt.eventId,
            eventType: evt.eventType,
            tenantId: entry.tenantId,
            consumerId: entry.consumerId,
            payload: evt.payload as Prisma.InputJsonValue,
            retryCount: nextRetry,
            lastError: message,
            lastAttemptAt: this.clock.now(),
          } as Prisma.EnterpriseEventDeadLetterUncheckedCreateInput,
        }),
      ]);
      this.logger.warn(
        `Dead-lettered event ${evt.eventId} for consumer ${entry.consumerId}: ${message}`,
      );
    } else {
      await this.releaseFailed(entry.id, leaseToken, message, nextRetry);
    }
  }

  /** Mark a claimed row FAILED so the retry loop re-attempts after backoff. */
  private async releaseFailed(
    inboxId: string,
    leaseToken: string,
    message: string,
    retryCount?: number,
  ): Promise<void> {
    await this.prisma.enterpriseEventInbox.updateMany({
      where: { id: inboxId, leaseToken },
      data: {
        status: 'FAILED',
        lastError: message,
        leaseToken: null,
        leaseExpiresAt: null,
        ...(retryCount != null ? { retryCount } : {}),
      },
    });
  }

  // ── Retry: FAILED rows become PENDING again after exponential backoff ───────

  /** Re-enqueue FAILED rows whose backoff window has elapsed. */
  async retryFailed(limit = PROCESS_BATCH): Promise<number> {
    const failed = await this.prisma.enterpriseEventInbox.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    const now = this.clock.now().getTime();
    let requeued = 0;
    for (const entry of failed) {
      const backoff = this.backoffMs(entry.retryCount);
      const claimedAt = entry.claimedAt?.getTime() ?? 0;
      if (now - claimedAt < backoff) continue; // still in backoff window
      const res = await this.prisma.enterpriseEventInbox.updateMany({
        where: { id: entry.id, status: 'FAILED' },
        data: { status: 'PENDING' },
      });
      if (res.count === 1) requeued++;
    }
    return requeued;
  }

  /** 1s, 4s, 16s … (BACKOFF_BASE_MS * 4^retryCount). */
  backoffMs(retryCount: number): number {
    return BACKOFF_BASE_MS * Math.pow(4, retryCount);
  }

  // ── Recovery: stale PROCESSING (expired lease) → FAILED for retry ───────────

  async recoverStale(limit = PROCESS_BATCH): Promise<number> {
    const now = this.clock.now();
    const stale = await this.prisma.enterpriseEventInbox.findMany({
      where: { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
      take: limit,
    });
    let recovered = 0;
    for (const entry of stale) {
      const res = await this.prisma.enterpriseEventInbox.updateMany({
        where: { id: entry.id, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          lastError: 'lease expired — consumer did not settle within lease window',
          retryCount: entry.retryCount + 1,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (res.count === 1) recovered++;
    }
    return recovered;
  }

  // ── Administrative replay (tenant-scoped) ───────────────────────────────────

  async replayDeadLetter(
    deadLetterId: string,
    tenantId: string,
  ): Promise<boolean> {
    const dl = await this.prisma.enterpriseEventDeadLetter.findUnique({
      where: { id: deadLetterId },
    });
    if (!dl || dl.tenantId !== tenantId) return false; // tenant isolation

    // Reset the consumer's inbox row to PENDING for a fresh attempt.
    await this.prisma.enterpriseEventInbox.updateMany({
      where: { eventId: dl.originalEventId, consumerId: dl.consumerId },
      data: {
        status: 'PENDING',
        retryCount: 0,
        lastError: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    await this.prisma.enterpriseEventDeadLetter.update({
      where: { id: dl.id },
      data: { replayStatus: 'REPLAYED', replayedAt: this.clock.now() },
    });
    return true;
  }

  // ── Observability ───────────────────────────────────────────────────────────

  async getConsumerStatus(consumerId: string): Promise<ConsumerStatus> {
    const [pending, processing, processed, failed, deadLettered] =
      await Promise.all([
        this.prisma.enterpriseEventInbox.count({
          where: { consumerId, status: 'PENDING' },
        }),
        this.prisma.enterpriseEventInbox.count({
          where: { consumerId, status: 'PROCESSING' },
        }),
        this.prisma.enterpriseEventInbox.count({
          where: { consumerId, status: 'PROCESSED' },
        }),
        this.prisma.enterpriseEventInbox.count({
          where: { consumerId, status: 'FAILED' },
        }),
        this.prisma.enterpriseEventInbox.count({
          where: { consumerId, status: 'DEAD_LETTER' },
        }),
      ]);
    return { consumerId, pending, processing, processed, failed, deadLettered };
  }

  // ── Worker lifecycle ────────────────────────────────────────────────────────

  /** Start background workers. Idempotent. Called from OnApplicationBootstrap. */
  startWorkers(): void {
    if (this.started) return;
    this.started = true;
    // Dispatch + process every 1s; recovery every 10s. All .unref()'d.
    this.dispatchTimer = this.mkTimer(() => this.tick(), 1000);
    this.recoveryTimer = this.mkTimer(async () => {
      await this.recoverStale();
      await this.retryFailed();
    }, 10_000);
    this.logger.log('Enterprise Event Fabric workers started');
  }

  /** One combined dispatch+process tick (also used by tests). */
  async tick(): Promise<{ dispatched: number; processed: number }> {
    const dispatched = await this.dispatchPending();
    const processed = await this.processPending();
    return { dispatched, processed };
  }

  private mkTimer(
    fn: () => Promise<unknown> | unknown,
    ms: number,
  ): ReturnType<typeof setInterval> {
    const timer = setInterval(() => {
      void Promise.resolve()
        .then(fn)
        .catch((e) => this.logger.error(`Fabric worker tick failed: ${e}`));
    }, ms);
    if (typeof timer === 'object' && timer && 'unref' in timer) {
      (timer as { unref: () => void }).unref();
    }
    return timer;
  }

  onModuleDestroy(): void {
    for (const t of [this.dispatchTimer, this.processTimer, this.recoveryTimer]) {
      if (t) clearInterval(t);
    }
    this.dispatchTimer = this.processTimer = this.recoveryTimer = null;
  }

  // ── Mapping ─────────────────────────────────────────────────────────────────

  private toEnterpriseEvent(row: {
    id: string;
    eventType: string;
    version: number;
    tenantId: string;
    actorId: string | null;
    actorType: string;
    correlationId: string;
    causationId: string | null;
    idempotencyKey: string;
    sourceModule: string;
    createdAt: Date;
    payload: unknown;
  }): EnterpriseEvent {
    return {
      eventId: row.id,
      eventType: row.eventType,
      version: row.version,
      tenantId: row.tenantId,
      actorId: row.actorId,
      actorType: row.actorType as EnterpriseEvent['actorType'],
      correlationId: row.correlationId,
      causationId: row.causationId,
      idempotencyKey: row.idempotencyKey,
      sourceModule: row.sourceModule,
      timestamp: row.createdAt.toISOString(),
      payload: (row.payload ?? {}) as Record<string, unknown>,
    };
  }
}
