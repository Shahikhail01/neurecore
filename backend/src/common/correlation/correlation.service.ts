// src/common/correlation/correlation.service.ts
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { CorrelationContext, CommandMetadata } from './correlation.interface';

const storage = new AsyncLocalStorage<CorrelationContext>();

@Injectable()
export class CorrelationService {
  createContext(partial: Partial<CorrelationContext>): CorrelationContext {
    return {
      correlationId: partial.correlationId ?? randomUUID(),
      causationId: partial.causationId ?? null,
      tenantId: partial.tenantId ?? '',
      actorId: partial.actorId ?? '',
      actorType: partial.actorType ?? 'SYSTEM',
    };
  }

  buildMetadata(context: CorrelationContext, idempotencyKey: string): CommandMetadata {
    return {
      tenantId: context.tenantId,
      actorId: context.actorId,
      actorType: context.actorType,
      correlationId: context.correlationId,
      causationId: context.causationId,
      idempotencyKey,
      occurredAt: new Date().toISOString(),
      schemaVersion: 1,
    };
  }

  getCurrent(): CorrelationContext | undefined {
    return storage.getStore();
  }

  runWith<T>(context: CorrelationContext, fn: () => T): T {
    return storage.run(context, fn);
  }

  generateId(): string {
    return randomUUID();
  }
}
