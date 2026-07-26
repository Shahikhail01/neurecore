// src/common/ports/transaction.interface.ts
import { Prisma } from '@prisma/client';
import { UNIT_OF_WORK } from './di-tokens';

export { UNIT_OF_WORK };

export interface IUnitOfWork {
  execute<T>(work: (tx: ITransactionalClient) => Promise<T>): Promise<T>;
}

export interface ITransactionalClient {
  [key: string]: unknown;
}

export interface IRepository<T, TId = string> {
  findById(tenantId: string, id: TId): Promise<T | null>;
  findFirst(tenantId: string, where: Record<string, unknown>): Promise<T | null>;
  exists(tenantId: string, where: Record<string, unknown>): Promise<boolean>;
  count(tenantId: string, where: Record<string, unknown>): Promise<number>;
}
